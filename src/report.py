"""基礎情報一覧のレポート出力."""

from __future__ import annotations

from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from .models import LandEvaluationBase


def render_report(data: LandEvaluationBase) -> str:
    """基礎情報一覧をテキストレポートとして出力."""
    lines: list[str] = []
    lines.append("=" * 60)
    lines.append("  相続税土地評価 基礎情報一覧")
    lines.append("=" * 60)
    lines.append(f"  取得日: {data.retrieval_date}")
    lines.append(f"  データソース: {', '.join(data.data_sources)}")
    lines.append("")

    # 基本情報
    lines.append("■ 基本情報")
    lines.append(f"  対象地: {data.input_address}")
    lines.append(f"  都道府県: {data.prefecture}")
    lines.append(f"  市区町村: {data.municipality}")
    if data.latitude and data.longitude:
        lines.append(f"  座標: {data.latitude}, {data.longitude}")
    lines.append("")

    # 用途地域・都市計画
    lines.append("■ 用途地域・都市計画")
    lines.append(f"  用途地域: {data.zone_type.value}")
    lines.append(f"  都市計画区域: {data.urban_planning_area.value}")
    if data.building_coverage_ratio is not None:
        lines.append(f"  建ぺい率: {data.building_coverage_ratio}%")
    if data.floor_area_ratio is not None:
        lines.append(f"  容積率: {data.floor_area_ratio}%")
    lines.append("")

    # 土地情報
    lines.append("■ 土地情報")
    if data.land_area_sqm is not None:
        lines.append(f"  地積: {data.land_area_sqm}㎡")
    lines.append(f"  形状: {data.land_shape.value}")
    if data.front_road_width_m is not None:
        lines.append(f"  前面道路幅員: {data.front_road_width_m}m")
    if data.front_road_direction:
        lines.append(f"  前面道路方位: {data.front_road_direction}")
    lines.append("")

    # 交通
    lines.append("■ 交通")
    if data.nearest_station:
        lines.append(f"  最寄駅: {data.nearest_station}")
    if data.station_distance_min is not None:
        lines.append(f"  最寄駅距離: 徒歩{data.station_distance_min}分")
    lines.append("")

    # 公示地価
    lines.append("■ 公示地価・基準地価（周辺）")
    if data.official_land_prices:
        for p in data.official_land_prices[:5]:
            dist_str = f" (距離: {p.distance_m:.0f}m)" if p.distance_m else ""
            lines.append(
                f"  {p.year}年 {p.location_name}: {p.price_per_sqm:,}円/㎡{dist_str}"
            )
    else:
        lines.append("  データなし")
    lines.append("")

    # 取引事例
    lines.append("■ 不動産取引事例（周辺）")
    if data.transaction_records:
        for t in data.transaction_records[:5]:
            price_str = (
                f"{t.price_per_sqm:,}円/㎡" if t.price_per_sqm else "価格不明"
            )
            lines.append(f"  {t.transaction_date} {price_str}")
            if t.land_area_sqm:
                lines.append(f"    地積: {t.land_area_sqm}㎡")
            if t.zone_type:
                lines.append(f"    用途地域: {t.zone_type}")
    else:
        lines.append("  データなし")
    lines.append("")

    # ハザード情報
    lines.append("■ ハザード情報")
    h = data.hazard_info
    if h.flood_risk_level:
        lines.append(f"  洪水リスク: {h.flood_risk_level}")
    if h.flood_depth_m is not None:
        lines.append(f"  想定浸水深: {h.flood_depth_m}m")
    if h.landslide_risk:
        lines.append("  土砂災害: リスクあり")
    if h.tsunami_risk_level:
        lines.append(f"  津波リスク: {h.tsunami_risk_level}")
    if not any([h.flood_risk_level, h.flood_depth_m, h.landslide_risk, h.tsunami_risk_level]):
        lines.append("  データなし")
    lines.append("")

    # 相続税評価上の留意点
    lines.append("■ 相続税評価における留意点")
    notes = _generate_evaluation_notes(data)
    for note in notes:
        lines.append(f"  ・{note}")
    lines.append("")

    # 注記
    if data.notes:
        lines.append("■ 注記")
        for note in data.notes:
            lines.append(f"  ※ {note}")
        lines.append("")

    lines.append("=" * 60)
    lines.append("※ 本情報は参考値です。正式な相続税評価には")
    lines.append("  路線価図・評価明細書の確認が必要です。")
    lines.append("=" * 60)

    return "\n".join(lines)


def print_report_rich(data: LandEvaluationBase) -> None:
    """Richライブラリを使ったリッチ表示."""
    console = Console()
    text = render_report(data)
    console.print(Panel(text, title="相続税土地評価 基礎情報", border_style="blue"))


def _generate_evaluation_notes(data: LandEvaluationBase) -> list[str]:
    """基礎情報から相続税評価上の留意点を自動生成."""
    notes: list[str] = []

    # 用途地域に基づく注意点
    if "調整" in data.zone_type.value or data.urban_planning_area.value == "市街化調整区域":
        notes.append("市街化調整区域の場合、しんしゃく割合による減額が可能な場合があります")

    # 地形に基づく注意点
    if data.land_shape.value in ("不整形", "旗竿地", "三角形"):
        notes.append(f"土地形状が「{data.land_shape.value}」のため、不整形地補正率の適用を検討")

    # 前面道路
    if data.front_road_width_m and data.front_road_width_m < 4.0:
        notes.append("前面道路幅員4m未満のため、セットバック部分の評価減を検討")

    # 地積
    if data.land_area_sqm:
        if data.land_area_sqm >= 500:
            notes.append("地積500㎡以上のため、地積規模の大きな宅地の評価（規模格差補正率）を検討")
        if data.land_area_sqm >= 1000:
            notes.append("広大地に該当する可能性があるため、評価方法の検討が必要")

    # ハザード
    h = data.hazard_info
    if h.flood_risk_level or h.landslide_risk or h.tsunami_risk_level:
        notes.append("災害リスクエリアに所在。利用価値が著しく低下している宅地の10%評価減を検討")

    # 公示地価との比較
    if data.official_land_prices and data.transaction_records:
        notes.append("公示地価と取引事例を比較し、時価と相続税評価額の乖離を確認してください")

    if not notes:
        notes.append("特記事項なし（詳細は路線価図・評価明細書で確認してください）")

    return notes
