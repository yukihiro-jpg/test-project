"""Excel出力 - 1物件=1行の横長テーブル形式."""

from __future__ import annotations

from io import BytesIO

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

from ..models import PropertyEvaluation

# ------------------------------------------------------------------
# スタイル
# ------------------------------------------------------------------
TITLE_FONT = Font(name="Yu Gothic", bold=True, size=14, color="1F4E79")

GROUP_FILL = PatternFill(start_color="1F4E79", end_color="1F4E79", fill_type="solid")
GROUP_FONT = Font(name="Yu Gothic", bold=True, color="FFFFFF", size=10)

SUBGROUP_FILLS = {
    "登記": PatternFill(start_color="D6E4F0", end_color="D6E4F0", fill_type="solid"),
    "課税": PatternFill(start_color="E2EFDA", end_color="E2EFDA", fill_type="solid"),
    "持分": PatternFill(start_color="FFF2CC", end_color="FFF2CC", fill_type="solid"),
    "建物": PatternFill(start_color="FCE4D6", end_color="FCE4D6", fill_type="solid"),
    "農地": PatternFill(start_color="E2EFDA", end_color="E2EFDA", fill_type="solid"),
    "用途": PatternFill(start_color="DEEBF7", end_color="DEEBF7", fill_type="solid"),
    "ハザード": PatternFill(start_color="FFE699", end_color="FFE699", fill_type="solid"),
    "倍率": PatternFill(start_color="D9E1F2", end_color="D9E1F2", fill_type="solid"),
    "評価": PatternFill(start_color="C6E0B4", end_color="C6E0B4", fill_type="solid"),
    "基本": PatternFill(start_color="F2F2F2", end_color="F2F2F2", fill_type="solid"),
}
SUBGROUP_FONT = Font(name="Yu Gothic", bold=True, size=9, color="333333")
HEADER_FONT = Font(name="Yu Gothic", bold=True, size=9, color="222222")
DATA_FONT = Font(name="Yu Gothic", size=10)
FINAL_FONT = Font(name="Yu Gothic", bold=True, size=11, color="1B5E20")
WARN_FILL = PatternFill(start_color="FFF2CC", end_color="FFF2CC", fill_type="solid")

THIN = Side(style="thin", color="AAAAAA")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
CENTER = Alignment(horizontal="center", vertical="center", wrap_text=True)
LEFT = Alignment(horizontal="left", vertical="center", wrap_text=True)
RIGHT = Alignment(horizontal="right", vertical="center", wrap_text=True)


# ------------------------------------------------------------------
# 列定義: (見出し, 幅, グループ名, 取得関数, 整形後の alignment)
# ------------------------------------------------------------------
def _yen(v):
    if v is None or v == "":
        return ""
    try:
        return f"{int(v):,} 円"
    except (ValueError, TypeError):
        return str(v)


def _sqm(v):
    if v is None or v == "":
        return ""
    return f"{v} ㎡"


def _pct(v):
    if v is None or v == "":
        return ""
    return f"{v}%"


