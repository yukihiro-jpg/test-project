"""
PDF読み取りモジュール
通帳PDF・売上請求書PDF・賃金台帳PDFからデータを抽出する

事務所PCでClaude Codeに実際のPDFを見せて、このモジュールの
parse関数をカスタマイズしてもらう想定。
"""
import re
import os
from dataclasses import dataclass, field
from typing import Optional

try:
    import pdfplumber
    HAS_PDFPLUMBER = True
except ImportError:
    HAS_PDFPLUMBER = False

try:
    from PIL import Image
    import pytesseract
    HAS_OCR = True
except ImportError:
    HAS_OCR = False


@dataclass
class BankTransaction:
    """通帳1行分のデータ"""
    date: str              # YYYYMMDD
    tekiyo: str            # 摘要（カタカナ等）
    withdrawal: int = 0    # 出金額
    deposit: int = 0       # 入金額
    balance: int = 0       # 残高
    bank_code: str = ""    # 口座の科目コード（例: "131"）
    raw_text: str = ""     # 元のテキスト（デバッグ用）


@dataclass
class InvoiceData:
    """請求書1枚分のデータ"""
    date: str = ""              # 請求日 YYYYMMDD
    vendor: str = ""            # 取引先名
    total_amount: int = 0       # 合計金額
    tax_amount: int = 0         # 消費税額
    items: list = field(default_factory=list)  # [{品名, 数量, 単価, 金額, 税率}]
    invoice_number: str = ""    # インボイス番号（T+13桁）
    is_invoice: bool = False    # 適格請求書かどうか
    raw_text: str = ""


@dataclass
class PayrollEntry:
    """賃金台帳1人分のデータ"""
    employee_name: str = ""     # 従業員名
    period: str = ""            # 対象期間
    base_salary: int = 0        # 基本給
    overtime: int = 0           # 残業代
    commute: int = 0            # 通勤手当
    total_pay: int = 0          # 支給合計
    health_ins: int = 0         # 健康保険
    pension: int = 0            # 厚生年金
    employment_ins: int = 0     # 雇用保険
    income_tax: int = 0         # 源泉所得税
    resident_tax: int = 0       # 住民税
    total_deduction: int = 0    # 控除合計
    net_pay: int = 0            # 差引支給額
    raw_text: str = ""


def extract_text_from_pdf(pdf_path):
    """PDFからテキストを抽出（pdfplumber優先、失敗時はOCR）"""
    if not os.path.isfile(pdf_path):
        raise FileNotFoundError(f"PDFが見つかりません: {pdf_path}")

    text = ""

    # pdfplumberでテキスト抽出を試行
    if HAS_PDFPLUMBER:
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"

    # テキストが取れなかった場合、OCRにフォールバック
    if not text.strip() and HAS_OCR:
        text = _ocr_pdf(pdf_path)

    if not text.strip():
        raise RuntimeError(
            f"PDFからテキストを抽出できません: {pdf_path}\n"
            "pdfplumberまたはtesseract-ocrをインストールしてください。"
        )

    return text


def extract_tables_from_pdf(pdf_path):
    """PDFからテーブル構造を抽出"""
    if not HAS_PDFPLUMBER:
        return []

    tables = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            page_tables = page.extract_tables()
            if page_tables:
                tables.extend(page_tables)
    return tables


def _ocr_pdf(pdf_path):
    """OCRでPDFを読み取り"""
    try:
        from pdf2image import convert_from_path
        images = convert_from_path(pdf_path, dpi=300)
        texts = []
        for img in images:
            t = pytesseract.image_to_string(img, lang="jpn")
            texts.append(t)
        return "\n".join(texts)
    except ImportError:
        return ""


# ============================================================
# 通帳PDF解析
# ============================================================
def parse_passbook_pdf(pdf_path, bank_code=""):
    """
    通帳PDFを解析して取引リストを返す。

    【カスタマイズポイント】
    事務所PCで実際の通帳PDFをClaude Codeに見せて、
    この関数内のパターンを調整してもらう。
    銀行ごとにフォーマットが異なるため。

    Args:
        pdf_path: 通帳PDFのパス
        bank_code: この口座の科目コード（例: "131"）

    Returns:
        list[BankTransaction]
    """
    # ファイル名から口座コード推定（例: "131_常陽銀行普通.pdf"）
    if not bank_code:
        fname = os.path.basename(pdf_path)
        m = re.match(r"^(\d{2,4})", fname)
        if m:
            bank_code = m.group(1)

    text = extract_text_from_pdf(pdf_path)
    transactions = []

    # テーブル抽出を優先
    tables = extract_tables_from_pdf(pdf_path)
    if tables:
        transactions = _parse_passbook_tables(tables, bank_code)

    # テーブルが取れなければテキストベースで解析
    if not transactions:
        transactions = _parse_passbook_text(text, bank_code)

    return transactions


