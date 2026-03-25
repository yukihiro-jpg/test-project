"""ファイルアップロードUI"""

import streamlit as st


def render_file_upload():
    """ファイルアップロードセクションを描画"""
    st.header("📂 データアップロード")

    col1, col2, col3 = st.columns(3, gap="medium")

    with col1:
        st.markdown("**月次推移PLBS**")
        plbs_file = st.file_uploader(
            "月次推移PLBSファイル",
            type=["xlsx", "xls", "csv"],
            key="plbs_upload",
            help="月次の損益計算書・貸借対照表の推移データ",
            label_visibility="collapsed",
        )

    with col2:
        st.markdown("**月次推移試算表**")
        tb_file = st.file_uploader(
            "月次推移試算表ファイル",
            type=["xlsx", "xls", "csv"],
            key="tb_upload",
            help="月次推移試算表（BS科目の残高確認用）",
            label_visibility="collapsed",
        )

    with col3:
        st.markdown("**3期比較PL**")
        comp_file = st.file_uploader(
            "3期比較PLファイル",
            type=["xlsx", "xls", "csv"],
            key="comp_upload",
            help="3期分のPL比較（単月比較・累積比較が含まれるもの）",
            label_visibility="collapsed",
        )

    return {
        "plbs_file": plbs_file,
        "tb_file": tb_file,
        "comp_file": comp_file,
    }