def _build_columns() -> list[tuple[str, int, str, callable, Alignment]]:
    """各列を (見出し, 幅, グループ, getter, alignment) のタプル列で定義."""
    cols: list[tuple[str, int, str, callable, Alignment]] = [
        # --- 基本 ---
        ("No", 5, "基本", lambda ev: ev.property_id, CENTER),
        ("種別", 7, "基本", lambda ev: ev.property_type, CENTER),
        ("所在", 24, "基本", lambda ev: ev.location, LEFT),
        ("地番/家屋番号", 14, "基本",
         lambda ev: (ev.chiban or (ev.tohon_building.kaoku_bango if ev.tohon_building else "")),
         LEFT),
        # --- 登記情報 ---
        ("登記地目", 10, "登記", lambda ev: ev.chimoku_registry, CENTER),
        ("登記地積", 12, "登記", lambda ev: _sqm(ev.area_registry_sqm), RIGHT),
        # --- 課税情報 ---
        ("課税地目(現況)", 12, "課税", lambda ev: ev.chimoku_tax, CENTER),
        ("課税地積", 12, "課税", lambda ev: _sqm(ev.area_tax_sqm), RIGHT),
        ("固定資産税評価額", 16, "課税", lambda ev: _yen(ev.assessed_value), RIGHT),
        # --- 持分 ---
        ("対象者", 12, "持分", lambda ev: ev.ownership.target_name if ev.ownership else "", LEFT),
        ("持分", 10, "持分", lambda ev: ev.ownership.current_share if ev.ownership else "", CENTER),
        # --- 建物情報 ---
        ("種類", 8, "建物",
         lambda ev: (ev.tohon_building.kind if ev.tohon_building
                     else (ev.kotei_building.kind if ev.kotei_building else "")),
         CENTER),
        ("構造", 16, "建物",
         lambda ev: (ev.tohon_building.structure if ev.tohon_building
                     else (ev.kotei_building.structure if ev.kotei_building else "")),
         LEFT),
        ("課税床面積", 12, "建物",
         lambda ev: _sqm(ev.kotei_building.area_tax_sqm) if ev.kotei_building else "",
         RIGHT),
        ("建物評価額", 14, "建物",
         lambda ev: _yen(ev.kotei_building.assessed_value) if ev.kotei_building else "",
         RIGHT),
        ("建築年", 10, "建物",
         lambda ev: ev.kotei_building.construction_year if ev.kotei_building else "",
         CENTER),
        # --- 農地情報 ---
        ("農地区分", 10, "農地",
         lambda ev: ev.nochi_daicho.farm_category if ev.nochi_daicho else "",
         CENTER),
        ("耕作者", 12, "農地",
         lambda ev: ev.nochi_daicho.farmer_name if ev.nochi_daicho else "",
         LEFT),
        ("権利種別", 10, "農地",
         lambda ev: ev.nochi_daicho.right_type if ev.nochi_daicho else "",
         CENTER),
        # --- 用途地域 ---
        ("用途地域", 14, "用途", lambda ev: ev.zoning.zone_type, LEFT),
        ("建ぺい率", 8, "用途", lambda ev: _pct(ev.zoning.building_coverage_ratio), RIGHT),
        ("容積率", 8, "用途", lambda ev: _pct(ev.zoning.floor_area_ratio), RIGHT),
        ("都市計画区域", 14, "用途", lambda ev: ev.zoning.urban_planning_area, LEFT),
        # --- ハザード情報 ---
        ("洪水", 10, "ハザード", lambda ev: ev.hazard.flood_risk or "該当なし", LEFT),
        ("土砂", 10, "ハザード", lambda ev: ev.hazard.landslide_risk or "該当なし", LEFT),
        ("津波", 10, "ハザード", lambda ev: ev.hazard.tsunami_risk or "該当なし", LEFT),
        ("高潮", 10, "ハザード", lambda ev: ev.hazard.storm_surge_risk or "該当なし", LEFT),
        # --- 倍率情報 ---
        ("倍率表町名", 14, "倍率", lambda ev: ev.multiplier.town_name, LEFT),
        ("評価方式区分", 11, "倍率",
         lambda ev: "路線価地域" if ev.multiplier.is_rosenka_area is True else ("倍率地域" if ev.multiplier.is_rosenka_area is False else ""),
         CENTER),
        ("借地権割合", 10, "倍率", lambda ev: ev.multiplier.leasehold_ratio, CENTER),
        ("宅地倍率", 8, "倍率", lambda ev: ev.multiplier.residential_multiplier, CENTER),
        ("田倍率", 8, "倍率", lambda ev: ev.multiplier.paddy_multiplier, CENTER),
        ("畑倍率", 8, "倍率", lambda ev: ev.multiplier.field_multiplier, CENTER),
        ("山林倍率", 8, "倍率", lambda ev: ev.multiplier.forest_multiplier, CENTER),
        # --- 相続税評価額（倍率方式）---
        ("評価地目", 10, "評価",
         lambda ev: ev.valuation.chimoku_used if ev.valuation else "",
         CENTER),
        ("適用倍率", 10, "評価",
         lambda ev: ev.valuation.multiplier_raw if ev.valuation else "",
         CENTER),
        ("評価額(持分前)", 16, "評価",
         lambda ev: _yen(ev.valuation.evaluated_value) if ev.valuation else "",
         RIGHT),
        ("相続税評価額(持分後)", 18, "評価",
         lambda ev: _yen(ev.valuation.final_value) if ev.valuation else "",
         RIGHT),
        ("計算式", 30, "評価",
         lambda ev: ev.valuation.formula if ev.valuation else "",
         LEFT),
        ("注意事項", 28, "評価",
         lambda ev: "／".join(ev.valuation.warnings) if ev.valuation and ev.valuation.warnings else "",
         LEFT),
    ]
    return cols


