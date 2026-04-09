"""相続税 土地評価 計算ロジック.

倍率方式による相続税評価額を算出する:
    相続税評価額 = 固定資産税評価額 × 倍率

倍率表の値には以下のプレフィックスが付くことがある:
    - 純: 純農地（純山林/純原野）
    - 中: 中間農地（中間山林/中間原野）
    - 周: 市街地周辺農地（市街地周辺山林/市街地周辺原野）
    - 比準 / 市比準: 宅地比準方式（個別評価が必要）
    - 路線: 路線価方式
    - ― / - / 空: データなし
"""

from __future__ import annotations

import re
from dataclasses import replace
from typing import Optional

from ..models import (
    ConsistencyCheck,
    KoteiShisanLand,
    PropertyEvaluation,
    TohonLand,
    ValuationResult,
)

# 地目と倍率キーの対応
CHIMOKU_TO_KEY = {
    "宅地": "residential",
    "田": "paddy",
    "畑": "field",
    "山林": "forest",
    "原野": "wasteland",
    "牧場": "pasture",
    "池沼": "pond",
}

# 倍率表の生値に付く可能性のあるプレフィックス
KNOWN_PREFIXES = ["純", "中", "周", "比準", "市比準", "路線"]


def parse_multiplier_value(raw: str) -> tuple[str, Optional[float]]:
    """倍率表の生値からプレフィックスと数値を抽出する.

    Args:
        raw: 倍率表の値（例: "1.1", "純18", "比準", "―"）

    Returns:
        (prefix, numeric_value) のタプル。数値化できない場合 numeric_value は None。

    Examples:
        >>> parse_multiplier_value("1.1")
        ('', 1.1)
        >>> parse_multiplier_value("純18")
        ('純', 18.0)
        >>> parse_multiplier_value("比準")
        ('比準', None)
        >>> parse_multiplier_value("―")
        ('', None)
    """
    if not raw:
        return "", None
    s = str(raw).strip()
    if s in ("―", "-", "—", ""):
        return "", None

    # プレフィックス抽出
    prefix = ""
    for p in KNOWN_PREFIXES:
        if s.startswith(p):
            prefix = p
            s = s[len(p):].strip()
            break

    # 数値抽出
    m = re.search(r"(\d+(?:\.\d+)?)", s)
    if m:
        try:
            return prefix, float(m.group(1))
        except ValueError:
            return prefix, None
    return prefix, None


def get_multiplier_for_chimoku(
    multiplier_record: dict,
    chimoku: str,
) -> str:
    """倍率表レコードから地目に応じた倍率を取得."""
    key = CHIMOKU_TO_KEY.get(chimoku, "")
    if not key:
        return ""
    return str(multiplier_record.get(key, "") or "").strip()


def _share_to_fraction(share: str) -> Optional[float]:
    """持分文字列を小数に変換（例: "2分の1" → 0.5, "単独所有" → 1.0）."""
    if not share:
        return None
    s = share.strip()
    if "単独" in s:
        return 1.0
    m = re.search(r"(\d+)\s*分の\s*(\d+)", s)
    if m:
        denom = int(m.group(1))
        numer = int(m.group(2))
        if denom > 0:
            return numer / denom
    # "1/2" 形式
    m = re.search(r"(\d+)\s*/\s*(\d+)", s)
    if m:
        numer = int(m.group(1))
        denom = int(m.group(2))
        if denom > 0:
            return numer / denom
    return None


