"""
サイドバー: ファイルアップロード、フィルター、エクスポート
"""
import streamlit as st
import os


def render_sidebar():
    """
    サイドバーを描画し、設定値を返す。

    Returns:
        dict: {
            "client_name": str,
            "ledger_file": UploadedFile or None,
            "budget_file": UploadedFile or None,
            "fiscal_year_end_month": int,
            "use_sample": bool,
            "export_pdf": bool,
            "export_excel": bool,
        }
    """
    with st.sidebar:
        st.markdown("## 設定")

        client_name = st.text_input(
            "顧問先名",
            value="サンプル株式会社",
            help="PDF報告書の表紙に表示されます",
        )

        st.markdown("---")
        st.markdown("### データ読込")

        use_sample = st.checkbox(
            "サンプルデータを使用",
            value=True,
            help="data/フォルダ内のサンプルデータを使用します",
        )

        ledger_file = None
        budget_file = None

        if not use_sample:
            ledger_file = st.file_uploader(
                "元帳CSV",
                type=["csv"],
                help="会計ソフトからエクスポートした元帳データ",
            )
            budget_file = st.file_uploader(
                "予算CSV（任意）",
                type=["csv"],
                help="月次予算データ（年月, 勘定科目, 予算額）",
            )

        st.markdown("---")
        st.markdown("### 会計期間")

        fiscal_year_end_month = st.selectbox(
            "決算月",
            options=list(range(1, 13)),
            index=2,  # 3月
            format_func=lambda x: f"{x}月",
        )

        st.markdown("---")
        st.markdown("### エクスポート")

        export_pdf = st.button("PDF報告書ダウンロード", use_container_width=True)
        export_excel = st.button("Excelダウンロード", use_container_width=True)

    return {
        "client_name": client_name,
        "ledger_file": ledger_file,
        "budget_file": budget_file,
        "fiscal_year_end_month": fiscal_year_end_month,
        "use_sample": use_sample,
        "export_pdf": export_pdf,
        "export_excel": export_excel,
    }
