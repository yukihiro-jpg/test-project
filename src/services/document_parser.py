"""書類パーサー.

謄本（全部事項証明書）、固定資産評価証明書（課税明細書）、農地台帳の
PDFからテキストを抽出し、不動産情報を構造化する。

Claude API消費を最小化するため、すべてルールベース（正規表現+pdfplumber）で抽出。
"""

from __future__ import annotations

import logging
import re
from fractions import Fraction
from pathlib import Path
from typing import Optional

import pdfplumber

from ..models import (
    FloorArea,
    KoteiShisanBuilding,
    KoteiShisanLand,
    NochiDaicho,
    OtherRightEntry,
    OwnershipEntry,
    OwnershipResult,
    TohonBuilding,
    TohonLand,
)

logger = logging.getLogger(__name__)

PREFECTURES = [
    "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
    "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
    "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
    "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
    "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
    "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
    "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
]

CHIMOKU_PATTERN = r"(宅地|田|畑|山林|原野|雑種地|墓地|境内地|公衆用道路|鉱泉地|池沼|牧場|保安林)"

# 全角→半角マッピング
_ZEN_DIGITS = str.maketrans("０１２３４５６７８９／", "0123456789/")


# ------------------------------------------------------------------
# ユーティリティ
# ------------------------------------------------------------------
def _zen_to_han(text: str) -> str:
    """全角数字・スラッシュを半角に変換."""
    return text.translate(_ZEN_DIGITS)


def _parse_share_fraction(share_str: str) -> Optional[Fraction]:
    """持分文字列を Fraction に変換.

    "2分の1" → Fraction(1, 2)
    "3分の2" → Fraction(2, 3)
    "1/4"    → Fraction(1, 4)
    ""       → None
    """
    if not share_str:
        return None

    s = _zen_to_han(share_str.strip())

    # "N分のM" パターン
    m = re.match(r"(\d+)分の(\d+)", s)
    if m:
        denom = int(m.group(1))
        numer = int(m.group(2))
        if denom > 0:
            return Fraction(numer, denom)
        return None

    # "M/N" パターン
    m = re.match(r"(\d+)/(\d+)", s)
    if m:
        numer = int(m.group(1))
        denom = int(m.group(2))
        if denom > 0:
            return Fraction(numer, denom)
        return None

    return None


def _normalize_name(s: str) -> str:
    """人名から空白(全角/半角)を除去."""
    if not s:
        return ""
    return re.sub(r"[\s　]+", "", s)


def _parse_number(s: str) -> Optional[float]:
    """数値文字列→float変換."""
    try:
        cleaned = _zen_to_han(s).replace(",", "").replace("，", "").strip()
        return float(cleaned) if cleaned else None
    except ValueError:
        return None


def _parse_int(s: str) -> Optional[int]:
    """数値文字列→int変換."""
    try:
        cleaned = _zen_to_han(s).replace(",", "").replace("，", "").replace(" ", "").strip()
        return int(cleaned) if cleaned else None
    except ValueError:
        return None


def _extract_text(file_path: Path) -> str:
    """ファイルからテキストを抽出."""
    suffix = file_path.suffix.lower()
    if suffix == ".pdf":
        try:
            with pdfplumber.open(file_path) as pdf:
                return "\n".join(page.extract_text() or "" for page in pdf.pages)
        except Exception as e:
            logger.error("PDF読み込みエラー (%s): %s", file_path.name, e)
            return ""
    elif suffix in (".txt", ".csv"):
        return file_path.read_text(encoding="utf-8", errors="replace")
    else:
        logger.warning("未対応のファイル形式: %s", suffix)
        return ""


def _extract_tohon_text_with_underlines(file_path: Path) -> tuple[str, set[int]]:
    """謄本PDF用: テキスト + 下線(抹消)行インデックスを抽出.

    謄本には「＊ 下線のあるものは抹消事項であることを示す。」とあり、
    下線付きの 地番/地目/地積 は古い値（抹消済み）を意味する。
    pdfplumber の page.lines から水平下線を検出し、下線の直上にある
    文字を含むテキスト行を抹消行として返す。

    Returns:
        (text, underlined_lines)
        text: ページを "\n" で連結したテキスト
        underlined_lines: text.splitlines() したときの抹消行インデックス集合
    """
    suffix = file_path.suffix.lower()
    if suffix != ".pdf":
        return _extract_text(file_path), set()

    all_lines: list[str] = []
    underlined: set[int] = set()
    try:
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                # 水平下線（y0==y1）を抽出
                h_lines = [
                    ln for ln in page.lines if abs(ln["y0"] - ln["y1"]) < 0.5
                ]

                # 下線付き文字の (x0, y0) 集合を構築
                under_pos: set[tuple[float, float]] = set()
                if h_lines:
                    for c in page.chars:
                        cy0 = c["y0"]
                        for ln in h_lines:
                            ly = ln["y0"]
                            # 下線は文字ベースラインから 0〜3pt 下に引かれる
                            if -1 < (cy0 - ly) < 3:
                                if not (ln["x1"] < c["x0"] or ln["x0"] > c["x1"]):
                                    under_pos.add(
                                        (round(c["x0"], 1), round(c["y0"], 1))
                                    )
                                    break

                # 行単位でテキスト抽出 (chars付き) → 各行の下線有無を判定
                try:
                    text_lines = page.extract_text_lines()
                except Exception:
                    text_lines = []

                if text_lines:
                    for tl in text_lines:
                        line_text = tl.get("text", "")
                        chars = tl.get("chars", [])
                        has_u = False
                        if under_pos:
                            for c in chars:
                                key = (round(c["x0"], 1), round(c["y0"], 1))
                                if key in under_pos:
                                    has_u = True
                                    break
                        idx = len(all_lines)
                        all_lines.append(line_text)
                        if has_u:
                            underlined.add(idx)
                else:
                    # フォールバック
                    text = page.extract_text() or ""
                    for line in text.splitlines():
                        all_lines.append(line)
    except Exception as e:
        logger.error("PDF読み込みエラー (%s): %s", file_path.name, e)
        return "", set()

    return "\n".join(all_lines), underlined


