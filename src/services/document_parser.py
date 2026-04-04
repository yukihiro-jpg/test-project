"""書類パーサー.

謄本（全部事項証明書）、固定資産評価証明（課税明細書）、名寄帳、農地台帳の
PDFからテキストを抽出し、不動産情報を構造化する。
ルールベース（正規表現＋pdfplumber）で抽出。Claude API不使用。
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

CHIMOKU_PATTERN = r"(宅地|田|畑|山林|原野|雑種地|墓地|境内地|公衆用道路|保安林|池沼|鉱泉地|牧場|学校用地)"


# =====================================================================
# 全角→半角 ユーティリティ
# =====================================================================
def _zen_to_han(text: str) -> str:
    """全角数字・スラッシュを半角に変換."""
    table = str.maketrans("０１２３４５６７８９／", "0123456789/")
    return text.translate(table)


# =====================================================================
# PDF テキスト抽出
# =====================================================================
def _extract_text(file_path: Path) -> str:
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
        logger.warning("未対応ファイル形式: %s", suffix)
        return ""


# =====================================================================
# 1. 謄本（全部事項証明書）パーサー
# =====================================================================
def parse_tohon(file_path: Path) -> tuple[list[TohonLand], list[TohonBuilding]]:
    """謄本PDFから土地・建物情報を抽出."""
    lands: list[TohonLand] = []
    buildings: list[TohonBuilding] = []
    raw = _extract_text(file_path)
    if not raw:
        return lands, buildings
    text = _zen_to_han(raw)

    # --- 土地 表題部 ---
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
    m = re.search(r"地積[　\s]*[：:]?[　\s]*([\d.,]+)\s*[㎡m²]?", text)
    if m:
        land.area_registry_sqm = _parse_number(m.group(1))

    # --- 甲区（所有権）抽出 ---
    land.ownership_history = _parse_kou_section(text)

    # --- 乙区（所有権以外）抽出 ---
    land.other_rights = _parse_otsu_section(text)

    if land.location or land.chiban:
        lands.append(land)

    # --- 建物 表題部 ---
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
        bld.floor_areas = _parse_floor_areas(text)
        bld.ownership_history = land.ownership_history
        bld.other_rights = land.other_rights
        buildings.append(bld)

    return lands, buildings


def _parse_kou_section(text: str) -> list[OwnershipEntry]:
    """甲区（所有権に関する事項）をパース.

    順位番号でエントリを分割し、各エントリから
    受付日・原因・登記種別・所有者名・持分を抽出する。
    """
    entries: list[OwnershipEntry] = []

    # 甲区セクションを抽出
    kou_match = re.search(
        r"甲\s*区[　\s]*[\(（]?\s*所有権[^)）]*[\)）]?\s*(.+?)(?:乙\s*区|$)",
        text, re.DOTALL,
    )
    if not kou_match:
        return entries

    kou_text = kou_match.group(1)

    # 順位番号で分割（"1 " "2 " 等、行頭の数字）
    entry_blocks = re.split(r"\n\s*(\d+)\s+", kou_text)
    # entry_blocks[0]はヘッダー部、以降 [番号, 内容, 番号, 内容, ...]
    blocks: list[str] = []
    if len(entry_blocks) > 1:
        for i in range(1, len(entry_blocks), 2):
            if i + 1 < len(entry_blocks):
                blocks.append(entry_blocks[i + 1])
            else:
                blocks.append("")
    else:
        # 順位番号で分割できない場合、全体を1ブロックとして扱う
        blocks = [kou_text]

    for block in blocks:
        entry = OwnershipEntry()

        # 登記の種別
        type_m = re.search(
            r"(所有権保存|所有権移転|共有者全員持分全部移転|持分全部移転|持分一部移転|持分移転)",
            block,
        )
        if type_m:
            entry.entry_type = type_m.group(1)

        # 受付日
        date_m = re.search(
            r"(?:受付|登記)[年月日　\s]*[：:]?[　\s]*((?:令和|平成|昭和)\d+年\d+月\d+日)",
            block,
        )
        if date_m:
            entry.registration_date = date_m.group(1)

        # 原因（原因日付 + 原因種別）
        cause_m = re.search(
            r"原因[　\s]*[：:]?[　\s]*((?:令和|平成|昭和)\d+年\d+月\d+日)?\s*(売買|相続|贈与|遺贈|遺産分割|交換|共有物分割|分割|合併|錯誤|判決|調停|和解|財産分与)?",
            block,
        )
        if cause_m:
            parts = []
            if cause_m.group(1):
                entry.cause_date = cause_m.group(1)
                parts.append(cause_m.group(1))
            if cause_m.group(2):
                parts.append(cause_m.group(2))
            entry.cause = " ".join(parts)

        # 所有者/共有者
        owner_m = re.search(
            r"(?:所有者|共有者)[　\s]*[：:]?[　\s]*(.+?)(?:\n|$)", block
        )
        if owner_m:
            owner_text = owner_m.group(1).strip()
            # 持分が所有者行に含まれる場合
            share_in_owner = re.search(r"持分[　\s]*([\d]+分の[\d]+|\d+/\d+)", owner_text)
            if share_in_owner:
                entry.share = share_in_owner.group(1)
                owner_text = owner_text[:share_in_owner.start()].strip()
            # 住所を除去（最後の名前部分を取得）
            name_parts = re.split(r"[　\s]{2,}", owner_text)
            entry.owner_name = name_parts[-1].strip() if name_parts else owner_text

        # 持分（別行に記載されている場合）
        if not entry.share:
            share_m = re.search(r"持分[　\s]*([\d]+分の[\d]+|\d+/\d+)", block)
            if share_m:
                entry.share = share_m.group(1)

        if entry.entry_type or entry.registration_date or entry.owner_name:
            entries.append(entry)

    return entries


def _parse_otsu_section(text: str) -> list[OtherRightEntry]:
    """乙区（所有権以外の権利に関する事項）をパース."""
    entries: list[OtherRightEntry] = []

    otsu_match = re.search(
        r"乙\s*区[　\s]*[\(（]?\s*所有権以外[^)）]*[\)）]?\s*(.+?)$",
        text, re.DOTALL,
    )
    if not otsu_match:
        return entries

    otsu_text = otsu_match.group(1)

    # 権利種別ごとにエントリを検出
    right_pattern = r"(抵当権設定|根抵当権設定|地上権設定|賃借権設定|地役権設定|質権設定|永小作権設定|抵当権|根抵当権|地上権|賃借権|地役権)"
    for m in re.finditer(right_pattern, otsu_text):
        entry = OtherRightEntry()
        entry.right_type = m.group(1)

        # マッチ位置以降のテキストから詳細を抽出
        start = m.start()
        end_pos = min(start + 500, len(otsu_text))
        block = otsu_text[start:end_pos]

        date_m = re.search(
            r"(?:受付|登記)[年月日　\s]*[：:]?[　\s]*((?:令和|平成|昭和)\d+年\d+月\d+日)",
            block,
        )
        if date_m:
            entry.registration_date = date_m.group(1)

        cause_m = re.search(r"原因[　\s]*[：:]?[　\s]*(.+?)(?:\n|$)", block)
        if cause_m:
            entry.cause = cause_m.group(1).strip()

        holder_m = re.search(r"(?:権利者|債権者)[　\s]*[：:]?[　\s]*(.+?)(?:\n|$)", block)
        if holder_m:
            entry.holder = holder_m.group(1).strip()

        detail_m = re.search(r"(?:債権額|極度額)[　\s]*[：:]?[　\s]*(.+?)(?:\n|$)", block)
        if detail_m:
            entry.details = detail_m.group(1).strip()

        entries.append(entry)

    return entries


def _parse_floor_areas(text: str) -> list[FloorArea]:
    """建物の階別床面積を抽出."""
    areas: list[FloorArea] = []
    pattern = r"(地下?\d+階|[１-９一二三四五六七八九十]+階)\s*([\d.,]+)\s*[㎡m²]?"
    for m in re.finditer(pattern, text):
        floor_name = m.group(1)
        area_val = _parse_number(m.group(2))
        if area_val is not None:
            areas.append(FloorArea(floor=floor_name, area_sqm=area_val))
    return areas


# =====================================================================
# 2. 固定資産評価証明（課税明細書）パーサー
# =====================================================================
def parse_kotei_shisan(
    file_path: Path,
) -> tuple[list[KoteiShisanLand], list[KoteiShisanBuilding]]:
    """固定資産評価証明/課税明細書PDFから土地・建物情報を抽出."""
    lands: list[KoteiShisanLand] = []
    buildings: list[KoteiShisanBuilding] = []
    raw = _extract_text(file_path)
    if not raw:
        return lands, buildings
    text = _zen_to_han(raw)

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
    m = re.search(r"(?:課税)?地積[　\s]*[：:]?[　\s]*([\d.,]+)\s*[㎡m²]?", text)
    if m:
        land.area_tax_sqm = _parse_number(m.group(1))
    m = re.search(r"(?:評価額|価格|固定資産税評価額)[　\s]*[：:]?[　\s]*([\d,]+)\s*円?", text)
    if m:
        land.assessed_value = _parse_int(m.group(1))

    if land.location or land.chiban:
        lands.append(land)

    # 建物部分
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
        m = re.search(r"(?:課税)?床面積[　\s]*[：:]?[　\s]*([\d.,]+)\s*[㎡m²]?", text)
        if m:
            bld.area_tax_sqm = _parse_number(m.group(1))
        m = re.search(r"(?:評価額|価格)[　\s]*[：:]?[　\s]*([\d,]+)\s*円?", text)
        if m:
            bld.assessed_value = _parse_int(m.group(1))
        m = re.search(r"(?:建築年|建築年次|建築)[　\s]*[：:]?[　\s]*((?:昭和|平成|令和)\d+年?|\d{4}年?)", text)
        if m:
            bld.construction_year = m.group(1).strip()
        buildings.append(bld)

    return lands, buildings


# =====================================================================
# 3. 名寄帳パーサー
# =====================================================================
def parse_nayosecho(
    file_path: Path,
) -> tuple[list[NayosechoLand], list[NayosechoBuilding]]:
    """名寄帳PDFから土地・建物情報を抽出."""
    lands: list[NayosechoLand] = []
    buildings: list[NayosechoBuilding] = []
    raw = _extract_text(file_path)
    if not raw:
        return lands, buildings
    text = _zen_to_han(raw)

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
    m = re.search(r"(?:課税)?地積[　\s]*[：:]?[　\s]*([\d.,]+)\s*[㎡m²]?", text)
    if m:
        land.area_tax_sqm = _parse_number(m.group(1))
    m = re.search(r"(?:評価額|価格)[　\s]*[：:]?[　\s]*([\d,]+)\s*円?", text)
    if m:
        land.assessed_value = _parse_int(m.group(1))
    m = re.search(r"(?:所有者|納税義務者)[　\s]*[：:]?[　\s]*(.+?)(?:\n|$)", text)
    if m:
        land.owner = m.group(1).strip()
    m = re.search(r"持分[　\s]*([\d]+分の[\d]+|\d+/\d+)", text)
    if m:
        land.share = m.group(1).strip()

    if land.location or land.chiban:
        lands.append(land)

    # 建物
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
        m = re.search(r"(?:課税)?床面積[　\s]*[：:]?[　\s]*([\d.,]+)\s*[㎡m²]?", text)
        if m:
            bld.area_tax_sqm = _parse_number(m.group(1))
        m = re.search(r"(?:評価額|価格)[　\s]*[：:]?[　\s]*([\d,]+)\s*円?", text)
        if m:
            bld.assessed_value = _parse_int(m.group(1))
        buildings.append(bld)

    return lands, buildings


# =====================================================================
# 4. 農地台帳パーサー
# =====================================================================
def parse_nochi_daicho(file_path: Path) -> list[NochiDaicho]:
    """農地台帳PDFから農地情報を抽出."""
    results: list[NochiDaicho] = []
    raw = _extract_text(file_path)
    if not raw:
        return results
    text = _zen_to_han(raw)

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
    m = re.search(r"(?:面積|地積)[　\s]*[：:]?[　\s]*([\d.,]+)\s*[㎡m²]?", text)
    if m:
        entry.area_sqm = _parse_number(m.group(1))
    m = re.search(
        r"(?:農地区分|区分)[　\s]*[：:]?[　\s]*(甲種農地|第[123一二三]種農地|市街化区域内農地|市街化区域|甲種|第[123一二三]種)",
        text,
    )
    if m:
        entry.farm_category = m.group(1).strip()
    m = re.search(r"(?:耕作者|耕作者氏名)[　\s]*[：:]?[　\s]*(.+?)(?:\n|$)", text)
    if m:
        entry.farmer_name = m.group(1).strip()
    m = re.search(
        r"(?:権利の種類|権利種別|権原|権利)[　\s]*[：:]?[　\s]*(所有|賃借権|使用貸借|耕作権|永小作権|利用権)",
        text,
    )
    if m:
        entry.right_type = m.group(1).strip()
    m = re.search(r"(?:権利者|権利設定者)[　\s]*[：:]?[　\s]*(.+?)(?:\n|$)", text)
    if m:
        entry.right_holder = m.group(1).strip()

    if entry.location or entry.chiban:
        results.append(entry)

    return results


# =====================================================================
# 持分計算ロジック
# =====================================================================
def _parse_share_fraction(share_str: str) -> Optional[Fraction]:
    """持分文字列を Fraction に変換.

    "2分の1" → Fraction(1, 2), "3/4" → Fraction(3, 4)
    """
    if not share_str:
        return None
    s = _zen_to_han(share_str)
    # "N分のM" パターン
    m = re.match(r"(\d+)分の(\d+)", s)
    if m:
        denom = int(m.group(1))
        numer = int(m.group(2))
        return Fraction(numer, denom) if denom else None
    # "M/N" パターン
    m = re.match(r"(\d+)/(\d+)", s)
    if m:
        numer = int(m.group(1))
        denom = int(m.group(2))
        return Fraction(numer, denom) if denom else None
    return None


def calculate_ownership(
    ownership_history: list[OwnershipEntry],
    target_name: str,
    reference_date: str,
) -> OwnershipResult:
    """甲区の所有権履歴から、基準日時点の対象者の持分を算出.

    ロジック:
    1. 甲区エントリを順番に走査
    2. 所有権保存/移転 → 取得者にその持分（or 全部）を付与
    3. 持分移転 → 指定された持分を取得者に付与
    4. 対象者が取得 → 持分加算、対象者から他者へ移転 → 持分減算
    5. 基準日以降のエントリは除外（日付が解析できる場合）

    Args:
        ownership_history: 甲区エントリリスト（時系列順）
        target_name: 対象者名（被相続人等）
        reference_date: 基準日
    """
    result = OwnershipResult(
        target_name=target_name,
        reference_date=reference_date,
    )
    if not ownership_history or not target_name:
        return result

    target_share = Fraction(0)
    history_lines: list[str] = []

    for entry in ownership_history:
        # 変遷サマリー行を作成
        summary = f"{entry.registration_date or '日付不明'}"
        if entry.entry_type:
            summary += f" [{entry.entry_type}]"
        if entry.cause:
            summary += f" 原因: {entry.cause}"
        if entry.owner_name:
            summary += f" → {entry.owner_name}"
        if entry.share:
            summary += f" (持分: {entry.share})"
        history_lines.append(summary)

        entry_share = _parse_share_fraction(entry.share)

        # 対象者が取得者の場合
        if target_name in (entry.owner_name or ""):
            if "保存" in (entry.entry_type or "") or "移転" in (entry.entry_type or ""):
                if entry_share is not None:
                    target_share = target_share + entry_share
                else:
                    # 持分記載なし → 単独所有（全部取得）
                    target_share = Fraction(1)

        # 対象者以外が取得者で、対象者の持分が移転された場合
        elif target_name not in (entry.owner_name or ""):
            et = entry.entry_type or ""
            if "全部移転" in et:
                # 「○○持分全部移転」で対象者の名前が原因等に含まれる場合
                # or 対象者が以前所有していた場合、持分を失う
                if target_share > 0 and entry_share is None:
                    target_share = Fraction(0)
            elif "所有権移転" in et and "持分" not in et:
                # 単純な所有権移転 → 全部移転
                target_share = Fraction(0)

    result.history_summary = history_lines

    # 結果整理
    if target_share == Fraction(1):
        result.current_share = "単独所有"
        result.share_fraction = 1.0
    elif target_share > 0:
        result.current_share = f"{target_share.denominator}分の{target_share.numerator}"
        result.share_fraction = float(target_share)
    else:
        result.current_share = "所有権なし"
        result.share_fraction = 0.0

    return result


# =====================================================================
# 住所関連ユーティリティ（既存互換）
# =====================================================================
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
    """物件リストから都道府県を検出。location属性を持つ任意のモデルに対応。"""
    for prop in properties:
        location = getattr(prop, "location", "")
        chiban = getattr(prop, "chiban", "")
        parts = extract_address_parts(location + " " + chiban)
        if parts["prefecture"]:
            return parts["prefecture"]
    return ""


def detect_city_from_properties(properties: list) -> str:
    """物件リストから市区町村を検出。"""
    for prop in properties:
        location = getattr(prop, "location", "")
        chiban = getattr(prop, "chiban", "")
        parts = extract_address_parts(location + " " + chiban)
        if parts["city"]:
            return parts["city"]
    return ""


# =====================================================================
# 数値パース
# =====================================================================
def _parse_number(s: str) -> Optional[float]:
    try:
        cleaned = _zen_to_han(s).replace(",", "").strip()
        return float(cleaned) if cleaned else None
    except ValueError:
        return None


def _parse_int(s: str) -> Optional[int]:
    try:
        cleaned = _zen_to_han(s).replace(",", "").replace(" ", "").strip()
        return int(cleaned) if cleaned else None
    except ValueError:
        return None
