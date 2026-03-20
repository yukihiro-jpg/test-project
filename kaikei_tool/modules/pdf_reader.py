"""
PDF読み取りモジュール
通帳PDF・売上請求書PDF・賃金台帳PDFからデータを抽出する

事務所PCでClaude Codeに実際のPDFを見せて、このモジュールの
解析関数をカスタマイズしてもらう想定。
"""
import re
import os
from dataclasses import dataclass, field

try:
    import pdfplumber
    PDF読取可能 = True
except ImportError:
    PDF読取可能 = False

try:
    from PIL import Image
    import pytesseract
    OCR可能 = True
except ImportError:
    OCR可能 = False


@dataclass
class 通帳取引:
    """通帳1行分のデータ"""
    日付: str              # YYYYMMDD
    摘要: str              # 摘要（カタカナ等）
    出金額: int = 0
    入金額: int = 0
    残高: int = 0
    口座コード: str = ""    # 口座の科目コード（例: "131"）
    元テキスト: str = ""    # 元のテキスト（デバッグ用）


@dataclass
class 請求書データ:
    """請求書1枚分のデータ"""
    日付: str = ""              # 請求日 YYYYMMDD
    取引先名: str = ""
    合計金額: int = 0
    消費税額: int = 0
    明細一覧: list = field(default_factory=list)  # [{品名, 数量, 単価, 金額, 税率}]
    インボイス番号: str = ""    # T+13桁
    適格請求書: bool = False
    元テキスト: str = ""


@dataclass
class 賃金台帳データ:
    """賃金台帳1人分のデータ"""
    従業員名: str = ""
    対象期間: str = ""
    基本給: int = 0
    残業代: int = 0
    通勤手当: int = 0
    支給合計: int = 0
    健康保険: int = 0
    厚生年金: int = 0
    雇用保険: int = 0
    源泉所得税: int = 0
    住民税: int = 0
    控除合計: int = 0
    差引支給額: int = 0
    元テキスト: str = ""


def PDFテキスト抽出(PDFパス):
    """PDFからテキストを抽出（pdfplumber優先、失敗時はOCR）"""
    if not os.path.isfile(PDFパス):
        raise FileNotFoundError(f"PDFが見つかりません: {PDFパス}")

    テキスト = ""

    # pdfplumberでテキスト抽出を試行
    if PDF読取可能:
        with pdfplumber.open(PDFパス) as pdf:
            for ページ in pdf.pages:
                ページテキスト = ページ.extract_text()
                if ページテキスト:
                    テキスト += ページテキスト + "\n"

    # テキストが取れなかった場合、OCRにフォールバック
    if not テキスト.strip() and OCR可能:
        テキスト = _OCR読み取り(PDFパス)

    if not テキスト.strip():
        raise RuntimeError(
            f"PDFからテキストを抽出できません: {PDFパス}\n"
            "pdfplumberまたはtesseract-ocrをインストールしてください。"
        )

    return テキスト


def PDFテーブル抽出(PDFパス):
    """PDFからテーブル構造を抽出"""
    if not PDF読取可能:
        return []

    テーブル一覧 = []
    with pdfplumber.open(PDFパス) as pdf:
        for ページ in pdf.pages:
            ページテーブル = ページ.extract_tables()
            if ページテーブル:
                テーブル一覧.extend(ページテーブル)
    return テーブル一覧


def _OCR読み取り(PDFパス):
    """OCRでPDFを読み取り"""
    try:
        from pdf2image import convert_from_path
        画像一覧 = convert_from_path(PDFパス, dpi=300)
        テキスト一覧 = []
        for 画像 in 画像一覧:
            t = pytesseract.image_to_string(画像, lang="jpn")
            テキスト一覧.append(t)
        return "\n".join(テキスト一覧)
    except ImportError:
        return ""


# ============================================================
# 通帳PDF解析
# ============================================================
def 通帳PDF解析(PDFパス, 口座コード=""):
    """
    通帳PDFを解析して取引リストを返す。

    【カスタマイズポイント】
    事務所PCで実際の通帳PDFをClaude Codeに見せて、
    この関数内のパターンを調整してもらう。
    銀行ごとにフォーマットが異なるため。

    引数:
        PDFパス: 通帳PDFのパス
        口座コード: この口座の科目コード（例: "131"）

    戻り値:
        list[通帳取引]
    """
    # ファイル名から口座コード推定（例: "131_常陽銀行普通.pdf"）
    if not 口座コード:
        ファイル名 = os.path.basename(PDFパス)
        m = re.match(r"^(\d{2,4})", ファイル名)
        if m:
            口座コード = m.group(1)

    テキスト = PDFテキスト抽出(PDFパス)
    取引一覧 = []

    # テーブル抽出を優先
    テーブル一覧 = PDFテーブル抽出(PDFパス)
    if テーブル一覧:
        取引一覧 = _通帳テーブル解析(テーブル一覧, 口座コード)

    # テーブルが取れなければテキストベースで解析
    if not 取引一覧:
        取引一覧 = _通帳テキスト解析(テキスト, 口座コード)

    return 取引一覧


