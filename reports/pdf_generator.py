"""PDF報告書生成"""

import io
from reportlab.platypus import (
    SimpleDocTemplate, Table, Paragraph, Spacer, PageBreak, KeepTogether
)
from reportlab.lib.pagesizes import landscape, A4
from reportlab.lib.units import mm
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.platypus import TableStyle
from config import (
    PAGE_SIZE, MARGIN, FONT_NAME, PL_SUMMARY_ITEMS, PL_TOTAL_ITEMS,
    COLOR_HEADER_BG, COLOR_HEADER_TEXT, COLOR_TOTAL_BG, COLOR_BORDER,
    COLOR_ROW_ALT, COLOR_HIGHLIGHT_RED, COLOR_HIGHLIGHT_GREEN,
    COLOR_TEXT_RED, COLOR_TEXT_GREEN, COLOR_ACCENT,
)
from reports.styles import register_fonts, get_paragraph_style, get_table_style
from reports.chart_generator import (
    generate_pl_trend_chart, generate_loan_balance_chart, generate_debt_vs_ebitda_chart,
)
from utils.formatting import format_yen, format_percent, format_yen_raw


def generate_pdf(report_data: dict, settings: dict) -> bytes:
    """PDF報告書を生成してバイト列を返す"""
    register_fonts()

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=PAGE_SIZE,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=MARGIN,
        bottomMargin=MARGIN,
    )

    elements = []
    unit = settings.get("display_unit", 1000)
    unit_label = {1: "円", 1000: "千円", 1000000: "百万円"}.get(unit, "千円")

    # 1. 表紙
    elements.extend(_build_cover(settings))
    elements.append(PageBreak())

    # 2. PLサマリー
    if "pl_summary" in report_data:
        elements.extend(_build_pl_summary(report_data["pl_summary"], settings, unit, unit_label))
        elements.append(PageBreak())

    # 3. 3期比較PL
    if "variance_single" in report_data:
        elements.extend(_build_comparative_pl(
            report_data["variance_single"], report_data.get("variance_cumulative", []),
            report_data.get("periods", []), settings, unit, unit_label
        ))
        elements.append(PageBreak())

    # 4. 借入金スケジュール
    if "loan_schedule" in report_data:
        elements.extend(_build_loan_schedule(report_data["loan_schedule"], settings, unit, unit_label))
        elements.append(PageBreak())

    # 5. 運転資本・EBITDA・返済原資
    if "repayment_capacity" in report_data:
        elements.extend(_build_working_capital(
            report_data.get("working_capital", {}),
            report_data.get("ebitda", {}),
            report_data["repayment_capacity"],
            settings, unit, unit_label
        ))
        elements.append(PageBreak())

    # 6. 決算着地見込み
    if "forecast" in report_data:
        elements.extend(_build_forecast(report_data["forecast"], settings, unit, unit_label))
        elements.append(PageBreak())

    # 7. 月次推移PL
    if "monthly_transition" in report_data:
        elements.extend(_build_monthly_transition(
            report_data["monthly_transition"], report_data.get("months", []),
            settings, unit, unit_label
        ))
        elements.append(PageBreak())

    # 8. 月次推移グラフ（売上高・売上総利益・営業利益）
    if "monthly_transition" in report_data:
        chart = generate_pl_trend_chart(
            report_data["monthly_transition"], report_data.get("months", []), unit
        )
        if chart:
            elements.append(_p("月次推移グラフ", 14, "LEFT"))
            elements.append(Spacer(1, 8))
            elements.append(chart)
            elements.append(PageBreak())

    # 9. 借入金残高推移グラフ
    if "loan_schedule" in report_data:
        chart = generate_loan_balance_chart(report_data["loan_schedule"], unit)
        if chart:
            elements.append(_p("借入金残高推移", 14, "LEFT"))
            elements.append(Spacer(1, 8))
            elements.append(chart)
            elements.append(Spacer(1, 16))

        # 10. 借入金 vs EBITDAグラフ
        ebitda_data = report_data.get("ebitda", {})
        chart2 = generate_debt_vs_ebitda_chart(
            report_data["loan_schedule"], ebitda_data, unit
        )
        if chart2:
            elements.append(PageBreak())
            elements.append(_p("借入金残高 vs EBITDA 比較分析", 14, "LEFT"))
            elements.append(Spacer(1, 8))
            elements.append(chart2)

    doc.build(elements)
    return buffer.getvalue()