# ------------------------------------------------------------------
# 住所解析
# ------------------------------------------------------------------
def extract_address_parts(text: str) -> dict[str, str]:
    """テキストから都道府県・市区町村・町名を抽出."""
    result: dict[str, str] = {"prefecture": "", "city": "", "town": ""}

    for pref in PREFECTURES:
        if pref in text:
            result["prefecture"] = pref
            idx = text.index(pref) + len(pref)
            remaining = text[idx:].strip()
            m = re.match(r"(.+?[市郡])(.+?[区町村])?", remaining)
            if m:
                result["city"] = m.group(1)
                if m.group(2):
                    result["city"] += m.group(2)
                rest = remaining[m.end():]
            else:
                m = re.match(r"(.+?区)", remaining)
                if m:
                    result["city"] = m.group(1)
                    rest = remaining[m.end():]
                else:
                    rest = remaining
            m2 = re.match(r"([^\d]+?[町丁])", rest)
            if m2:
                result["town"] = m2.group(1)
            elif rest:
                m2 = re.match(r"(大字\S+)", rest)
                if m2:
                    result["town"] = m2.group(1)
            break

    return result


def detect_prefecture_from_properties(properties: list) -> str:
    """抽出済み物件リストから都道府県を検出."""
    for prop in properties:
        location = getattr(prop, "location", "")
        chiban = getattr(prop, "chiban", "")
        parts = extract_address_parts(location + " " + chiban)
        if parts["prefecture"]:
            return parts["prefecture"]
    return ""


def detect_city_from_properties(properties: list) -> str:
    """抽出済み物件リストから市区町村を検出."""
    for prop in properties:
        location = getattr(prop, "location", "")
        chiban = getattr(prop, "chiban", "")
        parts = extract_address_parts(location + " " + chiban)
        if parts["city"]:
            return parts["city"]
    return ""