def export_to_excel(evaluations: list[PropertyEvaluation]) -> bytes:
    """評価基礎情報一覧を Excel ファイル(1物件=1行の横長形式)として出力."""
    wb = Workbook()
    ws = wb.active
    ws.title = "相続税評価 基礎情報一覧"

    columns = _build_columns()

    # 列幅
    for i, (_, width, _, _, _) in enumerate(columns, 1):
        ws.column_dimensions[get_column_letter(i)].width = width

    # タイトル
    total_cols = len(columns)
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=total_cols)
    t = ws.cell(row=1, column=1, value="相続税評価 基礎情報一覧")
    t.font = TITLE_FONT
    t.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[1].height = 22

    # グループヘッダー行（row=2）: 連続する同じグループ名をマージ
    group_row = 2
    header_row = 3
    col_idx = 1
    while col_idx <= total_cols:
        grp = columns[col_idx - 1][2]
        end = col_idx
        while end < total_cols and columns[end][2] == grp:
            end += 1
        # [col_idx, end] (1-indexed, end inclusive)
        if end > col_idx:
            ws.merge_cells(start_row=group_row, start_column=col_idx, end_row=group_row, end_column=end)
        c = ws.cell(row=group_row, column=col_idx, value=grp)
        c.font = GROUP_FONT
        c.fill = GROUP_FILL
        c.alignment = CENTER
        c.border = BORDER
        for k in range(col_idx, end + 1):
            cc = ws.cell(row=group_row, column=k)
            cc.fill = GROUP_FILL
            cc.border = BORDER
        col_idx = end + 1
    ws.row_dimensions[group_row].height = 20

    # 列ヘッダー行（row=3）
    for i, (label, _, group, _, _) in enumerate(columns, 1):
        c = ws.cell(row=header_row, column=i, value=label)
        c.font = HEADER_FONT
        c.fill = SUBGROUP_FILLS.get(group, SUBGROUP_FILLS["基本"])
        c.alignment = CENTER
        c.border = BORDER
    ws.row_dimensions[header_row].height = 32

    # データ行
    for r_offset, ev in enumerate(evaluations):
        row = header_row + 1 + r_offset
        for i, (label, _, group, getter, align) in enumerate(columns, 1):
            try:
                value = getter(ev)
            except Exception:
                value = ""
            cell = ws.cell(row=row, column=i, value=value if value not in (None,) else "")
            cell.font = DATA_FONT
            cell.border = BORDER
            cell.alignment = align
            # ハザードリスクあり → 黄色
            if group == "ハザード" and value and value != "該当なし":
                cell.fill = WARN_FILL
            # 相続税評価額（最終）を強調
            if label == "相続税評価額(持分後)" and value:
                cell.font = FINAL_FONT
                cell.fill = PatternFill(start_color="E8F5E9", end_color="E8F5E9", fill_type="solid")
        ws.row_dimensions[row].height = 28

    # ウィンドウ枠固定（ヘッダー3行 + 先頭4列）
    ws.freeze_panes = ws.cell(row=header_row + 1, column=5)

    # 免責
    footer_row = header_row + 1 + len(evaluations) + 1
    ws.merge_cells(start_row=footer_row, start_column=1, end_row=footer_row, end_column=total_cols)
    f = ws.cell(
        row=footer_row, column=1,
        value="※ 本情報は参考値です。正式な相続税評価には路線価図・評価明細書の確認及び税理士による検証が必要です。",
    )
    f.font = Font(name="Yu Gothic", italic=True, size=9, color="666666")

    output = BytesIO()
    wb.save(output)
    return output.getvalue()
