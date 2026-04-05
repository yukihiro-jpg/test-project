"""
利益率・費用構成タブ
"""
import streamlit as st
import pandas as pd
from src.charts import create_margin_trend_chart, create_pl_waterfall_chart, create_cost_breakdown_pie


def render_profitability(
    monthly_pl_with_margins: pd.DataFrame,
    monthly_pl: pd.DataFrame,
    sga_breakdown: pd.DataFrame,
):
    """利益率・費用構成セクション"""

    col1, col2 = st.columns(2)

    with col1:
        st.plotly_chart(
            create_margin_trend_chart(monthly_pl_with_margins),
            use_container_width=True,
        )

    with col2:
        if not sga_breakdown.empty:
            st.plotly_chart(
                create_cost_breakdown_pie(sga_breakdown),
                use_container_width=True,
            )

    # ウォーターフォールチャート
    st.markdown("### 損益計算書 ウォーターフォール")

    available_months = [str(p) for p in monthly_pl["year_month"]]
    if available_months:
        selected_month = st.selectbox(
            "表示月を選択",
            options=available_months,
            index=len(available_months) - 1,
        )
        st.plotly_chart(
            create_pl_waterfall_chart(monthly_pl, selected_month),
            use_container_width=True,
        )

    # 販管費TOP10テーブル
    if not sga_breakdown.empty:
        with st.expander("販管費 内訳詳細"):
            display = sga_breakdown.copy()
            total = display["金額"].sum()
            display["構成比(%)"] = (display["金額"] / total * 100).round(1)
            st.dataframe(
                display.style.format({"金額": "{:,.0f}", "構成比(%)": "{:.1f}%"}),
                use_container_width=True,
                hide_index=True,
            )