def _parse_passbook_tables(tables, bank_code):
    """テーブル構造から通帳データを抽出"""
    txs = []
    for table in tables:
        for row in table:
            if not row or len(row) < 4:
                continue
            # 日付列の検出（YYYY/MM/DD, MM/DD, etc.）
            date_str = _find_date_in_cells(row)
            if not date_str:
                continue

            # 金額列の検出
            amounts = [_parse_amount(cell) for cell in row if cell]
            tekiyo = _find_tekiyo_in_cells(row)

            # 出金・入金・残高の特定（位置ベース）
            numeric_cells = [(i, _parse_amount(cell)) for i, cell in enumerate(row)
                             if cell and _parse_amount(cell) > 0]

            if len(numeric_cells) >= 2 and tekiyo:
                # 一般的なパターン: ..., 摘要, 出金, 入金, 残高
                withdrawal = 0
                deposit = 0
                balance = 0
                if len(numeric_cells) == 2:
                    withdrawal = numeric_cells[0][1]
                    balance = numeric_cells[1][1]
                    if balance > withdrawal:
                        deposit = withdrawal
                        withdrawal = 0
                elif len(numeric_cells) >= 3:
                    withdrawal = numeric_cells[0][1]
                    deposit = numeric_cells[1][1]
                    balance = numeric_cells[2][1]

                txs.append(BankTransaction(
                    date=date_str,
                    tekiyo=tekiyo,
                    withdrawal=withdrawal,
                    deposit=deposit,
                    balance=balance,
                    bank_code=bank_code,
                    raw_text=str(row),
                ))
    return txs


def _parse_passbook_text(text, bank_code):
    """テキストベースで通帳データを抽出"""
    txs = []
    lines = text.split("\n")

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # 日付パターン検出
        date_match = re.search(
            r"(\d{4}[/\-]\d{1,2}[/\-]\d{1,2}|\d{1,2}[/\-]\d{1,2})", line
        )
        if not date_match:
            continue

        date_str = _normalize_date(date_match.group(1))

        # 金額パターン検出（カンマ区切りの数字）
        amounts = re.findall(r"[\d,]+\d", line)
        amounts = [int(a.replace(",", "")) for a in amounts if int(a.replace(",", "")) > 0]

        if len(amounts) < 1:
            continue

        # 日付と金額の間がおそらく摘要
        after_date = line[date_match.end():].strip()
        # 最初の金額の前までが摘要
        amount_match = re.search(r"[\d,]{2,}", after_date)
        tekiyo = after_date[:amount_match.start()].strip() if amount_match else after_date

        if not tekiyo:
            continue

        withdrawal = 0
        deposit = 0
        balance = 0

        if len(amounts) == 1:
            withdrawal = amounts[0]
        elif len(amounts) == 2:
            withdrawal = amounts[0]
            balance = amounts[1]
        elif len(amounts) >= 3:
            withdrawal = amounts[0]
            deposit = amounts[1]
            balance = amounts[2]

        txs.append(BankTransaction(
            date=date_str,
            tekiyo=tekiyo,
            withdrawal=withdrawal,
            deposit=deposit,
            balance=balance,
            bank_code=bank_code,
            raw_text=line,
        ))

    return txs


# ============================================================
# 請求書PDF解析
# ============================================================
def parse_invoice_pdf(pdf_path):
    """
    売上請求書PDFを解析。

    【カスタマイズポイント】
    請求書のレイアウトは会社ごとに大きく異なるため、
    Claude Codeに実物を見せてパターンを調整してもらう。
    """
    text = extract_text_from_pdf(pdf_path)
    tables = extract_tables_from_pdf(pdf_path)

    data = InvoiceData(raw_text=text)

    # 日付抽出
    date_patterns = [
        r"(\d{4})[年/\-](\d{1,2})[月/\-](\d{1,2})",
        r"令和(\d+)年(\d{1,2})月(\d{1,2})日",
    ]
    for pat in date_patterns:
        m = re.search(pat, text)
        if m:
            groups = m.groups()
            if "令和" in pat:
                year = int(groups[0]) + 2018
                data.date = f"{year}{int(groups[1]):02d}{int(groups[2]):02d}"
            else:
                data.date = f"{groups[0]}{int(groups[1]):02d}{int(groups[2]):02d}"
            break

    # インボイス番号（T+13桁）
    inv_match = re.search(r"T\d{13}", text)
    if inv_match:
        data.invoice_number = inv_match.group(0)
        data.is_invoice = True

    # 合計金額（「合計」「請求金額」の近くの金額）
    total_patterns = [
        r"(?:合計|請求金額|御請求額|ご請求額)[^\d]*?([\d,]+)",
        r"([\d,]+)[^\d]*(?:円\s*$|円\s*\(税込\))",
    ]
    for pat in total_patterns:
        m = re.search(pat, text)
        if m:
            data.total_amount = int(m.group(1).replace(",", ""))
            break

    # 消費税額
    tax_patterns = [
        r"(?:消費税|税額)[^\d]*?([\d,]+)",
        r"(?:うち消費税)[^\d]*?([\d,]+)",
    ]
    for pat in tax_patterns:
        m = re.search(pat, text)
        if m:
            data.tax_amount = int(m.group(1).replace(",", ""))
            break

    # 取引先名（「御中」「様」の前）
    vendor_match = re.search(r"(.{2,20})\s*(?:御中|様)", text)
    if vendor_match:
        data.vendor = vendor_match.group(1).strip()

    # テーブルから明細行を抽出
    if tables:
        for table in tables:
            for row in table:
                if row and len(row) >= 3:
                    # 金額を含む行を明細と判定
                    amounts_in_row = [
                        _parse_amount(c) for c in row if c and _parse_amount(c) > 0
                    ]
                    if amounts_in_row:
                        item_name = next(
                            (c for c in row if c and not re.match(r"^[\d,.\s]+$", c)),
                            "",
                        )
                        if item_name:
                            data.items.append({
                                "品名": item_name.strip(),
                                "金額": max(amounts_in_row),
                            })

    return data


