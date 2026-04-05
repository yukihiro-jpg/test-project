"""
損益分岐点タブ
"""
import streamlit as st
import pandas as pd
from src.charts import create_breakeven_chart
from config import format_currency, format_percentage


def render_breakeven(breakeven_data: dict):
    """損益分岐点セクション"""

    # KPIカード
    cols = st.columns(4)
    with cols[0]:
        st.metric("損益分岐点売上高", format_currency(breakeven_data["損益分岐点売上高"]))
    with cols[1]:
        st.metric("安全余裕率", format_percentage(breakeven_data["安全余裕率"]))
    with cols[2]:
        st.metric("限界利益率", format_percentage(breakeven_data["限界利益率"]))
    with cols[3]:
        st.metric("変動費率", format_percentage(breakeven_data["変動費率"]))

    # 損益分岐点チャート
    st.plotly_chart(create_breakeven_chart(breakeven_data), use_container_width=True)

    # 詳細テーブル
    with st.expander("損益分岐点分析 詳細"):
        detail = pd.DataFrame([
            {"項目": "売上高", "金額": breakeven_data["売上高"]},
            {"項目": "変動費", "金額": breakeven_data["変動費"]},
            {"項目": "限界利益", "金額": breakeven_data["限界利益"]},
            {"項目": "固定費", "金額": breakeven_data["固定費"]},
            {"項目": "損益分岐点売上高", "金額": breakeven_data["損益分岐点売上高"]},
        ])
        st.dataframe(
            detail.style.format({"金額": "{:,.0f}"}),
            use_container_width=True,
            hide_index=True,
        )

        st.markdown("""
        **解説**
        - **損益分岐点売上高**: これ以上売れば黒字になる売上高の水準
        - **安全余裕率**: 現在の売上高が損益分岐点をどれだけ上回っているか（高いほど安全）
        - **限界利益率**: 売上1円あたりの固定費回収能力
        - **変動費率**: 売上に比例して増える費用の割合
        """)