# ------------------------------------------------------------------
# 謄本（全部事項証明書）パーサー
# ------------------------------------------------------------------
def parse_tohon(file_path: Path) -> tuple[list[TohonLand], list[TohonBuilding]]:
    """謄本PDFから土地・建物情報を抽出."""
    lands: list[TohonLand] = []
    buildings: list[TohonBuilding] = []

    # 謄本は抹消事項が「下線」で示されるため、下線付き行(=旧情報)を
    # 識別した上でパースする。
    text, underlined_lines = _extract_tohon_text_with_underlines(file_path)
    if not text:
        return lands, buildings

    text_han = _zen_to_han(text)

    # --- 土地 ---
    # 謄本PDFは表形式で区切り文字が混在:
    #   |  (U+007C ASCII pipe)
    #   ｜ (U+FF5C 全角)
    #   │ (U+2502 BOX DRAWINGS LIGHT VERTICAL)
    #   ┃ (U+2503 BOX DRAWINGS HEAVY VERTICAL, 外枠)
    # 扱いやすいように縦線類を "|" に統一する。
    SEP_CHARS = "|｜│┃"
    sep_trans = str.maketrans({c: "|" for c in SEP_CHARS})
    text_norm = text.translate(sep_trans)

    # 抹消行には \ue042-\ue044 の私用領域文字が含まれるケースもある。
    STRIKE_CHARS = "\ue042\ue043\ue044"

    def _has_strike(s: str) -> bool:
        return any(c in s for c in STRIKE_CHARS)

    lines = text_norm.splitlines()

    # 所在（抹消されていない最新の行）
    location = ""
    for i, line in enumerate(lines):
        # 「所 在|水戸市加倉井町字西田 |...」
        m = re.search(r"所\s*在\s*\|\s*([^|]+?)\s*\|", line)
        if m:
            loc = m.group(1).strip()
            # 下線(抹消)行はスキップ
            if i in underlined_lines:
                continue
            if loc and not _has_strike(loc):
                location = loc
                break
            # 最後のフォールバック用
            if loc and not location:
                location = loc

    # 表題部の表データ：①地番 ②地目 ③地積 のヘッダ以降を走査
    header_idx = -1
    for i, line in enumerate(lines):
        if ("地" in line and "番" in line and "目" in line and "積" in line
                and ("①" in line or "地　番" in line or "地 番" in line)):
            header_idx = i
            break

    land_rows: list[tuple[str, str, Optional[float]]] = []
    chimoku_re = CHIMOKU_PATTERN  # (宅地|田|...)
    if header_idx >= 0:
        for li, line in enumerate(lines[header_idx + 1:], start=header_idx + 1):
            # 権利部（甲区）に達したら終了
            if "権" in line and "利" in line and "部" in line:
                break
            # 下線付き(=抹消済み)行は完全にスキップ
            if li in underlined_lines:
                continue
            # 抹消行の判定は地番列のみで行う（原因欄の抹消記号は無視）
            # 地番は半角/全角数字どちらもありうるので両対応。
            # 例: "┃２２７９番 │田 │ １５３４： │..." → 正規化後
            #     "|２２７９番 |田 | １５３４： |..."
            row = re.search(
                r"([\d０-９]+番(?:[\d０-９]+)?)\s*\|\s*(" + chimoku_re[1:-1] + r")\s*\|\s*([\d\s,，:：.０-９]+?)\s*\|",
                line,
            )
            if row:
                chiban = _zen_to_han(row.group(1))
                chimoku = row.group(2)
                area_raw = _zen_to_han(row.group(3)).replace(" ", "").replace(",", "")
                # 謄本の地積欄は「整数:小数」のように「:」で区切られることがある
                area_raw = area_raw.replace("：", ":")
                if ":" in area_raw:
                    whole, _, frac = area_raw.partition(":")
                    if frac and frac.isdigit():
                        area_str = f"{whole}.{frac}"
                    else:
                        area_str = whole
                else:
                    area_str = area_raw
                area = _parse_number(area_str)
                land_rows.append((chiban, chimoku, area))

    # 甲区・乙区
    ownership = _parse_kou_section(text)
    other_rights = _parse_otsu_section(text)

    if land_rows:
        for chiban, chimoku, area in land_rows:
            land = TohonLand(source_file=file_path.name)
            land.location = location
            land.chiban = chiban
            land.chimoku_registry = chimoku
            land.area_registry_sqm = area
            land.ownership_history = ownership
            land.other_rights = other_rights
            lands.append(land)
    else:
        # フォールバック：旧パターン
        land = TohonLand(source_file=file_path.name)
        land.location = location
        m = re.search(r"地番[　\s]*[：:]?[　\s]*(.+?)(?:\n|$)", text)
        if m:
            land.chiban = m.group(1).strip()
        m = re.search(r"地目[　\s]*[：:]?[　\s]*" + CHIMOKU_PATTERN, text)
        if m:
            land.chimoku_registry = m.group(1).strip()
        m = re.search(r"地積[　\s]*[：:]?[　\s]*([\d.,，０-９]+)\s*[㎡m²]?", text_han)
        if m:
            land.area_registry_sqm = _parse_number(m.group(1))
        land.ownership_history = ownership
        land.other_rights = other_rights
        if land.location or land.chiban:
            lands.append(land)

    # --- 建物（家屋番号がある場合）---
    if re.search(r"家屋番号", text):
        bld = TohonBuilding(source_file=file_path.name)
        bld.location = land.location
        m = re.search(r"家屋番号[　\s]*[：:]?[　\s]*(.+?)(?:\n|$)", text)
        if m:
            bld.kaoku_bango = m.group(1).strip()
        m = re.search(r"種類[　\s]*[：:]?[　\s]*(.+?)(?:\n|$)", text)
        if m:
            bld.kind = m.group(1).strip()
        m = re.search(r"構造[　\s]*[：:]?[　\s]*(.+?)(?:\n|$)", text)
        if m:
            bld.structure = m.group(1).strip()

        # 階別床面積
        bld.floor_areas = _parse_floor_areas(text_han)

        # 建物にも甲区・乙区がある場合
        bld.ownership_history = land.ownership_history  # 同一謄本なら共有
        bld.other_rights = land.other_rights
        buildings.append(bld)

    return lands, buildings


def _parse_kou_section(text: str) -> list[OwnershipEntry]:
    """甲区（所有権に関する事項）を解析.

    謄本の表形式PDFを前提に、罫線を | に正規化してから
    4列(順位番号 | 登記の目的 | 受付年月日・受付番号 | 権利者その他の事項)
    として読み、順位番号ごとにエントリを構築する。

    抹消(下線)行は parse_tohon 側で既に除外済みの text を受け取る想定だが、
    この関数単体でも動くようにしている。
    """
    entries: list[OwnershipEntry] = []
    if not text:
        return entries

    lines = text.splitlines()

    def _compact(s: str) -> str:
        return re.sub(r"[\s　]+", "", s)

    # --- 甲区セクションの範囲特定 ---
    start = -1
    end = len(lines)
    for i, line in enumerate(lines):
        c = _compact(line)
        if "甲区" in c and ("権利部" in c or "所有権" in c):
            start = i
            break
    if start < 0:
        return entries
    for i in range(start + 1, len(lines)):
        c = _compact(lines[i])
        if "乙区" in c and ("権利部" in c or "所有権以外" in c):
            end = i
            break

    # --- 各行を4列に正規化 ---
    sep_trans = str.maketrans({c: "|" for c in "|｜│┃"})
    border_re = re.compile(r"^[─━┠┨┼╂┯┷┏┓┗┛┳┻\s　]*$")
    STRIKE_CHARS = "\ue042\ue043\ue044"

    rows: list[list[str]] = []
    for raw in lines[start + 1 : end]:
        if border_re.match(raw):
            continue
        # 抹消記号しか持たないセルは空扱い
        cleaned = raw.translate(sep_trans)
        parts = cleaned.split("|")
        if len(parts) < 2:
            continue
        # 外枠1つ分の空列を除去
        if parts and parts[0].strip() == "":
            parts = parts[1:]
        if parts and parts[-1].strip() == "":
            parts = parts[:-1]
        if len(parts) < 4:
            continue
        if len(parts) > 4:
            parts = parts[:3] + ["|".join(parts[3:])]
        # 各セルから抹消記号を除去
        stripped = []
        for p in parts:
            s = p.strip()
            for ch in STRIKE_CHARS:
                s = s.replace(ch, "")
            stripped.append(s.strip())
        rows.append(stripped)

    # --- 順位番号ごとにブロック分け ---
    blocks: list[list[list[str]]] = []
    current: list[list[str]] = []
    for cols in rows:
        rank_han = _zen_to_han(cols[0])
        if re.fullmatch(r"\d+", rank_han):
            if current:
                blocks.append(current)
            current = [cols]
        elif current:
            current.append(cols)
    if current:
        blocks.append(current)

    for block in blocks:
        block_entries = _parse_kou_block(block)
        entries.extend(block_entries)

    return entries


