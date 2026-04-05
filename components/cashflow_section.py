"""
キャッシュフロータブ
"""
import streamlit as st
import pandas as pd
from src.charts import create_cashflow_chart


def render_cashflow(cf_df: pd.DataFrame):
    """キャッシュフローセクション"""

    if cf_df.empty:
        st.info("キャッシュフローデータがありません。現金・預金科目の仕訳データが必要です。")
        return

    # サマリーカード
    cols = st.columns(4)
    total_op = cf_df["営業CF"].sum()
    total_inv = cf_df["投資CF"].sum()
    total_fin = cf_df["財務CF"].sum()
    latest_cash = cf_df["現金残高累計"].iloc[-1]

    with cols[0]:
        st.metric("営業CF累計", f"{total_op:,.0f}円")
    with cols[1]:
        st.metric("投資CF累計", f"{total_inv:,.0f}円")
    with cols[2]:
        st.metric("財務CF累計", f"{total_fin:,.0f}円")
    with cols[3]:
        st.metric("現金残高", f"{latest_cash:,.0f}円")

    st.plotly_chart(create_cashflow_chart(cf_df), use_container_width=True)

    # データテーブル
    with st.expander("キャッシュフロー詳細データ"):
        display = cf_df.copy()
        display["year_month"] = display["year_month"].astype(str)
        display = display.rename(columns={"year_month": "年月"})
        numeric_cols = display.select_dtypes(include="number").columns
        st.dataframe(
            display.style.format({col: "{:,.0f}" for col in numeric_cols}),
            use_container_width=True,
            hide_index=True,
        )
