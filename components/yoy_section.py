"""
前年対比タブ
"""
import streamlit as st
import pandas as pd
from src.charts import create_yoy_chart


def render_yoy(yoy_df: pd.DataFrame):
    """前年対比セクション"""

    st.plotly_chart(create_yoy_chart(yoy_df), use_container_width=True)

    # 前年対比テーブル
    st.markdown("### 前年対比 詳細")

    items = ["売上高", "売上総利益", "営業利益", "経常利益", "当期純利益"]
    display_cols = ["year_month"]
    for item in items:
        display_cols.extend([f"{item}_当期", f"{item}_前期", f"{item}_増減", f"{item}_増減率(%)"])

    display_df = yoy_df[["year_month"] + [c for c in display_cols[1:] if c in yoy_df.columns]].copy()
    display_df["year_month"] = display_df["year_month"].apply(
            lambda p: f"{str(p).split('-')[0]}年{int(str(p).split('-')[1])}月" if "-" in str(p) else str(p)
        )
    display_df = display_df.rename(columns={"year_month": "年月"})

    numeric_cols = display_df.select_dtypes(include="number").columns
    format_dict = {}
    for col in numeric_cols:
        if "率" in col or "%" in col:
            format_dict[col] = "{:+.1f}%"
        else:
            format_dict[col] = "{:,.0f}"

    st.dataframe(
        display_df.style.format(format_dict),
        use_container_width=True,
        hide_index=True,
    )
