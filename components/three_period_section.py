"""
3期比較タブ
"""
import streamlit as st
import pandas as pd
from src.charts import create_three_period_chart, create_three_period_stacked_chart


def render_three_period(comparison_df: pd.DataFrame):
    """3期比較セクション"""

    # 3期比較棒グラフ
    st.plotly_chart(create_three_period_chart(comparison_df), use_container_width=True)

    # 比較テーブル
    st.markdown("### 3期比較表")

    display_df = comparison_df.copy()

    # 数値列のフォーマット
    numeric_cols = display_df.select_dtypes(include="number").columns
    format_dict = {}
    for col in numeric_cols:
        if "率" in col or "%" in col:
            format_dict[col] = "{:+.1f}%"
        else:
            format_dict[col] = "{:,.0f}"

    def highlight_changes(row):
        styles = [""] * len(row)
        if "増減額" in row.index:
            val = row["増減額"]
            idx = list(row.index).index("増減額")
            if val > 0:
                styles[idx] = "color: #27AE60; font-weight: bold"
            elif val < 0:
                styles[idx] = "color: #E74C3C; font-weight: bold"
        return styles

    st.dataframe(
        display_df.style.format(format_dict).apply(highlight_changes, axis=1),
        use_container_width=True,
        hide_index=True,
    )
