"""書類パーサー.

謄本（全部事項証明書）、固定資産評価証明書（課税明細書）、名寄帳、農地台帳の
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
    NayosechoBuilding,
    NayosechoLand,
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

    text = _extract_text(file_path)
    if not text:
        return lands, buildings

    text_han = _zen_to_han(text)

    # --- 土地 ---
    land = TohonLand(source_file=file_path.name)
    m = re.search(r"所在[　\s]*[：:]?[　\s]*(.+?)(?:\n|$)", text)
    if m:
        land.location = m.group(1).strip()
    m = re.search(r"地番[　\s]*[：:]?[　\s]*(.+?)(?:\n|$)", text)
    if m:
        land.chiban = m.group(1).strip()
    m = re.search(r"地目[　\s]*[：:]?[　\s]*" + CHIMOKU_PATTERN, text)
    if m:
        land.chimoku_registry = m.group(1).strip()
    m = re.search(r"地積[　\s]*[：:]?[　\s]*([\d.,，０-９]+)\s*[㎡m²]?", text_han)
    if m:
        land.area_registry_sqm = _parse_number(m.group(1))

    # 甲区（所有権）抽出
    land.ownership_history = _parse_kou_section(text)

    # 乙区（所有権以外）抽出
    land.other_rights = _parse_otsu_section(text)

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

    順位番号ごとにエントリを分割し、各エントリから
    受付日、原因、所有者名、持分、登記種別を抽出する。
    """
    entries: list[OwnershipEntry] = []

    # 甲区セクションを抽出
    kou_match = re.search(
        r"甲\s*区[　\s]*[\(（]?\s*所有権[^)）]*[\)）]?(.+?)(?:乙\s*区|$)",
        text, re.DOTALL,
    )
    if not kou_match:
        return entries

    kou_text = _zen_to_han(kou_match.group(1))

    # 順位番号で分割（"1 ", "2 " 等で始まるブロック）
    # 順位番号がない場合はテキスト全体を1エントリとして扱う
    blocks = re.split(r"\n\s*(\d+)\s+", kou_text)

    # blocks[0] は最初の順位番号の前のテキスト（通常空）
    # blocks[1], blocks[2] = 順位番号1, そのテキスト
    # blocks[3], blocks[4] = 順位番号2, そのテキスト ...
    if len(blocks) < 3:
        # 順位番号分割できなかった場合、全体を1ブロックとして処理
        entry = _parse_single_kou_entry(kou_text)
        if entry:
            entries.append(entry)
        return entries

    i = 1
    while i < len(blocks) - 1:
        block_text = blocks[i + 1] if i + 1 < len(blocks) else ""
        entry = _parse_single_kou_entry(block_text)
        if entry:
            entries.append(entry)
        i += 2

    return entries