def calculate_valuation(
    assessed_value: Optional[int],
    chimoku: str,
    multiplier_record: dict,
    share_fraction: Optional[float] = None,
) -> ValuationResult:
    """倍率方式による相続税評価額を算出.

    Args:
        assessed_value: 固定資産税評価額（円）
        chimoku: 評価に用いる地目（宅地/田/畑/山林/原野 等）
        multiplier_record: 倍率表の1レコード（town_name, area_name, residential, paddy, ... を含む辞書）
        share_fraction: 持分（例: 0.5）。None なら 1.0 として計算。

    Returns:
        ValuationResult
    """
    result = ValuationResult(
        method="倍率方式",
        chimoku_used=chimoku,
        assessed_value=assessed_value,
        share_fraction=share_fraction,
        town_name=multiplier_record.get("town_name", "") if multiplier_record else "",
        area_name=multiplier_record.get("area_name", "") if multiplier_record else "",
        leasehold_ratio=multiplier_record.get("leasehold_ratio", "") if multiplier_record else "",
    )

    if not multiplier_record:
        result.warnings.append("倍率表レコードが指定されていません")
        return result

    raw = get_multiplier_for_chimoku(multiplier_record, chimoku)
    result.multiplier_raw = raw

    if not raw:
        result.warnings.append(f"{chimoku} の倍率が倍率表に記載されていません")
        return result

    prefix, value = parse_multiplier_value(raw)
    result.multiplier_prefix = prefix
    result.multiplier_value = value

    # プレフィックス別の判定
    if prefix == "比準" or prefix == "市比準":
        result.method = "宅地比準方式"
        result.warnings.append(
            "宅地比準方式のため、宅地とした場合の価額から造成費等を控除する個別計算が必要です"
        )
        if value is None:
            return result
    elif prefix == "路線":
        result.method = "路線価方式"
        result.warnings.append("路線価方式のため、路線価図を参照した個別計算が必要です")
        return result

    # 純/中/周 は純農地・中間農地・周辺農地の区分を示すが、
    # 数値自体は通常の倍率として使用可能
    if prefix in ("純", "中", "周"):
        label_map = {"純": "純農地（純山林・純原野）", "中": "中間農地（中間山林・中間原野）", "周": "市街地周辺農地（市街地周辺山林・市街地周辺原野）"}
        result.warnings.append(f"区分: {label_map.get(prefix, prefix)}")

    if value is None or assessed_value is None:
        if assessed_value is None:
            result.warnings.append("固定資産税評価額が不明のため計算できません")
        return result

    # 相続税評価額 = 固定資産税評価額 × 倍率
    evaluated = int(round(assessed_value * value))
    result.evaluated_value = evaluated
    result.formula = f"{assessed_value:,}円 × {value} = {evaluated:,}円"

    # 持分考慮
    if share_fraction is not None and share_fraction > 0:
        final = int(round(evaluated * share_fraction))
        result.final_value = final
        result.formula += f" × 持分{share_fraction:.4f} = {final:,}円"
    else:
        result.final_value = evaluated

    return result


# =====================================================================
# 書類間 整合性チェック
# =====================================================================
def check_consistency(
    tohon_land: Optional[TohonLand],
    kotei_land: Optional[KoteiShisanLand],
) -> list[ConsistencyCheck]:
    """謄本と固定資産評価証明の整合性をチェック.

    チェック項目:
        - 登記地目
        - 登記地積
    """
    checks: list[ConsistencyCheck] = []
    if not tohon_land or not kotei_land:
        return checks

    # 登記地目の一致
    t_chimoku = (tohon_land.chimoku_registry or "").strip()
    k_chimoku = (kotei_land.chimoku_registry or "").strip()
    if t_chimoku and k_chimoku:
        is_match = t_chimoku == k_chimoku
        checks.append(ConsistencyCheck(
            field_name="登記地目",
            tohon_value=t_chimoku,
            other_value=k_chimoku,
            other_source="固定資産評価証明",
            is_match=is_match,
            message="一致" if is_match else f"不一致: 謄本={t_chimoku} / 固定資産={k_chimoku}",
        ))

    # 登記地積の一致
    t_area = tohon_land.area_registry_sqm
    k_area = kotei_land.area_registry_sqm
    if t_area is not None and k_area is not None:
        diff = abs(t_area - k_area)
        is_match = diff < 0.01  # 小数第2位まで一致
        checks.append(ConsistencyCheck(
            field_name="登記地積",
            tohon_value=f"{t_area}㎡",
            other_value=f"{k_area}㎡",
            other_source="固定資産評価証明",
            is_match=is_match,
            message="一致" if is_match else f"不一致: 謄本={t_area}㎡ / 固定資産={k_area}㎡",
        ))

    return checks


def select_valuation_chimoku(ev: PropertyEvaluation) -> str:
    """評価に用いる地目を決定する.

    優先順位:
        1. 現況地目（課税地目）
        2. 登記地目
    相続税評価は基本的に現況地目で行う。
    """
    current = ev.chimoku_tax
    if current:
        return current
    return ev.chimoku_registry or ""