def _parse_kou_block(block: list[list[str]]) -> list[OwnershipEntry]:
    """順位番号1つ分のブロック(複数行×4列)から OwnershipEntry 群を構築.

    共有者が複数名いる場合は持分＋氏名の組をそれぞれ独立したエントリとして返す。
    単独所有者の場合は長さ1のリストを返す。
    """
    if not block:
        return []

    purpose_col = " ".join(row[1] for row in block if len(row) > 1 and row[1])
    receipt_col = " ".join(row[2] for row in block if len(row) > 2 and row[2])
    rights_lines = [row[3] for row in block if len(row) > 3 and row[3]]

    # --- 登記種別 ---
    entry_type = ""
    tm = re.search(
        r"(所有権保存|所有権移転|共有者全員持分全部移転|持分全部移転|持分一部移転|持分移転)",
        purpose_col,
    )
    if tm:
        entry_type = tm.group(1)

    # --- 受付年月日 ---
    registration_date = ""
    receipt_han = _zen_to_han(receipt_col)
    rm = re.search(r"((?:令和|平成|昭和)\d+年\d+月\d+日)", receipt_han)
    if rm:
        registration_date = rm.group(1)

    # --- 原因 ---
    cause = ""
    cause_date = ""
    rights_han = _zen_to_han(" ".join(rights_lines))
    cm = re.search(
        r"原因[　\s]*((?:令和|平成|昭和)\d+年\d+月\d+日)?\s*"
        r"(売買|相続|贈与|遺贈|交換|共有物分割|遺産分割|分割|錯誤|判決|調停)?",
        rights_han,
    )
    if cm:
        parts = []
        if cm.group(1):
            cause_date = cm.group(1)
            parts.append(cause_date)
        if cm.group(2):
            parts.append(cm.group(2))
        if parts:
            cause = " ".join(parts)

    # --- 所有者・共有者の氏名/持分を抽出 ---
    owners = _parse_owners_from_rights_lines(rights_lines)

    # 氏名が1件も取れない場合でも、登記種別だけでエントリを作る
    if not owners:
        entry = OwnershipEntry()
        entry.entry_type = entry_type
        entry.registration_date = registration_date
        entry.cause = cause
        entry.cause_date = cause_date
        return [entry] if (entry.entry_type or entry.cause) else []

    result: list[OwnershipEntry] = []
    for share, name in owners:
        entry = OwnershipEntry()
        entry.entry_type = entry_type
        entry.registration_date = registration_date
        entry.cause = cause
        entry.cause_date = cause_date
        entry.share = share
        entry.owner_name = name
        result.append(entry)
    return result


# 氏名抽出のヒューリスティック用定数
_FOOTER_WORDS = (
    "移記", "規定", "省令", "附則", "順位", "原因", "売買", "相続",
    "贈与", "遺贈", "交換", "錯誤", "判決", "調停", "年月日", "受付",
    "番号", "共有物分割", "遺産分割", "記載", "申告",
)
_ADDRESS_WORDS = (
    "市", "郡", "町", "村", "区", "番地", "丁目", "字",
)
_CORPORATE_RE = re.compile(
    r"財団法人|社団法人|株式会社|有限会社|合同会社|一般法人|公社|協同組合|学校法人|宗教法人"
)


def _is_name_line(line: str) -> bool:
    """その行が個人/法人の氏名候補であるか判定."""
    c = _normalize_name(line)
    if not c or len(c) < 2:
        return False
    if re.search(r"[\d０-９]", c):
        return False
    if any(w in c for w in _FOOTER_WORDS):
        return False
    if _CORPORATE_RE.search(c):
        return True
    if any(w in c for w in _ADDRESS_WORDS):
        return False
    return True


