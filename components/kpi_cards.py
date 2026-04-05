"""
KPIサマリーカード表示
"""
import streamlit as st
from config import format_currency, format_delta


def render_kpi_cards(kpi_summary: dict, period_label: str = ""):
    """KPIカードを4列で表示"""
    if period_label:
        st.markdown(f"**対象期間: {period_label}**")

    cols = st.columns(4)

    items = ["売上高", "売上総利益", "営業利益", "当期純利益"]
    for i, item in enumerate(items):
        data = kpi_summary[item]
        with cols[i]:
            st.metric(
                label=item,
                value=format_currency(data["value"]),
                delta=f"{format_delta(data['delta'])} ({data['delta_pct']:+.1f}%)" if data["delta"] != 0 else None,
                delta_color="normal",
            )