def _p(text, size=8, align="LEFT", bold=False):
    """Paragraph ヘルパー"""
    alignment = {"LEFT": 0, "CENTER": 1, "RIGHT": 2}.get(align, 0)
    style = get_paragraph_style(f"s_{size}_{align}", font_size=size, alignment=alignment, bold=bold)
    return Paragraph(str(text), style)


def _build_cover(settings):
    """表紙"""
    elements = []
    elements.append(Spacer(1, 120))
    elements.append(_p(settings.get("company_name", ""), 24, "CENTER"))
    elements.append(Spacer(1, 40))
    elements.append(_p(settings.get("report_title", "月次経営報告書"), 28, "CENTER"))
    elements.append(Spacer(1, 30))

    report_date = settings.get("report_date")
    date_str = report_date.strftime("%Y年%m月%d日") if report_date else ""
    elements.append(_p(date_str, 14, "CENTER"))

    year = settings.get("current_year", "")
    month = settings.get("current_month", "")
    elements.append(Spacer(1, 20))
    elements.append(_p(f"報告対象月：{year}年{month}月", 14, "CENTER"))

    return elements


def _build_pl_summary(summary_data, settings, unit, unit_label):
    """PLサマリーページ"""
    elements = []
    elements.append(_p("損益計算書サマリー", 14, "LEFT"))
    elements.append(_p(f"（単位：{unit_label}）", 8, "RIGHT"))
    elements.append(Spacer(1, 8))

    headers = ["科目", "当月", "構成比", "累計", "構成比"]
    data = [headers]
    total_rows = []

    for i, item in enumerate(summary_data["items"]):
        row = [
            item["account"],
            format_yen(item["current_month"], unit),
            format_percent(item["ratio_current"]),
            format_yen(item["ytd"], unit),
            format_percent(item["ratio_ytd"]),
        ]
        data.append(row)
        if item["account"] in PL_TOTAL_ITEMS:
            total_rows.append(i + 1)

    col_widths = [160, 100, 60, 100, 60]
    table = Table(data, colWidths=col_widths)
    style = get_table_style(len(data) - 1, total_rows)
    table.setStyle(style)

    elements.append(table)
    return elements


def _build_comparative_pl(variance_single, variance_cumulative, periods, settings, unit, unit_label):
    """3期比較PLページ"""
    elements = []
    elements.append(_p("3期比較損益計算書（全科目）", 14, "LEFT"))
    elements.append(_p(f"（単位：{unit_label}）", 8, "RIGHT"))
    elements.append(Spacer(1, 8))

    # 単月比較
    if variance_single:
        elements.append(_p("【単月比較】", 10, "LEFT"))
        elements.append(Spacer(1, 4))
        elements.extend(_build_variance_table(variance_single, periods, unit))
        elements.append(Spacer(1, 12))

    # 累積比較
    if variance_cumulative:
        elements.append(_p("【累積比較】", 10, "LEFT"))
        elements.append(Spacer(1, 4))
        elements.extend(_build_variance_table(variance_cumulative, periods, unit))

    return elements


def _build_variance_table(variance_data, periods, unit):
    """増減分析テーブルを生成"""
    elements = []

    # ヘッダー構築
    headers = ["科目"]
    for p in periods:
        headers.append(p)
    if len(periods) >= 2:
        headers.append("増減額")
        headers.append("増減率")

    data = [headers]
    highlight_cells = []

    for i, item in enumerate(variance_data):
        row = [item["account"]]
        for p in periods:
            row.append(format_yen(item["values"].get(p, 0), unit))

        if item["changes"]:
            last_change = item["changes"][-1]
            row.append(format_yen(last_change["amount"], unit) if last_change["amount"] is not None else "-")
            row.append(format_percent(last_change["rate"]))

            if last_change.get("is_significant") and last_change["amount"] is not None:
                col_idx = len(periods) + 1
                is_positive = last_change["amount"] > 0
                highlight_cells.append((i + 1, col_idx, is_positive))

        data.append(row)

    num_cols = len(headers)
    base_width = 700 / num_cols
    col_widths = [140] + [base_width] * (num_cols - 1)
    # 最初列は広め
    remaining = 700 - 140
    col_widths = [140] + [remaining / (num_cols - 1)] * (num_cols - 1)

    table = Table(data, colWidths=col_widths)
    style_cmds = get_table_style(len(data) - 1)

    # ハイライト追加
    extra_cmds = []
    for row_idx, col_idx, is_positive in highlight_cells:
        color = COLOR_HIGHLIGHT_GREEN if is_positive else COLOR_HIGHLIGHT_RED
        extra_cmds.append(("BACKGROUND", (col_idx, row_idx), (col_idx, row_idx), color))

    if extra_cmds:
        all_cmds = list(style_cmds.getCommands()) + extra_cmds
        style_cmds = TableStyle(all_cmds)

    table.setStyle(style_cmds)
    # フォントサイズを小さくして多くの科目を収容
    table.setStyle(TableStyle([("FONTSIZE", (0, 0), (-1, -1), 6.5)]))

    elements.append(table)
    return elements


