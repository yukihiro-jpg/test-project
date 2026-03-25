"""Excel報告書生成"""

import io
import pandas as pd
from config import PL_SUMMARY_ITEMS, PL_TOTAL_ITEMS
from utils.formatting import format_yen_raw


def generate_excel(report_data: dict, settings: dict) -> bytes:
    """Excel報告書を生成してバイト列を返す"""
    buffer = io.BytesIO()
    unit = settings.get("display_unit", 1000)
    unit_label = {1: "円", 1000: "千円", 1000000: "百万円"}.get(unit, "千円")

    with pd.ExcelWriter(buffer, engine="xlsxwriter") as writer:
        workbook = writer.book

        # 共通フォーマット
        header_fmt = workbook.add_format({
            "bold": True, "bg_color": "#2C3E50", "font_color": "#FFFFFF",
            "border": 1, "font_size": 9, "text_wrap": True, "align": "center",
        })
        number_fmt = workbook.add_format({
            "num_format": "#,##0", "border": 1, "font_size": 9, "align": "right",
        })
        text_fmt = workbook.add_format({
            "border": 1, "font_size": 9,
        })
        total_fmt = workbook.add_format({
            "bold": True, "bg_color": "#EBF5FB", "num_format": "#,##0",
            "border": 1, "font_size": 9, "align": "right",
        })
        total_text_fmt = workbook.add_format({
            "bold": True, "bg_color": "#EBF5FB",
            "border": 1, "font_size": 9,
        })
        pct_fmt = workbook.add_format({
            "num_format": "0.0%", "border": 1, "font_size": 9, "align": "right",
        })
        highlight_red_fmt = workbook.add_format({
            "num_format": "#,##0", "border": 1, "font_size": 9,
            "align": "right", "bg_color": "#FADBD8",
        })
        highlight_green_fmt = workbook.add_format({
            "num_format": "#,##0", "border": 1, "font_size": 9,
            "align": "right", "bg_color": "#D5F5E3",
        })

        # 1. PLサマリー
        if "pl_summary" in report_data:
            _write_pl_summary(writer, workbook, report_data["pl_summary"],
                              unit, unit_label, header_fmt, number_fmt, text_fmt,
                              total_fmt, total_text_fmt, pct_fmt)

        # 2. 3期比較PL（単月）
        if "variance_single" in report_data:
            _write_variance(writer, workbook, report_data["variance_single"],
                            report_data.get("periods", []),
                            "3期比較PL_単月", unit, unit_label,
                            header_fmt, number_fmt, text_fmt, total_fmt, total_text_fmt,
                            highlight_red_fmt, highlight_green_fmt)

        # 3. 3期比較PL（累積）
        if "variance_cumulative" in report_data:
            _write_variance(writer, workbook, report_data["variance_cumulative"],
                            report_data.get("periods", []),
                            "3期比較PL_累積", unit, unit_label,
                            header_fmt, number_fmt, text_fmt, total_fmt, total_text_fmt,
                            highlight_red_fmt, highlight_green_fmt)

        # 4. 借入金スケジュール
        if "loan_schedule" in report_data:
            _write_loan_schedule(writer, workbook, report_data["loan_schedule"],
                                 unit, unit_label, header_fmt, number_fmt, text_fmt,
                                 total_fmt, total_text_fmt)

        # 5. 運転資本・EBITDA
        if "repayment_capacity" in report_data:
            _write_working_capital(writer, workbook, report_data, unit, unit_label,
                                   header_fmt, number_fmt, text_fmt, total_fmt, total_text_fmt)

        # 6. 決算着地見込み
        if "forecast" in report_data:
            _write_forecast(writer, workbook, report_data["forecast"],
                            unit, unit_label, header_fmt, number_fmt, text_fmt,
                            total_fmt, total_text_fmt)

        # 7. 月次推移PL
        if "monthly_transition" in report_data:
            _write_monthly_transition(writer, workbook, report_data["monthly_transition"],
                                      report_data.get("months", []),
                                      unit, unit_label, header_fmt, number_fmt, text_fmt,
                                      total_fmt, total_text_fmt)

    return buffer.getvalue()


