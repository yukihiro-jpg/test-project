"""月次経営報告書作成アプリ"""

import streamlit as st
import sys
import os

# プロジェクトルートをパスに追加
sys.path.insert(0, os.path.dirname(__file__))

from ui.sidebar import render_sidebar
from ui.file_upload import render_file_upload
from ui.loan_input import render_loan_input
from ui.preview import (
    render_pl_summary, render_comparative_pl, render_loan_schedule,
    render_working_capital, render_forecast, render_monthly_transition,
)
from parsers.plbs_parser import parse_plbs
from parsers.trial_balance_parser import parse_trial_balance
from parsers.comparative_pl_parser import parse_comparative_pl
from analysis.pl_summary import compute_pl_summary, compute_monthly_transition
from analysis.variance import compute_variance_analysis
from analysis.working_capital import compute_working_capital, compute_ebitda, compute_repayment_capacity
from analysis.forecast import compute_forecast
from analysis.loan_schedule import compute_loan_schedule
from reports.pdf_generator import generate_pdf
from reports.excel_generator import generate_excel
from utils.fiscal_year import get_elapsed_months

# ページ設定
st.set_page_config(
    page_title="月次経営報告書作成",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.title("📊 月次経営報告書作成ツール")
st.markdown("---")

# サイドバー設定
settings = render_sidebar()

# ファイルアップロード
files = render_file_upload()
st.markdown("---")

# 借入金入力
loans = render_loan_input()
st.markdown("---")

# データ解析と報告書生成
if st.button("📝 報告書を作成", type="primary", use_container_width=True):
    report_data = {}

    with st.spinner("データを解析中..."):
        # 1. 月次推移PLBS解析
        if files["plbs_file"]:
            try:
                plbs = parse_plbs(files["plbs_file"])
                report_data["pl_raw"] = plbs["raw"]
                report_data["months"] = plbs["months"]
                report_data["bs_raw"] = {k: v for k, v in plbs["raw"].items()
                                         if k in (plbs["bs"].index if len(plbs["bs"]) > 0 else [])}

                # 当月インデックスを計算
                elapsed = get_elapsed_months(
                    settings["fiscal_year_start"],
                    settings["current_month"]
                )
                current_month_idx = min(elapsed - 1, len(plbs["months"]) - 1)

                # PLサマリー
                pl_data = {}
                for account in plbs["pl"].index:
                    pl_data[account] = {m: plbs["pl"].loc[account, m]
                                        for m in plbs["months"]
                                        if m in plbs["pl"].columns}
                # rawからも追加
                for account, values in plbs["raw"].items():
                    if account not in pl_data:
                        pl_data[account] = values

                summary = compute_pl_summary(pl_data, plbs["months"], current_month_idx)
                report_data["pl_summary"] = summary

                # 月次推移
                transition = compute_monthly_transition(pl_data, plbs["months"])
                report_data["monthly_transition"] = transition

                # 決算着地見込み
                forecast = compute_forecast(
                    pl_data, plbs["months"], current_month_idx
                )
                report_data["forecast"] = forecast

                st.success("✅ 月次推移PLBS: 解析完了")
            except Exception as e:
                st.error(f"❌ 月次推移PLBSの解析に失敗しました: {e}")

        # 2. 月次試算表解析
        if files["tb_file"]:
            try:
                tb = parse_trial_balance(files["tb_file"])

                # 運転資本
                wc = compute_working_capital(tb["bs_items"])
                report_data["working_capital"] = wc

                # EBITDA
                ebitda = compute_ebitda(tb["pl_items"])
                report_data["ebitda"] = ebitda

                st.success("✅ 月次試算表: 解析完了")
            except Exception as e:
                st.error(f"❌ 月次試算表の解析に失敗しました: {e}")

        # 3. 3期比較PL解析
        if files["comp_file"]:
            try:
                comp = parse_comparative_pl(files["comp_file"])
                report_data["periods"] = comp["periods"]

                # 増減分析（単月）
                variance_single = compute_variance_analysis(
                    comp["single_month"], comp["periods"]
                )
                report_data["variance_single"] = variance_single

                # 増減分析（累積）
                variance_cumulative = compute_variance_analysis(
                    comp["cumulative"], comp["periods"]
                )
                report_data["variance_cumulative"] = variance_cumulative

                st.success("✅ 3期比較PL: 解析完了")
            except Exception as e:
                st.error(f"❌ 3期比較PLの解析に失敗しました: {e}")

        # 4. 借入金スケジュール
        if loans:
            try:
                loan_data = compute_loan_schedule(loans)
                report_data["loan_schedule"] = loan_data

                # 返済原資分析
                annual_repayment = loan_data["total"]["total_annual_payment"]
                ebitda_val = report_data.get("ebitda", {}).get("ebitda", 0)
                wc_change = 0  # 運転資本増減（前期比較がある場合に計算可能）

                repayment = compute_repayment_capacity(ebitda_val, annual_repayment, wc_change)
                report_data["repayment_capacity"] = repayment

                st.success("✅ 借入金スケジュール: 計算完了")
            except Exception as e:
                st.error(f"❌ 借入金計算に失敗しました: {e}")

    # レポートデータをセッションに保存
    st.session_state["report_data"] = report_data
    st.session_state["settings"] = settings

# プレビューと出力
if "report_data" in st.session_state:
    report_data = st.session_state["report_data"]
    settings_saved = st.session_state.get("settings", settings)

    st.markdown("---")
    st.header("📋 レポートプレビュー")

    # タブでセクション表示
    tabs = st.tabs([
        "PLサマリー", "3期比較PL", "借入金スケジュール",
        "運転資本・EBITDA", "決算着地見込み", "月次推移PL"
    ])

    with tabs[0]:
        if "pl_summary" in report_data:
            render_pl_summary(report_data["pl_summary"], settings_saved)
        else:
            st.info("月次推移PLBSをアップロードしてください")

    with tabs[1]:
        if "variance_single" in report_data:
            st.markdown("**【単月比較】**")
            render_comparative_pl(
                report_data["variance_single"],
                report_data.get("periods", []),
                settings_saved
            )
            st.markdown("**【累積比較】**")
            render_comparative_pl(
                report_data.get("variance_cumulative", []),
                report_data.get("periods", []),
                settings_saved
            )
        else:
            st.info("3期比較PLをアップロードしてください")

    with tabs[2]:
        if "loan_schedule" in report_data:
            render_loan_schedule(report_data["loan_schedule"], settings_saved)
        else:
            st.info("借入金情報を入力してください")

    with tabs[3]:
        if "repayment_capacity" in report_data:
            render_working_capital(
                report_data.get("working_capital", {}),
                report_data.get("ebitda", {}),
                report_data["repayment_capacity"],
                settings_saved
            )
        else:
            st.info("月次試算表と借入金情報が必要です")

    with tabs[4]:
        if "forecast" in report_data:
            render_forecast(report_data["forecast"], settings_saved)
        else:
            st.info("月次推移PLBSをアップロードしてください")

    with tabs[5]:
        if "monthly_transition" in report_data:
            render_monthly_transition(
                report_data["monthly_transition"],
                report_data.get("months", []),
                settings_saved
            )
        else:
            st.info("月次推移PLBSをアップロードしてください")

    # ダウンロードボタン
    st.markdown("---")
    st.header("📥 ダウンロード")

    col1, col2 = st.columns(2)

    with col1:
        try:
            pdf_bytes = generate_pdf(report_data, settings_saved)
            st.download_button(
                label="📄 PDFダウンロード",
                data=pdf_bytes,
                file_name=f"月次報告書_{settings_saved.get('current_year', '')}年{settings_saved.get('current_month', '')}月.pdf",
                mime="application/pdf",
                use_container_width=True,
            )
        except Exception as e:
            st.error(f"PDF生成エラー: {e}")
            st.info("💡 PDFの日本語表示には日本語フォントが必要です。fontsフォルダにIPAexゴシック(ipaexg.ttf)を配置してください。")

    with col2:
        try:
            excel_bytes = generate_excel(report_data, settings_saved)
            st.download_button(
                label="📊 Excelダウンロード",
                data=excel_bytes,
                file_name=f"月次報告書_{settings_saved.get('current_year', '')}年{settings_saved.get('current_month', '')}月.xlsx",
                mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                use_container_width=True,
            )
        except Exception as e:
            st.error(f"Excel生成エラー: {e}")

else:
    st.info("👆 データをアップロードし、必要に応じて借入金情報を入力後、「報告書を作成」ボタンを押してください。")

# フッター
st.markdown("---")
st.caption("月次経営報告書作成ツール v1.0")