def _parse_owners_from_rights_lines(lines: list[str]) -> list[tuple[str, str]]:
    """権利者列の行リストから (持分, 氏名) のタプルリストを抽出.

    謄本甲区の典型構造:
        原因 ...
        所有者 <住所>
         <氏名>
        順位X番の登記を移記

    または共有者の場合:
        共有者 <住所>
            持分 <分数>
             <氏名1>
            <住所>
            持分 <分数>
             <氏名2>

    行単位で「所有者/共有者」ラベルの後続行から、住所語・数字・フッタ語を
    含まない行を氏名として採用する。
    """
    results: list[tuple[str, str]] = []
    in_owner_section = False
    current_share = ""

    for raw in lines:
        line = raw.strip()
        if not line:
            continue

        # 「所有者」「共有者」ラベル行 → セクション開始
        if re.search(r"所有者|共有者", line):
            in_owner_section = True
            sm = re.search(
                r"持分[　\s]*([\d０-９]+分の[\d０-９]+|[\d０-９]+/[\d０-９]+)",
                line,
            )
            current_share = _zen_to_han(sm.group(1)) if sm else ""

            # 行内に「所有者 <名前>」とインライン記載されているケース
            after = re.sub(r".*?(?:所有者|共有者)[　\s]*", "", line)
            after = re.sub(
                r"持分[　\s]*[\d０-９]+分の[\d０-９]+[　\s]*", "", after
            )
            after = re.sub(
                r"持分[　\s]*[\d０-９]+/[\d０-９]+[　\s]*", "", after
            )
            after = after.strip()
            if after and _is_name_line(after):
                results.append((current_share, _normalize_name(after)))
                # インラインで氏名が取れたらセクション継続(次の住所/持分用)
            continue

        if not in_owner_section:
            continue

        # 行内の持分記載を拾う(住所と持分が別行のケース)
        sm = re.search(
            r"持分[　\s]*([\d０-９]+分の[\d０-９]+|[\d０-９]+/[\d０-９]+)",
            line,
        )
        if sm:
            current_share = _zen_to_han(sm.group(1))
            remainder = re.sub(
                r"持分[　\s]*[\d０-９]+分の[\d０-９]+", "", line
            )
            remainder = re.sub(
                r"持分[　\s]*[\d０-９]+/[\d０-９]+", "", remainder
            ).strip()
            if remainder and _is_name_line(remainder):
                results.append((current_share, _normalize_name(remainder)))
            continue

        # 氏名行か?
        if _is_name_line(line):
            results.append((current_share, _normalize_name(line)))

    return results


def _parse_otsu_section(text: str) -> list[OtherRightEntry]:
    """乙区（所有権以外の権利に関する事項）を解析."""
    entries: list[OtherRightEntry] = []

    otsu_match = re.search(
        r"乙\s*区[　\s]*[\(（]?\s*所有権以外[^)）]*[\)）]?(.+?)$",
        text, re.DOTALL,
    )
    if not otsu_match:
        return entries

    otsu_text = otsu_match.group(1)

    # 権利種別を検出
    for right_match in re.finditer(
        r"(抵当権|根抵当権|地上権|賃借権|永小作権|地役権|質権|先取特権)[　\s]*(設定|移転|変更|抹消)?",
        otsu_text,
    ):
        entry = OtherRightEntry()
        entry.right_type = right_match.group(1)
        if right_match.group(2):
            entry.right_type += right_match.group(2)

        # 前後のテキストから詳細を抽出
        start = max(0, right_match.start() - 200)
        end = min(len(otsu_text), right_match.end() + 300)
        context = otsu_text[start:end]

        date_m = re.search(
            r"(?:受付|登記)[　\s]*[：:]?[　\s]*((?:令和|平成|昭和)\d+年\d+月\d+日)",
            context,
        )
        if date_m:
            entry.registration_date = date_m.group(1)

        holder_m = re.search(r"(?:権利者|債権者)[　\s]*[：:]?[　\s]*(.+?)(?:\n|$)", context)
        if holder_m:
            entry.holder = holder_m.group(1).strip()

        entries.append(entry)

    return entries


def _parse_floor_areas(text: str) -> list[FloorArea]:
    """建物の階別床面積を抽出."""
    areas: list[FloorArea] = []
    for m in re.finditer(r"(地?下?\d+階)[　\s]*([\d.,]+)\s*[㎡m²]?", text):
        area = FloorArea(
            floor=m.group(1),
            area_sqm=_parse_number(m.group(2)),
        )
        areas.append(area)
    return areas