def _write_pl_summary(writer, workbook, summary_data, unit, unit_label,
                       header_fmt, number_fmt, text_fmt, total_fmt, total_text_fmt, pct_fmt):
    """PLサマリーシート"""
    ws = workbook.add_worksheet("PLサマリー")
    writer.sheets["PLサマリー"] = ws

    ws.write(0, 0, f"損益計算書サマリー（単位：{unit_label}）", header_fmt)
    ws.merge_range(0, 0, 0, 4, f"損益計算書サマリー（単位：{unit_label}）", header_fmt)

    headers = ["科目", "当月", "構成比", "累計", "構成比"]
    for col, h in enumerate(headers):
        ws.write(1, col, h, header_fmt)

    for i, item in enumerate(summary_data["items"]):
        row = i + 2
        is_total = item["account"] in PL_TOTAL_ITEMS
        t_fmt = total_text_fmt if is_total else text_fmt
        n_fmt = total_fmt if is_total else number_fmt

        ws.write(row, 0, item["account"], t_fmt)
        ws.write(row, 1, format_yen_raw(item["current_month"], unit), n_fmt)
        ws.write(row, 2, item["ratio_current"] / 100 if item["ratio_current"] else "", pct_fmt)
        ws.write(row, 3, format_yen_raw(item["ytd"], unit), n_fmt)
        ws.write(row, 4, item["ratio_ytd"] / 100 if item["ratio_ytd"] else "", pct_fmt)

    ws.set_column(0, 0, 25)
    ws.set_column(1, 4, 15)


def _write_variance(writer, workbook, variance_data, periods, sheet_name,
                     unit, unit_label, header_fmt, number_fmt, text_fmt,
                     total_fmt, total_text_fmt, highlight_red_fmt, highlight_green_fmt):
    """増減分析シート"""
    ws = workbook.add_worksheet(sheet_name)
    writer.sheets[sheet_name] = ws

    headers = ["科目"] + periods
    if len(periods) >= 2:
        headers += ["増減額", "増減率"]

    for col, h in enumerate(headers):
        ws.write(0, col, h, header_fmt)

    for i, item in enumerate(variance_data):
        row = i + 1
        is_total = item["account"] in PL_TOTAL_ITEMS

        ws.write(row, 0, item["account"], total_text_fmt if is_total else text_fmt)

        for j, p in enumerate(periods):
            val = format_yen_raw(item["values"].get(p, 0), unit)
            ws.write(row, j + 1, val, total_fmt if is_total else number_fmt)

        if item["changes"]:
            last_change = item["changes"][-1]
            change_col = len(periods) + 1

            if last_change["amount"] is not None:
                change_val = format_yen_raw(last_change["amount"], unit)
                if last_change.get("is_significant"):
                    fmt = highlight_green_fmt if last_change["amount"] > 0 else highlight_red_fmt
                else:
                    fmt = number_fmt
                ws.write(row, change_col, change_val, fmt)

            if last_change["rate"] is not None:
                ws.write(row, change_col + 1, f"{last_change['rate']:.1f}%", text_fmt)

    ws.set_column(0, 0, 25)
    ws.set_column(1, len(headers) - 1, 15)


def _write_loan_schedule(writer, workbook, loan_data, unit, unit_label,
                          header_fmt, number_fmt, text_fmt, total_fmt, total_text_fmt):
    """借入金スケジュールシート"""
    ws = workbook.add_worksheet("借入金スケジュール")
    writer.sheets["借入金スケジュール"] = ws

    headers = ["契約名", "借入先", "種別", "借入残高", "月額返済", "年利率", "残回数", "残期間"]
    for col, h in enumerate(headers):
        ws.write(0, col, h, header_fmt)

    for i, contract in enumerate(loan_data["contracts"]):
        row = i + 1
        ws.write(row, 0, contract["name"], text_fmt)
        ws.write(row, 1, contract.get("lender", ""), text_fmt)
        ws.write(row, 2, contract.get("loan_type", ""), text_fmt)
        ws.write(row, 3, format_yen_raw(contract["remaining_balance"], unit), number_fmt)
        ws.write(row, 4, format_yen_raw(contract["monthly_payment"], unit), number_fmt)
        ws.write(row, 5, f"{contract.get('interest_rate', 0):.2f}%", text_fmt)
        rp = contract["remaining_payments"]
        ws.write(row, 6, f"{rp}回" if rp else "-", text_fmt)
        ws.write(row, 7, contract["remaining_period_str"], text_fmt)

    # 合計行
    total = loan_data["total"]
    total_row = len(loan_data["contracts"]) + 1
    ws.write(total_row, 0, "合計", total_text_fmt)
    ws.write(total_row, 3, format_yen_raw(total["total_balance"], unit), total_fmt)
    ws.write(total_row, 4, format_yen_raw(total["total_monthly_payment"], unit), total_fmt)

    ws.set_column(0, 0, 20)
    ws.set_column(1, 7, 15)


