"""
借入金返済・完済シミュレーションタブ
"""
import streamlit as st
import pandas as pd
from src.loan_analyzer import (
    compute_loan_balance,
    compute_interest_summary,
    get_loan_summary,
    simulate_payoff,
)
from src.charts import create_loan_balance_chart, create_payoff_simulation_chart
from config import format_currency


def render_loan_section(df: pd.DataFrame):
    """借入金分析セクション"""

    loan_summary = get_loan_summary(df)

    if loan_summary["current_balance"] <= 0:
        st.info("借入金データが見つかりません。「長期借入金」「短期借入金」の仕訳データが必要です。")
        return

    # サマリーカード
    cols = st.columns(4)
    with cols[0]:
        st.metric("借入金残高", format_currency(loan_summary["current_balance"]))
    with cols[1]:
        st.metric("うち長期", format_currency(loan_summary["long_term_balance"]))
    with cols[2]:
        st.metric("月平均返済額", format_currency(loan_summary["avg_monthly_repayment"]))
    with cols[3]:
        st.metric("推定実効金利", f"{loan_summary['estimated_rate']:.2f}%")

    st.markdown("---")

    # 借入金残高推移
    loan_balance = compute_loan_balance(df)
    if not loan_balance.empty:
        st.plotly_chart(create_loan_balance_chart(loan_balance), use_container_width=True)

    # 返済スケジュールテーブル
    with st.expander("返済実績データ"):
        display = loan_balance.copy()
        display["year_month"] = display["year_month"].apply(
            lambda p: f"{str(p).split('-')[0]}年{int(str(p).split('-')[1])}月" if "-" in str(p) else str(p)
        )
        display = display.rename(columns={"year_month": "年月"})
        numeric_cols = display.select_dtypes(include="number").columns
        st.dataframe(
            display.style.format({col: "{:,.0f}" for col in numeric_cols}),
            use_container_width=True,
            hide_index=True,
        )

    # 支払利息推移
    interest = compute_interest_summary(df)
    if not interest.empty:
        total_interest = interest["支払利息"].sum()
        st.markdown(f"**累計支払利息: {format_currency(total_interest)}**")

    # 完済シミュレーション
    st.markdown("---")
    st.markdown("### 完済シミュレーション")

    col1, col2 = st.columns(2)
    with col1:
        extra_payment = st.slider(
            "繰上返済月額",
            min_value=0,
            max_value=int(loan_summary["avg_monthly_repayment"] * 3),
            value=0,
            step=10000,
            format="%d円",
        )

    # 通常返済シミュレーション
    normal_sim = simulate_payoff(
        current_balance=loan_summary["current_balance"],
        monthly_repayment=loan_summary["avg_monthly_repayment"],
        annual_rate=loan_summary["estimated_rate"],
    )

    # 繰上返済シミュレーション
    extra_sim = None
    if extra_payment > 0:
        extra_sim = simulate_payoff(
            current_balance=loan_summary["current_balance"],
            monthly_repayment=loan_summary["avg_monthly_repayment"],
            annual_rate=loan_summary["estimated_rate"],
            extra_monthly_payment=extra_payment,
        )

    if not normal_sim.empty:
        with col2:
            normal_months = len(normal_sim)
            normal_years = normal_months // 12
            normal_remainder = normal_months % 12
            st.metric("通常返済 完済まで", f"{normal_years}年{normal_remainder}ヶ月")

            if extra_sim is not None and not extra_sim.empty:
                extra_months = len(extra_sim)
                extra_years = extra_months // 12
                extra_remainder = extra_months % 12
                saved = normal_months - extra_months
                st.metric(
                    "繰上返済あり 完済まで",
                    f"{extra_years}年{extra_remainder}ヶ月",
                    delta=f"-{saved}ヶ月短縮",
                )

        st.plotly_chart(
            create_payoff_simulation_chart(normal_sim, extra_sim),
            use_container_width=True,
        )