def _build_loan_schedule(loan_data, settings, unit, unit_label):
    """借入金スケジュールページ"""
    elements = []
    elements.append(_p("借入金返済スケジュール", 14, "LEFT"))
    elements.append(_p(f"（単位：{unit_label}）", 8, "RIGHT"))
    elements.append(Spacer(1, 8))

    headers = ["契約名", "借入先", "種別", "借入残高", "月額返済", "年利率", "残回数", "残期間"]
    data = [headers]

    for contract in loan_data["contracts"]:
        data.append([
            contract["name"],
            contract.get("lender", ""),
            contract.get("loan_type", ""),
            format_yen(contract["remaining_balance"], unit),
            format_yen(contract["monthly_payment"], unit),
            f"{contract.get('interest_rate', 0):.2f}%",
            f"{contract['remaining_payments']}回" if contract["remaining_payments"] else "-",
            contract["remaining_period_str"],
        ])

    # 合計行
    total = loan_data["total"]
    data.append([
        "合計", "", "",
        format_yen(total["total_balance"], unit),
        format_yen(total["total_monthly_payment"], unit),
        "", "", "",
    ])

    col_widths = [95, 80, 45, 85, 85, 55, 60, 80]
    table = Table(data, colWidths=col_widths)
    style = get_table_style(len(data) - 1, total_rows=[len(data) - 1])
    table.setStyle(style)

    elements.append(table)

    # 年間返済合計の注記
    elements.append(Spacer(1, 8))
    elements.append(_p(f"年間返済合計: {format_yen(total['total_annual_payment'], unit)} {unit_label}", 9))

    return elements


def _build_working_capital(wc_data, ebitda_data, repayment_data, settings, unit, unit_label):
    """運転資本・EBITDA・返済原資ページ"""
    elements = []
    elements.append(_p("運転資本・EBITDA・返済原資分析", 14, "LEFT"))
    elements.append(_p(f"（単位：{unit_label}）", 8, "RIGHT"))
    elements.append(Spacer(1, 8))

    # 運転資本テーブル
    elements.append(_p("【運転資本】", 10, "LEFT"))
    elements.append(Spacer(1, 4))

    wc_table_data = [
        ["項目", "金額"],
        ["流動資産", format_yen(wc_data.get("current_assets", 0), unit)],
        ["流動負債", format_yen(wc_data.get("current_liabilities", 0), unit)],
        ["運転資本（流動資産−流動負債）", format_yen(wc_data.get("working_capital", 0), unit)],
    ]
    table = Table(wc_table_data, colWidths=[300, 150])
    table.setStyle(get_table_style(3, total_rows=[3]))
    elements.append(table)
    elements.append(Spacer(1, 12))

    # EBITDA テーブル
    elements.append(_p("【EBITDA】", 10, "LEFT"))
    elements.append(Spacer(1, 4))

    ebitda_table_data = [
        ["項目", "金額"],
        ["営業利益", format_yen(ebitda_data.get("operating_income", 0), unit)],
        ["減価償却費", format_yen(ebitda_data.get("depreciation", 0), unit)],
        ["EBITDA（営業利益＋減価償却費）", format_yen(ebitda_data.get("ebitda", 0), unit)],
    ]
    table = Table(ebitda_table_data, colWidths=[300, 150])
    table.setStyle(get_table_style(3, total_rows=[3]))
    elements.append(table)
    elements.append(Spacer(1, 12))

    # 返済原資分析
    elements.append(_p("【返済原資の十分性】", 10, "LEFT"))
    elements.append(Spacer(1, 4))

    coverage = repayment_data.get("coverage_ratio")
    coverage_str = f"{coverage:.2f}倍" if coverage else "-"
    status = "十分" if repayment_data.get("is_sufficient") else "要注意"

    repay_table_data = [
        ["項目", "金額"],
        ["EBITDA", format_yen(repayment_data.get("ebitda", 0), unit)],
        ["運転資本増減", format_yen(repayment_data.get("working_capital_change", 0), unit)],
        ["返済原資（EBITDA−運転資本増加）", format_yen(repayment_data.get("repayment_source", 0), unit)],
        ["年間返済額", format_yen(repayment_data.get("annual_repayment", 0), unit)],
        ["返済カバー率", coverage_str],
        ["判定", status],
    ]
    table = Table(repay_table_data, colWidths=[300, 150])
    style = get_table_style(6, total_rows=[3, 5])

    # 判定行の色付け
    if repayment_data.get("is_sufficient"):
        style.add("BACKGROUND", (1, 6), (1, 6), COLOR_HIGHLIGHT_GREEN)
    else:
        style.add("BACKGROUND", (1, 6), (1, 6), COLOR_HIGHLIGHT_RED)

    table.setStyle(style)
    elements.append(table)

    return elements


