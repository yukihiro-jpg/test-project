"""レポートプレビューUI"""

import streamlit as st
import pandas as pd
from config import PL_TOTAL_ITEMS, DISPLAY_UNIT_LABEL
from utils.formatting import format_yen, format_percent, format_yen_raw


def render_pl_summary(summary_data: dict, settings: dict):
    """PLサマリーのプレビュー"""
    st.subheader("📊 損益計算書サマリー")
    st.caption(DISPLAY_UNIT_LABEL)

    unit = settings.get("display_unit", 1000)
    rows = []
    for item in summary_data["items"]:
        rows.append({
            "科目": item["account"],
            "当月": format_yen(item["current_month"], unit),
            "累計": format_yen(item["ytd"], unit),
            "当月構成比": format_percent(item["ratio_current"]),
            "累計構成比": format_percent(item["ratio_ytd"]),
        })

    df = pd.DataFrame(rows)
    st.dataframe(df, use_container_width=True, hide_index=True)


def render_comparative_pl(variance_data: list, periods: list, settings: dict):
    """3期比較PLのプレビュー"""
    st.subheader("📈 3期比較損益計算書")
    st.caption(DISPLAY_UNIT_LABEL)

    unit = settings.get("display_unit", 1000)
    rows = []
    for item in variance_data:
        row = {"科目": item["account"]}
        for period in periods:
            row[period] = format_yen(item["values"].get(period, 0), unit)

        for change in item["changes"]:
            label = f"増減({change['from']}→{change['to']})"
            row[label] = format_yen(change["amount"], unit) if change["amount"] else "-"

        rows.append(row)

    df = pd.DataFrame(rows)
    st.dataframe(df, use_container_width=True, hide_index=True)


def render_loan_schedule(loan_data: dict, settings: dict):
    """借入金スケジュールのプレビュー"""
    st.subheader("🏦 借入金返済スケジュール")
    st.caption(DISPLAY_UNIT_LABEL)

    unit = settings.get("display_unit", 1000)
    rows = []
    for contract in loan_data["contracts"]:
        rows.append({
            "契約名": contract["name"],
            "借入先": contract.get("lender", ""),
            "種別": contract.get("loan_type", ""),
            "借入残高": format_yen(contract["remaining_balance"], unit),
            "月額返済": format_yen(contract["monthly_payment"], unit),
            "年利率": f"{contract.get('interest_rate', 0):.2f}%",
            "残回数": f"{contract['remaining_payments']}回" if contract["remaining_payments"] else "-",
            "残期間": contract["remaining_period_str"],
        })

    df = pd.DataFrame(rows)
    st.dataframe(df, use_container_width=True, hide_index=True)

    # 合計
    total = loan_data["total"]
    st.markdown(f"**借入金合計残高:** {format_yen(total['total_balance'], unit)}　"
                f"**月額返済合計:** {format_yen(total['total_monthly_payment'], unit)}　"
                f"**年間返済合計:** {format_yen(total['total_annual_payment'], unit)}")


def render_working_capital(wc_data: dict, ebitda_data: dict, repayment_data: dict, settings: dict):
    """運転資本・EBITDA・返済原資のプレビュー"""
    st.subheader("💰 運転資本・EBITDA・返済原資分析")
    st.caption(DISPLAY_UNIT_LABEL)

    unit = settings.get("display_unit", 1000)

    col1, col2, col3 = st.columns(3)
    with col1:
        st.metric("運転資本", format_yen(wc_data["working_capital"], unit))
        st.caption(f"流動資産: {format_yen(wc_data['current_assets'], unit)}")
        st.caption(f"流動負債: {format_yen(wc_data['current_liabilities'], unit)}")

    with col2:
        st.metric("EBITDA", format_yen(ebitda_data["ebitda"], unit))
        st.caption(f"営業利益: {format_yen(ebitda_data['operating_income'], unit)}")
        st.caption(f"減価償却費: {format_yen(ebitda_data['depreciation'], unit)}")

    with col3:
        coverage = repayment_data["coverage_ratio"]
        status = "✅ 十分" if repayment_data["is_sufficient"] else "⚠️ 不足"
        st.metric("返済カバー率", f"{coverage:.2f}倍" if coverage else "-", delta=status)
        st.caption(f"返済原資: {format_yen(repayment_data['repayment_source'], unit)}")
        st.caption(f"年間返済額: {format_yen(repayment_data['annual_repayment'], unit)}")


def render_forecast(forecast_data: dict, settings: dict):
    """決算着地見込みのプレビュー"""
    st.subheader("🎯 決算着地見込み")
    st.caption(f"{DISPLAY_UNIT_LABEL}　経過{forecast_data['elapsed']}ヶ月 / 残{forecast_data['remaining']}ヶ月")

    unit = settings.get("display_unit", 1000)

    rows = []
    for account in forecast_data["actual_ytd"]:
        rows.append({
            "科目": account,
            "実績累計": format_yen(forecast_data["actual_ytd"][account], unit),
            "パターンA（平均推計）": format_yen(forecast_data["pattern_a"][account], unit),
            "パターンB（前期推計）": format_yen(forecast_data["pattern_b"][account], unit),
        })

    df = pd.DataFrame(rows)
    st.dataframe(df, use_container_width=True, hide_index=True)


def render_monthly_transition(transition_data: dict, months: list, settings: dict):
    """月次推移PLのプレビュー"""
    st.subheader("📅 月次推移損益計算書")
    st.caption(DISPLAY_UNIT_LABEL)

    unit = settings.get("display_unit", 1000)

    rows = []
    for account, values in transition_data.items():
        row = {"科目": account}
        for m in months:
            row[m] = format_yen(values.get(m, 0), unit)
        rows.append(row)

    df = pd.DataFrame(rows)
    st.dataframe(df, use_container_width=True, hide_index=True)