# ------------------------------------------------------------------
# 持分計算
# ------------------------------------------------------------------
def calculate_ownership(
    ownership_history: list[OwnershipEntry],
    target_name: str,
    reference_date: str,
) -> OwnershipResult:
    """甲区の所有権履歴から基準日時点の対象者の持分を算出.

    ロジック:
    1. 各エントリを時系列で処理
    2. entry_type に応じて持分を追跡:
       - 所有権保存/移転: 新所有者が全部取得（持分指定なし=単独所有）
       - 持分全部/一部移転: 指定された持分が移転
    3. 同じ順位番号内の共有者は同一登記として複数エントリになっている
       可能性がある(持分合算)。
    4. 氏名比較は空白を無視して部分一致。
    """
    result = OwnershipResult(
        target_name=target_name,
        reference_date=reference_date,
    )

    if not ownership_history:
        return result

    target_norm = _normalize_name(target_name) if target_name else ""

    # 順位番号(registration_date+entry_type)でグルーピングして
    # 同じ登記イベントに属する共有者エントリをまとめる。
    # 簡易化のため連続するエントリを同一グループとみなす:
    #   同じ registration_date & entry_type ならグループ
    target_share: Optional[Fraction] = None  # None=未判定
    history_lines: list[str] = []

    def _event_key(e: OwnershipEntry) -> tuple[str, str]:
        return (e.registration_date or "", e.entry_type or "")

    grouped: list[list[OwnershipEntry]] = []
    for entry in ownership_history:
        if grouped and _event_key(grouped[-1][0]) == _event_key(entry):
            grouped[-1].append(entry)
        else:
            grouped.append([entry])

    for group in grouped:
        first = group[0]
        # 履歴サマリー (グループ単位で1行)
        summary_parts: list[str] = []
        if first.registration_date:
            summary_parts.append(first.registration_date)
        if first.cause:
            summary_parts.append(first.cause)
        if first.entry_type:
            summary_parts.append(f"[{first.entry_type}]")
        if group:
            names = []
            for e in group:
                disp = e.owner_name or ""
                if e.share:
                    disp = f"{disp}(持分{e.share})"
                if disp:
                    names.append(disp)
            if names:
                summary_parts.append("→ " + " / ".join(names))
        summary = " ".join(summary_parts).strip()
        if summary:
            history_lines.append(summary)

        is_full_transfer = first.entry_type in (
            "所有権保存", "所有権移転", "共有者全員持分全部移転",
        )
        is_share_transfer = first.entry_type in (
            "持分全部移転", "持分一部移転", "持分移転",
        )

        # グループ内で target_name にマッチするエントリの持分を合算
        target_matched_share: Optional[Fraction] = None
        other_has_entry = False
        for e in group:
            owner_norm = _normalize_name(e.owner_name)
            if target_norm and owner_norm and target_norm in owner_norm:
                # 持分指定があればそれを使い、無ければ 1/1 (単独所有)
                if e.share:
                    share_frac = _parse_share_fraction(e.share)
                    if share_frac is not None:
                        if target_matched_share is None:
                            target_matched_share = share_frac
                        else:
                            target_matched_share += share_frac
                else:
                    target_matched_share = Fraction(1, 1)
            elif e.owner_name:
                other_has_entry = True

        if target_matched_share is not None:
            # 対象者がこの登記で所有権/持分を取得
            if is_share_transfer:
                # 持分一部移転: 既存持分に加算
                target_share = (target_share or Fraction(0, 1)) + target_matched_share
                if target_share > Fraction(1, 1):
                    target_share = Fraction(1, 1)
            else:
                # 所有権移転/保存: 新規取得で上書き
                target_share = target_matched_share
        elif is_full_transfer and other_has_entry:
            # 対象者以外に全部移転 → 対象者の持分消滅
            target_share = Fraction(0, 1)
        # is_share_transfer で対象者が関与していない場合は既存持分維持

    result.history_summary = history_lines

    # 結果をセット
    if target_share is None:
        result.current_share = ""
        result.share_fraction = None
    elif target_share == Fraction(0, 1):
        result.current_share = "所有権なし"
        result.share_fraction = 0.0
    elif target_share == Fraction(1, 1):
        result.current_share = "単独所有"
        result.share_fraction = 1.0
    else:
        result.current_share = f"{target_share.denominator}分の{target_share.numerator}"
        result.share_fraction = float(target_share)

    return result


# ------------------------------------------------------------------
# 固定資産評価証明/課税明細書パーサー
# ------------------------------------------------------------------
# 固定資産評価証明の所在+地番パターン
#   例: "愛宕町1", "袴塚1丁目2037-5", "中原町32-1"
_KOTEI_LOC_RE = re.compile(
    r"([\u4e00-\u9fffぁ-んァ-ヶ]{1,6}町(?:[\d０-９]+丁目)?)([\d０-９]+(?:[-－][\d０-９]+)?)"
)