def _parse_single_kou_entry(block: str) -> Optional[OwnershipEntry]:
    """甲区の1エントリ（1順位番号分）を解析."""
    if not block.strip():
        return None

    entry = OwnershipEntry()

    # 登記種別（所有権保存、所有権移転、持分全部移転 等）
    type_match = re.search(
        r"(所有権保存|所有権移転|共有者全員持分全部移転|持分全部移転|持分一部移転|持分移転)",
        block,
    )
    if type_match:
        entry.entry_type = type_match.group(1)

    # 受付日
    date_match = re.search(
        r"(?:受付|登記)[　\s]*(?:年月日)?[　\s]*[：:]?[　\s]*((?:令和|平成|昭和)\d+年\d+月\d+日)",
        block,
    )
    if date_match:
        entry.registration_date = date_match.group(1)

    # 原因（日付+原因種別）
    cause_match = re.search(
        r"原因[　\s]*[：:]?[　\s]*((?:令和|平成|昭和)\d+年\d+月\d+日)?\s*(売買|相続|贈与|遺贈|交換|共有物分割|遺産分割|分割|錯誤|判決|調停)?",
        block,
    )
    if cause_match:
        parts = []
        if cause_match.group(1):
            entry.cause_date = cause_match.group(1)
            parts.append(cause_match.group(1))
        if cause_match.group(2):
            parts.append(cause_match.group(2))
        entry.cause = " ".join(parts)

    # 所有者/共有者と持分
    owner_match = re.search(
        r"(?:所有者|共有者)[　\s]*[：:]?[　\s]*(.+?)(?:\n|$)", block
    )
    if owner_match:
        owner_text = owner_match.group(1).strip()
        # 持分が含まれているか
        share_match = re.search(r"持分[　\s]*([\d０-９]+分の[\d０-９]+|\d+/\d+)", block)
        if share_match:
            entry.share = _zen_to_han(share_match.group(1))
            # 持分テキストを除いた部分が所有者名
            entry.owner_name = re.sub(
                r"持分[　\s]*[\d０-９]+分の[\d０-９]+[　\s]*", "", owner_text
            ).strip()
        else:
            entry.owner_name = owner_text

    return entry if (entry.owner_name or entry.entry_type) else None


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
       - 所有権保存/移転: 新所有者が全部取得（or 持分指定あり）
       - 持分移転: 指定された持分が移転
    3. target_name が所有者の場合は持分を加算、
       他者に移転された場合は持分を減算
    """
    result = OwnershipResult(
        target_name=target_name,
        reference_date=reference_date,
    )

    if not ownership_history:
        return result

    # 対象者の現在の持分を追跡
    target_share: Optional[Fraction] = None  # None=所有権なし
    history_lines: list[str] = []

    for entry in ownership_history:
        # 履歴サマリー作成
        summary = entry.registration_date or ""
        if entry.cause:
            summary += f" {entry.cause}"
        if entry.entry_type:
            summary += f" [{entry.entry_type}]"
        if entry.owner_name:
            summary += f" → {entry.owner_name}"
        if entry.share:
            summary += f"（持分: {entry.share}）"
        if summary.strip():
            history_lines.append(summary.strip())

        # 持分計算
        is_full_transfer = entry.entry_type in (
            "所有権保存", "所有権移転", "共有者全員持分全部移転",
        )
        is_share_transfer = entry.entry_type in (
            "持分全部移転", "持分一部移転", "持分移転",
        )

        if target_name and entry.owner_name:
            if target_name in entry.owner_name:
                # 対象者が所有権/持分を取得
                if entry.share:
                    target_share = _parse_share_fraction(entry.share)
                else:
                    # 持分指定なし = 単独所有
                    target_share = Fraction(1, 1)
            elif is_full_transfer:
                # 別の人に所有権が完全に移転 → 対象者の持分消滅
                if not entry.share:
                    # 全部移転
                    target_share = Fraction(0, 1)
                # 持分指定ありの場合は、他の人がその持分を取得しただけ
                # （対象者の持分は変わらない）
            elif is_share_transfer:
                # 別の人に持分移転 → 誰の持分が移転されたかは
                # テキストから判断が必要（簡易: 対象者の持分は維持）
                pass

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
def parse_kotei_shisan(
    file_path: Path,
) -> tuple[list[KoteiShisanLand], list[KoteiShisanBuilding]]:
    """固定資産評価証明/課税明細書PDFから土地・建物情報を抽出."""
    lands: list[KoteiShisanLand] = []
    buildings: list[KoteiShisanBuilding] = []

    text = _extract_text(file_path)
    if not text:
        return lands, buildings

    text_han = _zen_to_han(text)

    # 土地
    land = KoteiShisanLand(source_file=file_path.name)
    m = re.search(r"所在[　\s]*[：:]?[　\s]*(.+?)(?:\n|$)", text)
    if m:
        land.location = m.group(1).strip()
    m = re.search(r"地番[　\s]*[：:]?[　\s]*(.+?)(?:\n|$)", text)
    if m:
        land.chiban = m.group(1).strip()
    m = re.search(r"(?:課税地目|現況地目|現況)[　\s]*[：:]?[　\s]*" + CHIMOKU_PATTERN, text)
    if m:
        land.chimoku_tax = m.group(1).strip()
    m = re.search(r"(?:課税地積|地積)[　\s]*[：:]?[　\s]*([\d.,，]+)\s*[㎡m²]?", text_han)
    if m:
        land.area_tax_sqm = _parse_number(m.group(1))
    m = re.search(r"(?:評価額|価格|固定資産税評価額)[　\s]*[：:]?[　\s]*([\d,，]+)\s*円?", text_han)
    if m:
        land.assessed_value = _parse_int(m.group(1))

    if land.location or land.chiban:
        lands.append(land)

    # 建物
    if re.search(r"家屋番号", text):
        bld = KoteiShisanBuilding(source_file=file_path.name)
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
        m = re.search(r"(?:課税)?床面積[　\s]*[：:]?[　\s]*([\d.,，]+)\s*[㎡m²]?", text_han)
        if m:
            bld.area_tax_sqm = _parse_number(m.group(1))
        m = re.search(r"(?:評価額|価格)[　\s]*[：:]?[　\s]*([\d,，]+)\s*円?", text_han)
        if m:
            bld.assessed_value = _parse_int(m.group(1))
        m = re.search(r"(?:建築年|建築年次)[　\s]*[：:]?[　\s]*((?:昭和|平成|令和)\d+年?|\d{4}年?)", text)
        if m:
            bld.construction_year = m.group(1).strip()
        buildings.append(bld)

    return lands, buildings


# ------------------------------------------------------------------
# 名寄帳パーサー
# ------------------------------------------------------------------
def parse_nayosecho(
    file_path: Path,
) -> tuple[list[NayosechoLand], list[NayosechoBuilding]]:
    """名寄帳PDFから土地・建物情報を抽出."""
    lands: list[NayosechoLand] = []
    buildings: list[NayosechoBuilding] = []

    text = _extract_text(file_path)
    if not text:
        return lands, buildings

    text_han = _zen_to_han(text)

    land = NayosechoLand(source_file=file_path.name)
    m = re.search(r"所在[　\s]*[：:]?[　\s]*(.+?)(?:\n|$)", text)
    if m:
        land.location = m.group(1).strip()
    m = re.search(r"地番[　\s]*[：:]?[　\s]*(.+?)(?:\n|$)", text)
    if m:
        land.chiban = m.group(1).strip()
    m = re.search(r"(?:課税)?地目[　\s]*[：:]?[　\s]*" + CHIMOKU_PATTERN, text)
    if m:
        land.chimoku_tax = m.group(1).strip()
    m = re.search(r"(?:課税)?地積[　\s]*[：:]?[　\s]*([\d.,，]+)\s*[㎡m²]?", text_han)
    if m:
        land.area_tax_sqm = _parse_number(m.group(1))
    m = re.search(r"(?:評価額|価格)[　\s]*[：:]?[　\s]*([\d,，]+)\s*円?", text_han)
    if m:
        land.assessed_value = _parse_int(m.group(1))
    m = re.search(r"(?:所有者|納税義務者)[　\s]*[：:]?[　\s]*(.+?)(?:\n|$)", text)
    if m:
        land.owner = m.group(1).strip()
    m = re.search(r"持分[　\s]*[：:]?[　\s]*([\d０-９]+分の[\d０-９]+|\d+/\d+)", text)
    if m:
        land.share = _zen_to_han(m.group(1))

    if land.location or land.chiban:
        lands.append(land)

    # 建物部分
    if re.search(r"家屋番号", text):
        bld = NayosechoBuilding(source_file=file_path.name)
        bld.location = land.location
        bld.owner = land.owner
        bld.share = land.share
        m = re.search(r"家屋番号[　\s]*[：:]?[　\s]*(.+?)(?:\n|$)", text)
        if m:
            bld.kaoku_bango = m.group(1).strip()
        m = re.search(r"種類[　\s]*[：:]?[　\s]*(.+?)(?:\n|$)", text)
        if m:
            bld.kind = m.group(1).strip()
        m = re.search(r"構造[　\s]*[：:]?[　\s]*(.+?)(?:\n|$)", text)
        if m:
            bld.structure = m.group(1).strip()
        m = re.search(r"(?:課税)?床面積[　\s]*[：:]?[　\s]*([\d.,，]+)\s*[㎡m²]?", text_han)
        if m:
            bld.area_tax_sqm = _parse_number(m.group(1))
        m = re.search(r"(?:評価額|価格)[　\s]*[：:]?[　\s]*([\d,，]+)\s*円?", text_han)
        if m:
            bld.assessed_value = _parse_int(m.group(1))
        buildings.append(bld)

    return lands, buildings


# ------------------------------------------------------------------
# 農地台帳パーサー
# ------------------------------------------------------------------
def parse_nochi_daicho(file_path: Path) -> list[NochiDaicho]:
    """農地台帳PDFから農地情報を抽出."""
    results: list[NochiDaicho] = []

    text = _extract_text(file_path)
    if not text:
        return results

    text_han = _zen_to_han(text)

    entry = NochiDaicho(source_file=file_path.name)
    m = re.search(r"所在[　\s]*[：:]?[　\s]*(.+?)(?:\n|$)", text)
    if m:
        entry.location = m.group(1).strip()
    m = re.search(r"地番[　\s]*[：:]?[　\s]*(.+?)(?:\n|$)", text)
    if m:
        entry.chiban = m.group(1).strip()
    m = re.search(r"地目[　\s]*[：:]?[　\s]*(田|畑)", text)
    if m:
        entry.chimoku = m.group(1).strip()
    m = re.search(r"(?:面積|地積)[　\s]*[：:]?[　\s]*([\d.,，]+)\s*[㎡m²]?", text_han)
    if m:
        entry.area_sqm = _parse_number(m.group(1))
    # 農地区分
    m = re.search(
        r"(?:農地区分|区分)[　\s]*[：:]?[　\s]*(甲種農地|第[1-3１-３一二三]種農地|市街化区域内農地|生産緑地)",
        text,
    )
    if m:
        entry.farm_category = _zen_to_han(m.group(1)).strip()
    # 耕作者
    m = re.search(r"(?:耕作者|耕作者氏名)[　\s]*[：:]?[　\s]*(.+?)(?:\n|$)", text)
    if m:
        entry.farmer_name = m.group(1).strip()
    # 権利種別
    m = re.search(
        r"(?:権利の種類|権利種別|権原|権利)[　\s]*[：:]?[　\s]*(所有|賃借権|使用貸借|耕作権|永小作権)",
        text,
    )
    if m:
        entry.right_type = m.group(1).strip()
    # 権利者
    m = re.search(r"(?:権利者)[　\s]*[：:]?[　\s]*(.+?)(?:\n|$)", text)
    if m:
        entry.right_holder = m.group(1).strip()

    if entry.location or entry.chiban:
        results.append(entry)

    return results
