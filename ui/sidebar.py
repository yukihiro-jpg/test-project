"""サイドバー設定UI"""

import streamlit as st
from datetime import date


def render_sidebar():
    """サイドバーの設定項目を描画"""
    st.sidebar.title("⚙️ 報告書設定")

    company_name = st.sidebar.text_input("会社名", value="株式会社サンプル")

    report_title = st.sidebar.text_input("報告書タイトル", value="月次経営報告書")

    today = date.today()
    report_date = st.sidebar.date_input("報告日", value=today)

    fiscal_year_start = st.sidebar.selectbox(
        "決算期首月",
        options=list(range(1, 13)),
        index=3,  # 4月始まり
        format_func=lambda x: f"{x}月"
    )

    current_year = st.sidebar.number_input("当期年度", value=today.year, min_value=2000, max_value=2100)

    current_month = st.sidebar.selectbox(
        "報告対象月",
        options=list(range(1, 13)),
        index=today.month - 1,
        format_func=lambda x: f"{x}月"
    )

    display_unit = st.sidebar.selectbox(
        "表示単位",
        options=[1, 1000, 1000000],
        index=1,
        format_func=lambda x: {1: "円", 1000: "千円", 1000000: "百万円"}[x]
    )

    st.sidebar.markdown("---")

    return {
        "company_name": company_name,
        "report_title": report_title,
        "report_date": report_date,
        "fiscal_year_start": fiscal_year_start,
        "current_year": current_year,
        "current_month": current_month,
        "display_unit": display_unit,
    }