def _build_forecast(forecast_data, settings, unit, unit_label):
    """決算着地見込みページ"""
    elements = []
    elements.append(_p("決算着地見込み", 14, "LEFT"))
    elapsed = forecast_data.get("elapsed", 0)
    remaining = forecast_data.get("remaining", 0)
    elements.append(_p(
        f"（単位：{unit_label}）　経過{elapsed}ヶ月 / 残{remaining}ヶ月",
        8, "RIGHT"
    ))
    elements.append(Spacer(1, 8))

    headers = ["科目", "実績累計", "パターンA（平均推計）", "パターンB（前期推計）"]
    data = [headers]

    accounts = list(forecast_data.get("actual_ytd", {}).keys())
    # サマリー科目のみ表示
    display_accounts = [a for a in PL_SUMMARY_ITEMS if a in accounts]
    if not display_accounts:
        display_accounts = accounts

    total_rows = []
    for i, account in enumerate(display_accounts):
        row = [
            account,
            format_yen(forecast_data["actual_ytd"].get(account, 0), unit),
            format_yen(forecast_data["pattern_a"].get(account, 0), unit),
            format_yen(forecast_data["pattern_b"].get(account, 0), unit),
        ]
        data.append(row)
        if account in PL_TOTAL_ITEMS:
            total_rows.append(i + 1)

    col_widths = [160, 140, 160, 160]
    table = Table(data, colWidths=col_widths)
    table.setStyle(get_table_style(len(data) - 1, total_rows))

    elements.append(table)

    elements.append(Spacer(1, 12))
    elements.append(_p("パターンA：残期間を当期実績の月平均値で推計", 8))
    elements.append(_p("パターンB：残期間を前期同月実績で推計", 8))

    return elements


def _build_monthly_transition(transition_data, months, settings, unit, unit_label):
    """月次推移PLページ"""
    elements = []
    elements.append(_p("月次推移損益計算書", 14, "LEFT"))
    elements.append(_p(f"（単位：{unit_label}）", 8, "RIGHT"))
    elements.append(Spacer(1, 8))

    # 月名を短縮
    short_months = []
    for m in months:
        # "2024/04" -> "4月" のように短縮
        try:
            parts = m.replace("年", "/").replace("月", "").split("/")
            if len(parts) >= 2:
                short_months.append(f"{int(parts[-1])}月")
            else:
                short_months.append(m[:6])
        except (ValueError, IndexError):
            short_months.append(m[:6])

    headers = ["科目"] + short_months
    data = [headers]

    accounts = list(transition_data.keys())
    display_accounts = [a for a in PL_SUMMARY_ITEMS if a in accounts]
    if not display_accounts:
        display_accounts = accounts[:20]

    total_rows = []
    for i, account in enumerate(display_accounts):
        values = transition_data.get(account, {})
        row = [account] + [format_yen(values.get(m, 0), unit) for m in months]
        data.append(row)
        if account in PL_TOTAL_ITEMS:
            total_rows.append(i + 1)

    # 列幅を計算（A4横に収まるように）
    available_width = 770
    account_col_width = 120
    month_col_width = (available_width - account_col_width) / max(len(months), 1)
    col_widths = [account_col_width] + [month_col_width] * len(months)

    table = Table(data, colWidths=col_widths)
    style = get_table_style(len(data) - 1, total_rows)
    # 月次推移は小さいフォントで
    style.add("FONTSIZE", (0, 0), (-1, -1), 6)
    table.setStyle(style)

    elements.append(table)
    return elements