def parse_kotei_shisan(
    file_path: Path,
) -> tuple[list[KoteiShisanLand], list[KoteiShisanBuilding]]:
    """固定資産評価証明/課税明細書PDFから土地・建物情報を抽出.

    スキャン+OCRのPDFが多く、ラベル付き形式とは限らないため、
    以下の2パスで抽出を試みる:

    1. ラベル付き形式（"所在:", "地番:", "地積:" 等）
    2. 表形式（町名+地番 + 周辺テキストから地目・面積・評価額を推定）

    OCR品質が低い場合は一部または全ての値が不正確になりうる。
    呼び出し側で手動検証を促す注記を追加することを推奨。
    """
    lands: list[KoteiShisanLand] = []
    buildings: list[KoteiShisanBuilding] = []

    text = _extract_text(file_path)
    if not text:
        return lands, buildings

    text_han = _zen_to_han(text)

    # ---------------- パス1: ラベル付き形式 ----------------
    labeled_land = KoteiShisanLand(source_file=file_path.name)
    m = re.search(r"所在[　\s]*[：:]\s*(.+?)(?:\n|$)", text)
    if m:
        labeled_land.location = m.group(1).strip()
    m = re.search(r"地番[　\s]*[：:]\s*(.+?)(?:\n|$)", text)
    if m:
        labeled_land.chiban = m.group(1).strip()
    m = re.search(r"(?:課税地目|現況地目|現況)[　\s]*[：:]?[　\s]*" + CHIMOKU_PATTERN, text)
    if m:
        labeled_land.chimoku_tax = m.group(1).strip()
    m = re.search(r"(?:課税地積|地積)[　\s]*[：:]\s*([\d.,，]+)\s*[㎡m²]?", text_han)
    if m:
        labeled_land.area_tax_sqm = _parse_number(m.group(1))
    m = re.search(
        r"(?:評価額|価格|固定資産税評価額)[　\s]*[：:]\s*([\d,，]+)\s*円?", text_han
    )
    if m:
        labeled_land.assessed_value = _parse_int(m.group(1))

    if labeled_land.location and labeled_land.chiban:
        lands.append(labeled_land)

    # ---------------- パス2: 表形式・ベストエフォート ----------------
    # ラベル付きで既に拾えた場合はスキップ
    if not lands:
        lands.extend(_parse_kotei_tabular(text_han, file_path.name))

    # ---------------- 建物（ラベル付き形式のみ）----------------
    if re.search(r"家屋番号", text):
        bld = KoteiShisanBuilding(source_file=file_path.name)
        if labeled_land.location:
            bld.location = labeled_land.location
        m = re.search(r"家屋番号[　\s]*[：:]\s*(.+?)(?:\n|$)", text)
        if m:
            bld.kaoku_bango = m.group(1).strip()
        m = re.search(r"種類[　\s]*[：:]\s*(.+?)(?:\n|$)", text)
        if m:
            bld.kind = m.group(1).strip()
        m = re.search(r"構造[　\s]*[：:]\s*(.+?)(?:\n|$)", text)
        if m:
            bld.structure = m.group(1).strip()
        m = re.search(r"(?:課税)?床面積[　\s]*[：:]\s*([\d.,，]+)\s*[㎡m²]?", text_han)
        if m:
            bld.area_tax_sqm = _parse_number(m.group(1))
        m = re.search(r"(?:評価額|価格)[　\s]*[：:]\s*([\d,，]+)\s*円?", text_han)
        if m:
            bld.assessed_value = _parse_int(m.group(1))
        m = re.search(
            r"(?:建築年|建築年次)[　\s]*[：:]\s*((?:昭和|平成|令和)\d+年?|\d{4}年?)", text
        )
        if m:
            bld.construction_year = m.group(1).strip()
        if bld.kaoku_bango or bld.kind:
            buildings.append(bld)

    return lands, buildings


def _parse_kotei_tabular(text: str, source_file: str) -> list[KoteiShisanLand]:
    """固定資産評価証明の表形式からベストエフォートで土地情報を抽出.

    OCRノイズが多い前提のため、同一「所在+地番」は重複排除し、
    周辺行から地目・面積・評価額を推定する。
    """
    lands: list[KoteiShisanLand] = []
    seen_keys: set[tuple[str, str]] = set()
    lines = text.splitlines()

    for i, line in enumerate(lines):
        for loc_match in _KOTEI_LOC_RE.finditer(line):
            location = loc_match.group(1).strip()
            chiban = _zen_to_han(loc_match.group(2).strip())

            # 住所（市/県/区に続く町名）はスキップ
            preceding = line[: loc_match.start()]
            if re.search(r"[市県区]$", preceding.rstrip()):
                continue
            # 「番地」が続く場合も住所
            tail = line[loc_match.end(): loc_match.end() + 3]
            if "番地" in tail:
                continue

            key = (location, chiban)
            if key in seen_keys:
                continue
            seen_keys.add(key)

            land = KoteiShisanLand(
                source_file=source_file,
                location=location,
                chiban=chiban,
            )

            # コンテキスト: 前1行〜後4行
            ctx_start = max(0, i - 1)
            ctx_end = min(len(lines), i + 5)
            context = "\n".join(lines[ctx_start:ctx_end])

            # 地目: 優先度は 雑種地 > 宅地 > 田 > 畑 > 山林 > 原野
            cm = re.search(r"(雑種地|宅地|田|畑|山林|原野|牧場|池沼)", context)
            if cm:
                land.chimoku_tax = cm.group(1)

            # 面積: X.XX 形式（10㎡以上100000㎡未満）
            for raw in re.findall(r"(\d{1,5}[.．][\d]{2})", context):
                cand = raw.replace("．", ".").replace(",", "").replace(",", "")
                try:
                    val = float(cand)
                except ValueError:
                    continue
                if 10 <= val < 100000:
                    land.area_tax_sqm = val
                    break

            # 評価額: \XXX,XXX,XXX or ¥XXX,XXX,XXX or ￥XXX,XXX,XXX
            vm = re.search(r"[\\¥￥]\s*([\d,，]+)", context)
            if vm:
                val = _parse_int(vm.group(1))
                if val is not None and val > 1000:
                    land.assessed_value = val

            lands.append(land)

    return lands


# ------------------------------------------------------------------
# 農地台帳パーサー
# ------------------------------------------------------------------
# 農地台帳の所在地パターン:
#   "加倉井町2279", "中原町32-1", "中原町字南田268", "中原町495-1の一部"
# 行中の任意位置に出現しうる（前後に番号や面積がつくケースもある）
_NOCHI_LOC_RE = re.compile(
    r"([^\d\s　ロ|│'\"’”]{1,8}町(?:字[^\d\s　ロ|│'\"’”]{1,8})?[\d０-９]+(?:[-－][\d０-９]+)?(?:の[\d０-９]+)?(?:の一部)?)"
)