# ============================================================
# 賃金台帳PDF解析
# ============================================================
def parse_payroll_pdf(pdf_path):
    """
    賃金台帳PDFを解析。

    【カスタマイズポイント】
    賃金台帳のフォーマットも会社ごとに異なるため、
    実物を見せて調整が必要。
    """
    text = extract_text_from_pdf(pdf_path)
    tables = extract_tables_from_pdf(pdf_path)

    entries = []

    # テーブルベースの解析を優先
    if tables:
        entries = _parse_payroll_tables(tables, text)

    # テーブルが取れない場合はテキストベース
    if not entries:
        entries = _parse_payroll_text(text)

    return entries


def _parse_payroll_tables(tables, full_text):
    """テーブルから賃金データを抽出"""
    entries = []
    for table in tables:
        for row in table:
            if not row or len(row) < 5:
                continue
            # 名前列と金額列がある行を探す
            name = None
            amounts = []
            for cell in row:
                if not cell:
                    continue
                amt = _parse_amount(cell)
                if amt > 0:
                    amounts.append(amt)
                elif not name and re.search(r"[ぁ-んァ-ヶ一-龥]", cell):
                    name = cell.strip()

            if name and len(amounts) >= 3:
                entry = PayrollEntry(
                    employee_name=name,
                    total_pay=max(amounts),
                    raw_text=str(row),
                )
                entries.append(entry)

    return entries


def _parse_payroll_text(text):
    """テキストベースで賃金データを抽出"""
    entries = []
    # 基本的なパターンマッチング（実物に合わせて要調整）
    lines = text.split("\n")
    current_entry = None

    for line in lines:
        line = line.strip()
        # 「基本給」「支給合計」などのキーワードで金額を取得
        for keyword, attr in [
            ("基本給", "base_salary"),
            ("残業", "overtime"),
            ("通勤", "commute"),
            ("支給合計", "total_pay"),
            ("健康保険", "health_ins"),
            ("厚生年金", "pension"),
            ("雇用保険", "employment_ins"),
            ("源泉", "income_tax"),
            ("所得税", "income_tax"),
            ("住民税", "resident_tax"),
            ("控除合計", "total_deduction"),
            ("差引", "net_pay"),
        ]:
            if keyword in line:
                m = re.search(r"([\d,]+)", line)
                if m and current_entry:
                    setattr(current_entry, attr, int(m.group(1).replace(",", "")))

    if current_entry:
        entries.append(current_entry)

    return entries


# ============================================================
# ユーティリティ
# ============================================================
def _normalize_date(date_str):
    """日付文字列をYYYYMMDD形式に正規化"""
    date_str = date_str.replace("/", "").replace("-", "")
    if len(date_str) == 4:  # MMDD
        date_str = "2025" + date_str
    elif len(date_str) == 6:  # YYMMDD
        date_str = "20" + date_str
    return date_str


def _parse_amount(text):
    """テキストから金額を抽出"""
    if not text:
        return 0
    cleaned = re.sub(r"[^\d]", "", str(text))
    return int(cleaned) if cleaned else 0


def _find_date_in_cells(cells):
    """セルリストから日付を探す"""
    for cell in cells:
        if not cell:
            continue
        m = re.search(r"\d{4}[/\-]\d{1,2}[/\-]\d{1,2}|\d{1,2}[/\-]\d{1,2}", str(cell))
        if m:
            return _normalize_date(m.group(0))
    return ""


def _find_tekiyo_in_cells(cells):
    """セルリストから摘要（日本語テキスト）を探す"""
    for cell in cells:
        if not cell:
            continue
        cell = str(cell).strip()
        # 日付でも数字だけでもない、テキストを含むセル
        if (re.search(r"[ぁ-んァ-ヶ一-龥a-zA-Zａ-ｚＡ-Ｚ]", cell)
                and not re.match(r"^\d{4}[/\-]", cell)):
            return cell
    return ""