def _通帳テーブル解析(テーブル一覧, 口座コード):
    """テーブル構造から通帳データを抽出"""
    結果 = []
    for テーブル in テーブル一覧:
        for 行 in テーブル:
            if not 行 or len(行) < 4:
                continue
            日付文字列 = _セルから日付検索(行)
            if not 日付文字列:
                continue

            摘要 = _セルから摘要検索(行)

            # 出金・入金・残高の特定（位置ベース）
            数値セル = [(i, _金額抽出(セル)) for i, セル in enumerate(行)
                       if セル and _金額抽出(セル) > 0]

            if len(数値セル) >= 2 and 摘要:
                出金額 = 0
                入金額 = 0
                残高 = 0
                if len(数値セル) == 2:
                    出金額 = 数値セル[0][1]
                    残高 = 数値セル[1][1]
                    if 残高 > 出金額:
                        入金額 = 出金額
                        出金額 = 0
                elif len(数値セル) >= 3:
                    出金額 = 数値セル[0][1]
                    入金額 = 数値セル[1][1]
                    残高 = 数値セル[2][1]

                結果.append(通帳取引(
                    日付=日付文字列, 摘要=摘要,
                    出金額=出金額, 入金額=入金額, 残高=残高,
                    口座コード=口座コード, 元テキスト=str(行),
                ))
    return 結果


def _通帳テキスト解析(テキスト, 口座コード):
    """テキストベースで通帳データを抽出"""
    結果 = []
    for 行 in テキスト.split("\n"):
        行 = 行.strip()
        if not 行:
            continue

        日付一致 = re.search(
            r"(\d{4}[/\-]\d{1,2}[/\-]\d{1,2}|\d{1,2}[/\-]\d{1,2})", 行
        )
        if not 日付一致:
            continue

        日付文字列 = _日付正規化(日付一致.group(1))

        金額一覧 = re.findall(r"[\d,]+\d", 行)
        金額一覧 = [int(a.replace(",", "")) for a in 金額一覧 if int(a.replace(",", "")) > 0]

        if len(金額一覧) < 1:
            continue

        日付以降 = 行[日付一致.end():].strip()
        金額一致 = re.search(r"[\d,]{2,}", 日付以降)
        摘要 = 日付以降[:金額一致.start()].strip() if 金額一致 else 日付以降

        if not 摘要:
            continue

        出金額, 入金額, 残高 = 0, 0, 0
        if len(金額一覧) == 1:
            出金額 = 金額一覧[0]
        elif len(金額一覧) == 2:
            出金額, 残高 = 金額一覧[0], 金額一覧[1]
        elif len(金額一覧) >= 3:
            出金額, 入金額, 残高 = 金額一覧[0], 金額一覧[1], 金額一覧[2]

        結果.append(通帳取引(
            日付=日付文字列, 摘要=摘要,
            出金額=出金額, 入金額=入金額, 残高=残高,
            口座コード=口座コード, 元テキスト=行,
        ))

    return 結果


# ============================================================
# 請求書PDF解析
# ============================================================
def 請求書PDF解析(PDFパス):
    """
    売上請求書PDFを解析。

    【カスタマイズポイント】
    請求書のレイアウトは会社ごとに大きく異なるため、
    Claude Codeに実物を見せてパターンを調整してもらう。
    """
    テキスト = PDFテキスト抽出(PDFパス)
    テーブル一覧 = PDFテーブル抽出(PDFパス)

    データ = 請求書データ(元テキスト=テキスト)

    # 日付抽出
    日付パターン = [
        r"(\d{4})[年/\-](\d{1,2})[月/\-](\d{1,2})",
        r"令和(\d+)年(\d{1,2})月(\d{1,2})日",
    ]
    for パターン in 日付パターン:
        m = re.search(パターン, テキスト)
        if m:
            グループ = m.groups()
            if "令和" in パターン:
                年 = int(グループ[0]) + 2018
                データ.日付 = f"{年}{int(グループ[1]):02d}{int(グループ[2]):02d}"
            else:
                データ.日付 = f"{グループ[0]}{int(グループ[1]):02d}{int(グループ[2]):02d}"
            break

    # インボイス番号（T+13桁）
    inv一致 = re.search(r"T\d{13}", テキスト)
    if inv一致:
        データ.インボイス番号 = inv一致.group(0)
        データ.適格請求書 = True

    # 合計金額
    合計パターン = [
        r"(?:合計|請求金額|御請求額|ご請求額)[^\d]*?([\d,]+)",
        r"([\d,]+)[^\d]*(?:円\s*$|円\s*\(税込\))",
    ]
    for パターン in 合計パターン:
        m = re.search(パターン, テキスト)
        if m:
            データ.合計金額 = int(m.group(1).replace(",", ""))
            break

    # 消費税額
    税額パターン = [
        r"(?:消費税|税額)[^\d]*?([\d,]+)",
        r"(?:うち消費税)[^\d]*?([\d,]+)",
    ]
    for パターン in 税額パターン:
        m = re.search(パターン, テキスト)
        if m:
            データ.消費税額 = int(m.group(1).replace(",", ""))
            break

    # 取引先名（「御中」「様」の前）
    取引先一致 = re.search(r"(.{2,20})\s*(?:御中|様)", テキスト)
    if 取引先一致:
        データ.取引先名 = 取引先一致.group(1).strip()

    # テーブルから明細行を抽出
    if テーブル一覧:
        for テーブル in テーブル一覧:
            for 行 in テーブル:
                if 行 and len(行) >= 3:
                    行内金額 = [_金額抽出(c) for c in 行 if c and _金額抽出(c) > 0]
                    if 行内金額:
                        品名 = next(
                            (c for c in 行 if c and not re.match(r"^[\d,.\s]+$", c)), ""
                        )
                        if 品名:
                            データ.明細一覧.append({"品名": 品名.strip(), "金額": max(行内金額)})

    return データ


