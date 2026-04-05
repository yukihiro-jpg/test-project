"""
税理士向け 顧問先営業成績ダッシュボード
メインアプリケーション
"""
import streamlit as st
import pandas as pd
import os

from components.sidebar import render_sidebar
from components.kpi_cards import render_kpi_cards
from components.monthly_trend_section import render_monthly_trend
from components.three_period_section import render_three_period
from components.yoy_section import render_yoy
from components.profitability_section import render_profitability
from components.cashflow_section import render_cashflow
from components.loan_section import render_loan_section
from components.breakeven_section import render_breakeven

from src.data_loader import load_ledger_csv, load_budget_csv, split_fiscal_years
from src.metrics import (
    compute_monthly_pl,
    compute_margins,
    compute_three_period_comparison,
    compute_yoy_monthly,
    compute_budget_comparison,
    compute_sga_breakdown,
    compute_breakeven,
    compute_kpi_summary,
)
from src.cash_flow import compute_monthly_cashflow

# ページ設定
st.set_page_config(
    page_title="営業成績ダッシュボード",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded",
)

# カスタムCSS読み込み
css_path = os.path.join(os.path.dirname(__file__), "styles", "custom.css")
if os.path.exists(css_path):
    with open(css_path, encoding="utf-8") as f:
        st.markdown(f"<style>{f.read()}</style>", unsafe_allow_html=True)


def main():
    # サイドバー描画
    settings = render_sidebar()

    # ヘッダー
    st.markdown(f'<h1 class="main-header">{settings["client_name"]} 営業成績ダッシュボード</h1>', unsafe_allow_html=True)

    # データ読み込み
    try:
        df, budget_df = load_data(settings)
    except Exception as e:
        st.error(f"データ読み込みエラー: {e}")
        st.stop()

    if df is None or df.empty:
        st.info("CSVファイルをアップロードするか、サンプルデータを使用してください。")
        st.stop()

    # 未分類科目の警告
    from src.account_classifier import get_unclassified_accounts
    unclassified = get_unclassified_accounts(df)
    if unclassified:
        with st.expander(f"未分類の勘定科目が {len(unclassified)} 件あります", expanded=False):
            st.warning(", ".join(unclassified))

    # 会計年度分割
    fiscal_years = split_fiscal_years(df, settings["fiscal_year_end_month"])
    period_labels = list(fiscal_years.keys())

    if not period_labels:
        st.error("データから会計年度を特定できませんでした。")
        st.stop()

    # 各期のP/L算出
    period_pls = {}
    for label, period_df in fiscal_years.items():
        pl = compute_monthly_pl(period_df)
        if not pl.empty:
            period_pls[label] = pl

    if not period_pls:
        st.error("損益データを算出できませんでした。勘定科目の分類を確認してください。")
        st.stop()

    # 当期・前期の特定
    current_period = period_labels[0]
    current_pl = period_pls.get(current_period, pd.DataFrame())
    previous_period = period_labels[1] if len(period_labels) > 1 else None
    previous_pl = period_pls.get(previous_period, pd.DataFrame()) if previous_period else None

    # KPIサマリー
    if not current_pl.empty:
        kpi = compute_kpi_summary(current_pl, previous_pl)
        render_kpi_cards(kpi, current_period)

    st.markdown("---")

    # タブ
    tabs = st.tabs([
        "当期月次推移",
        "3期比較",
        "前年対比",
        "利益率・費用構成",
        "キャッシュフロー",
        "借入金返済",
        "損益分岐点",
    ])

    # Tab 1: 当期月次推移
    with tabs[0]:
        if not current_pl.empty:
            budget_comparison = None
            if budget_df is not None:
                budget_comparison = compute_budget_comparison(current_pl, budget_df)
            render_monthly_trend(current_pl, budget_comparison)

    # Tab 2: 3期比較
    with tabs[1]:
        if len(period_pls) >= 2:
            comparison = compute_three_period_comparison(period_pls)
            render_three_period(comparison)
        else:
            st.info("3期比較には2期以上のデータが必要です。")

    # Tab 3: 前年対比
    with tabs[2]:
        if not current_pl.empty and previous_pl is not None and not previous_pl.empty:
            yoy = compute_yoy_monthly(current_pl, previous_pl)
            render_yoy(yoy)
        else:
            st.info("前年対比には前期のデータが必要です。")

    # Tab 4: 利益率・費用構成
    with tabs[3]:
        if not current_pl.empty:
            margins = compute_margins(current_pl)
            current_period_df = fiscal_years[current_period]
            sga = compute_sga_breakdown(current_period_df)
            render_profitability(margins, current_pl, sga)

    # Tab 5: キャッシュフロー
    with tabs[4]:
        current_period_df = fiscal_years[current_period]
        cf = compute_monthly_cashflow(current_period_df)
        render_cashflow(cf)

    # Tab 6: 借入金返済
    with tabs[5]:
        render_loan_section(df)

    # Tab 7: 損益分岐点
    with tabs[6]:
        if not current_pl.empty:
            current_period_df = fiscal_years[current_period]
            be = compute_breakeven(current_pl, current_period_df)
            render_breakeven(be)

    # エクスポート処理
    handle_export(settings, df, fiscal_years, period_pls, budget_df)


def load_data(settings):
    """データを読み込む"""
    df = None
    budget_df = None

    if settings["use_sample"]:
        sample_ledger = os.path.join(os.path.dirname(__file__), "data", "sample_ledger.csv")
        sample_budget = os.path.join(os.path.dirname(__file__), "data", "sample_budget.csv")

        if os.path.exists(sample_ledger):
            df = load_ledger_csv(sample_ledger)
        if os.path.exists(sample_budget):
            budget_df = load_budget_csv(sample_budget)
    else:
        if settings["ledger_file"] is not None:
            df = load_ledger_csv(settings["ledger_file"])
        if settings["budget_file"] is not None:
            budget_df = load_budget_csv(settings["budget_file"])

    return df, budget_df


def handle_export(settings, df, fiscal_years, period_pls, budget_df):
    """エクスポート処理"""
    if settings["export_excel"]:
        try:
            from src.export_excel import generate_excel
            excel_buffer = generate_excel(
                fiscal_years, period_pls, settings["client_name"],
                settings["fiscal_year_end_month"],
            )
            st.sidebar.download_button(
                label="Excelファイルを保存",
                data=excel_buffer,
                file_name=f"{settings['client_name']}_営業成績.xlsx",
                mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        except Exception as e:
            st.sidebar.error(f"Excel生成エラー: {e}")

    if settings["export_pdf"]:
        try:
            from src.export_pdf import generate_pdf
            pdf_buffer = generate_pdf(
                fiscal_years, period_pls, df,
                settings["client_name"],
                settings["fiscal_year_end_month"],
            )
            st.sidebar.download_button(
                label="PDFファイルを保存",
                data=pdf_buffer,
                file_name=f"{settings['client_name']}_営業成績報告書.pdf",
                mime="application/pdf",
            )
        except Exception as e:
            st.sidebar.error(f"PDF生成エラー: {e}")


if __name__ == "__main__":
    main()
