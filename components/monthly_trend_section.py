"""
当期月次推移タブ
"""
import streamlit as st
import pandas as pd
from src.charts import create_monthly_trend_chart, create_cumulative_chart, create_budget_comparison_chart
from src.metrics import compute_cumulative_pl


def render_monthly_trend(monthly_pl: pd.DataFrame, budget_comparison: pd.DataFrame = None):
    """月次推移セクション"""

    # 月次推移チャート
    st.plotly_chart(create_monthly_trend_chart(monthly_pl), use_container_width=True)

    # 累計推移
    cumulative = compute_cumulative_pl(monthly_pl)
    st.plotly_chart(create_cumulative_chart(cumulative), use_container_width=True)

    # 予算対比
    if budget_comparison is not None and "予算_売上高" in budget_comparison.columns:
        has_budget = budget_comparison["予算_売上高"].sum() > 0
        if has_budget:
            st.plotly_chart(
                create_budget_comparison_chart(budget_comparison),
                use_container_width=True,
            )

    # データテーブル
    with st.expander("月次損益データ"):
        display_cols = [
            "year_month", "売上高", "売上原価", "売上総利益",
            "販売費及び一般管理費", "営業利益", "経常利益", "当期純利益",
        ]
        display_df = monthly_pl[display_cols].copy()
        display_df["year_month"] = display_df["year_month"].astype(str)
        display_df = display_df.rename(columns={"year_month": "年月"})

        # 数値フォーマット
        numeric_cols = display_df.select_dtypes(include="number").columns
        st.dataframe(
            display_df.style.format({col: "{:,.0f}" for col in numeric_cols}),
            use_container_width=True,
            hide_index=True,
        )