def parse_nochi_daicho(file_path: Path) -> list[NochiDaicho]:
    """農地台帳PDFから農地情報を抽出.

    OCR済みスキャンPDFを想定したベストエフォート実装:
        - 各行から「<町名><地番>」パターンを検出
        - 前後数行から面積・地目・貸借形態・貸主（権利者）を推定
        - 同一「所在+地番」は重複排除
    """
    results: list[NochiDaicho] = []
    seen_keys: set[tuple[str, str]] = set()

    text = _extract_text(file_path)
    if not text:
        return results

    text_han = _zen_to_han(text)
    lines = text_han.splitlines()

    # 経営者名を先頭付近から取得
    farmer_name = ""
    for line in lines[:20]:
        m = re.search(r"氏\s*名\s+([^\s<>]+\s+[^\s<>]+)", line)
        if m:
            farmer_name = m.group(1).strip()
            break

    # 住所の番地パターンを判定用に用意（貸主住所は地番として扱わない）
    # 例: "水戸市中原町660番地", "茨城県笠間市五平115番"
    addr_prefix_re = re.compile(r"(?:市|県|区)$")

    for i, line in enumerate(lines):
        for loc_match in _NOCHI_LOC_RE.finditer(line):
            location_chiban = loc_match.group(1).strip()
            start_pos = loc_match.start(1)

            # 直前に「市/県/区」があれば貸主住所なのでスキップ
            preceding = line[:start_pos]
            if addr_prefix_re.search(preceding.rstrip()):
                continue
            # キャプチャ内に「市/県/区」が含まれる場合も貸主住所（例: "水戸市中原町6"）
            if re.search(r"[市県区]", location_chiban):
                continue
            # 直後に「番地」があっても住所
            after = line[loc_match.end(1):loc_match.end(1) + 2]
            if "番地" in line[loc_match.end(1):loc_match.end(1) + 3]:
                continue

            # 所在地と地番を分離: 末尾の数字（と枝番）を地番として切り出す
            m = re.search(r"^(.+?町(?:字[^\d]+)?)([\d０-９]+(?:[-－][\d０-９]+)?(?:の[\d０-９]+)?(?:の一部)?)$", location_chiban)
            if m:
                location = m.group(1).strip()
                chiban = _zen_to_han(m.group(2))
            else:
                location = location_chiban
                chiban = ""

            key = (location, chiban)
            if key in seen_keys:
                continue
            seen_keys.add(key)

            entry = NochiDaicho(
                source_file=file_path.name,
                location=location,
                chiban=chiban,
                farmer_name=farmer_name,
            )

            # コンテキスト: 前2行〜後4行
            ctx_start = max(0, i - 2)
            ctx_end = min(len(lines), i + 5)
            context = "\n".join(lines[ctx_start:ctx_end])

            # 面積: 日付（令5.6.20 等）は除外し、10㎡以上の値を採用
            # パターン1: 同一行内 "<locchiban> ... <area>"（e.g. "中原町46－2 普通畑 19．00"）
            # パターン2: 直後1-2行目先頭 "<area> ..."（e.g. "1,534.00 ○ 調 自 ..."）
            for j in range(i, min(i + 3, len(lines))):
                candidate_line = lines[j]
                # 令和・平成・昭和の日付を除外するため、「令」「平」「昭」が含まれる区間は無視
                cleaned = re.sub(r"[令平昭][\d０-９.．,，\s]+", " ", candidate_line)
                # 全角→半角統一
                cleaned_han = cleaned.translate(_ZEN_DIGITS).replace("．", ".").replace("，", ",")
                # 面積候補: カンマ付き数値 or 整数部3桁以上
                # e.g., "1,534.00", "543.00", "19.00", "2,124,00"(OCRノイズ)
                matches = re.findall(r"\d[\d,.]{1,10}", cleaned_han)
                for raw in matches:
                    # 必ず小数点含む（面積はX.XX形式）
                    if "." not in raw:
                        # OCR error: "2,124,00" → 通算 comma 2個 → 後ろを . とみなす
                        if raw.count(",") >= 2:
                            parts = raw.rsplit(",", 1)
                            raw = parts[0] + "." + parts[1]
                        else:
                            continue
                    # 数値化（_parse_number は半角前提）
                    val = _parse_number(raw)
                    if val is None:
                        continue
                    if val < 10:
                        continue
                    # 現実的な面積の上限: 10ha = 100000㎡
                    if val > 100000:
                        continue
                    entry.area_sqm = val
                    break
                if entry.area_sqm is not None:
                    break

            # 地目: コンテキストから 田/畑/山林/原野/雑種地
            cm = re.search(r"(普通田|普通畑|雑種地|田|畑|山林|原野)", context)
            if cm:
                raw = cm.group(1)
                entry.chimoku = "田" if "田" in raw else ("畑" if "畑" in raw else raw)

            # 権利種別
            rm = re.search(r"(賃貸借|使用貸借|利用権|耕作権)", context)
            if rm:
                entry.right_type = rm.group(1)
                # 貸主名を抽出: 「<address>番地\n<name>」パターン
                for j in range(max(0, i - 2), min(i + 5, len(lines))):
                    nm = re.search(r"^\s*([^\d\s][^\d\s]{1,8}\s+[^\d\s][^\d\s]{1,8})\s*$", lines[j])
                    if nm:
                        name = nm.group(1).strip()
                        # 経営者本人以外の名前を貸主として採用
                        if farmer_name and name != farmer_name and "鈴木" not in name:
                            entry.right_holder = name
                            break
            elif "自" in context or "○" in context:
                entry.right_type = "所有"

            results.append(entry)

    return results