def _write_working_capital(writer, workbook, report_data, unit, unit_label,
                            header_fmt, number_fmt, text_fmt, total_fmt, total_text_fmt):
    """運転資本・EBITDA シート"""
    ws = workbook.add_worksheet("運転資本_EBITDA")
    writer.sheets["運転資本_EBITDA"] = ws

    wc = report_data.get("working_capital", {})
    ebitda = report_data.get("ebitda", {})
    repay = report_data["repayment_capacity"]

    items = [
        ("【運転資本】", ""),
        ("流動資産", format_yen_raw(wc.get("current_assets", 0), unit)),
        ("流動負債", format_yen_raw(wc.get("current_liabilities", 0), unit)),
        ("運転資本", format_yen_raw(wc.get("working_capital", 0), unit)),
        ("", ""),
        ("【EBITDA】", ""),
        ("営業利益", format_yen_raw(ebitda.get("operating_income", 0), unit)),
        ("減価償却費", format_yen_raw(ebitda.get("depreciation", 0), unit)),
        ("EBITDA", format_yen_raw(ebitda.get("ebitda", 0), unit)),
        ("", ""),
        ("【返済原資分析】", ""),
        ("返済原資", format_yen_raw(repay.get("repayment_source", 0), unit)),
        ("年間返済額", format_yen_raw(repay.get("annual_repayment", 0), unit)),
        ("返済カバー率", f"{repay['coverage_ratio']:.2f}倍" if repay.get("coverage_ratio") else "-"),
        ("判定", "十分" if repay.get("is_sufficient") else "要注意"),
    ]

    ws.write(0, 0, "項目", header_fmt)
    ws.write(0, 1, f"金額（{unit_label}）", header_fmt)

    for i, (label, value) in enumerate(items):
        row = i + 1
        is_section = label.startswith("【")
        is_total = label in ("運転資本", "EBITDA", "返済原資", "返済カバー率")

        if is_section:
            ws.write(row, 0, label, total_text_fmt)
            ws.write(row, 1, "", total_text_fmt)
        elif is_total:
            ws.write(row, 0, label, total_text_fmt)
            ws.write(row, 1, value, total_fmt if isinstance(value, (int, float)) else total_text_fmt)
        else:
            ws.write(row, 0, label, text_fmt)
            ws.write(row, 1, value, number_fmt if isinstance(value, (int, float)) else text_fmt)

    ws.set_column(0, 0, 30)
    ws.set_column(1, 1, 20)


def _write_forecast(writer, workbook, forecast_data, unit, unit_label,
                     header_fmt, number_fmt, text_fmt, total_fmt, total_text_fmt):
    """決算着地見込みシート"""
    ws = workbook.add_worksheet("決算着地見込み")
    writer.sheets["決算着地見込み"] = ws

    headers = ["科目", "実績累計", "パターンA（平均推計）", "パターンB（前期推計）"]
    for col, h in enumerate(headers):
        ws.write(0, col, h, header_fmt)

    accounts = list(forecast_data.get("actual_ytd", {}).keys())
    display_accounts = [a for a in PL_SUMMARY_ITEMS if a in accounts]
    if not display_accounts:
        display_accounts = accounts

    for i, account in enumerate(display_accounts):
        row = i + 1
        is_total = account in PL_TOTAL_ITEMS
        t_fmt = total_text_fmt if is_total else text_fmt
        n_fmt = total_fmt if is_total else number_fmt

        ws.write(row, 0, account, t_fmt)
        ws.write(row, 1, format_yen_raw(forecast_data["actual_ytd"].get(account, 0), unit), n_fmt)
        ws.write(row, 2, format_yen_raw(forecast_data["pattern_a"].get(account, 0), unit), n_fmt)
        ws.write(row, 3, format_yen_raw(forecast_data["pattern_b"].get(account, 0), unit), n_fmt)

    ws.set_column(0, 0, 25)
    ws.set_column(1, 3, 20)


def _write_monthly_transition(writer, workbook, transition_data, months,
                                unit, unit_label, header_fmt, number_fmt, text_fmt,
                                total_fmt, total_text_fmt):
    """月次推移PLシート"""
    ws = workbook.add_worksheet("月次推移PL")
    writer.sheets["月次推移PL"] = ws

    headers = ["科目"] + months
    for col, h in enumerate(headers):
        ws.write(0, col, h, header_fmt)

    accounts = list(transition_data.keys())
    display_accounts = [a for a in PL_SUMMARY_ITEMS if a in accounts]
    if not display_accounts:
        display_accounts = accounts

    for i, account in enumerate(display_accounts):
        row = i + 1
        is_total = account in PL_TOTAL_ITEMS
        t_fmt = total_text_fmt if is_total else text_fmt
        n_fmt = total_fmt if is_total else number_fmt

        ws.write(row, 0, account, t_fmt)
        values = transition_data.get(account, {})
        for j, m in enumerate(months):
            ws.write(row, j + 1, format_yen_raw(values.get(m, 0), unit), n_fmt)

    ws.set_column(0, 0, 25)
    ws.set_column(1, len(months), 12)