# ============================================================
# 賃金台帳PDF解析
# ============================================================
def 賃金台帳PDF解析(PDFパス):
    """
    賃金台帳PDFを解析。

    【カスタマイズポイント】
    賃金台帳のフォーマットも会社ごとに異なるため、
    実物を見せて調整が必要。
    """
    テキスト = PDFテキスト抽出(PDFパス)
    テーブル一覧 = PDFテーブル抽出(PDFパス)

    結果 = []

    if テーブル一覧:
        結果 = _賃金台帳テーブル解析(テーブル一覧, テキスト)

    if not 結果:
        結果 = _賃金台帳テキスト解析(テキスト)

    return 結果


def _賃金台帳テーブル解析(テーブル一覧, 全テキスト):
    """テーブルから賃金データを抽出"""
    結果 = []
    for テーブル in テーブル一覧:
        for 行 in テーブル:
            if not 行 or len(行) < 5:
                continue
            名前 = None
            金額一覧 = []
            for セル in 行:
                if not セル:
                    continue
                金額 = _金額抽出(セル)
                if 金額 > 0:
                    金額一覧.append(金額)
                elif not 名前 and re.search(r"[ぁ-んァ-ヶ一-龥]", セル):
                    名前 = セル.strip()

            if 名前 and len(金額一覧) >= 3:
                結果.append(賃金台帳データ(
                    従業員名=名前, 支給合計=max(金額一覧), 元テキスト=str(行),
                ))

    return 結果


def _賃金台帳テキスト解析(テキスト):
    """テキストベースで賃金データを抽出"""
    結果 = []
    現在のエントリ = None

    for 行 in テキスト.split("\n"):
        行 = 行.strip()
        for キーワード, 属性名 in [
            ("基本給", "基本給"), ("残業", "残業代"), ("通勤", "通勤手当"),
            ("支給合計", "支給合計"), ("健康保険", "健康保険"), ("厚生年金", "厚生年金"),
            ("雇用保険", "雇用保険"), ("源泉", "源泉所得税"), ("所得税", "源泉所得税"),
            ("住民税", "住民税"), ("控除合計", "控除合計"), ("差引", "差引支給額"),
        ]:
            if キーワード in 行:
                m = re.search(r"([\d,]+)", 行)
                if m and 現在のエントリ:
                    setattr(現在のエントリ, 属性名, int(m.group(1).replace(",", "")))

    if 現在のエントリ:
        結果.append(現在のエントリ)

    return 結果


# ============================================================
# ユーティリティ
# ============================================================
def _日付正規化(日付文字列):
    """日付文字列をYYYYMMDD形式に正規化"""
    日付文字列 = 日付文字列.replace("/", "").replace("-", "")
    if len(日付文字列) == 4:  # MMDD
        日付文字列 = "2025" + 日付文字列
    elif len(日付文字列) == 6:  # YYMMDD
        日付文字列 = "20" + 日付文字列
    return 日付文字列


def _金額抽出(テキスト):
    """テキストから金額を抽出"""
    if not テキスト:
        return 0
    数字のみ = re.sub(r"[^\d]", "", str(テキスト))
    return int(数字のみ) if 数字のみ else 0


def _セルから日付検索(セル一覧):
    """セルリストから日付を探す"""
    for セル in セル一覧:
        if not セル:
            continue
        m = re.search(r"\d{4}[/\-]\d{1,2}[/\-]\d{1,2}|\d{1,2}[/\-]\d{1,2}", str(セル))
        if m:
            return _日付正規化(m.group(0))
    return ""


def _セルから摘要検索(セル一覧):
    """セルリストから摘要（日本語テキスト）を探す"""
    for セル in セル一覧:
        if not セル:
            continue
        セル = str(セル).strip()
        if (re.search(r"[ぁ-んァ-ヶ一-龥a-zA-Zａ-ｚＡ-Ｚ]", セル)
                and not re.match(r"^\d{4}[/\-]", セル)):
            return セル
    return ""
