"""書類間 整合性チェック."""

from __future__ import annotations

from typing import Optional

from ..models import (
    ConsistencyCheck,
    KoteiShisanLand,
    TohonLand,
)


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
        is_match = diff < 0.01
        checks.append(ConsistencyCheck(
            field_name="登記地積",
            tohon_value=f"{t_area}㎡",
            other_value=f"{k_area}㎡",
            other_source="固定資産評価証明",
            is_match=is_match,
            message="一致" if is_match else f"不一致: 謄本={t_area}㎡ / 固定資産={k_area}㎡",
        ))

    return checks
