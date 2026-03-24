"""借入金入力UI"""

import streamlit as st


def render_loan_input():
    """借入金データの入力フォームを描画"""
    st.header("🏦 借入金情報")

    if "loans" not in st.session_state:
        st.session_state.loans = []

    # 追加ボタン
    if st.button("＋ 借入金を追加", key="add_loan"):
        st.session_state.loans.append({
            "name": f"借入{len(st.session_state.loans) + 1}",
            "lender": "",
            "remaining_balance": 0,
            "monthly_payment": 0,
            "interest_rate": 0.0,
            "loan_type": "長期",
        })

    # 各契約の入力
    loans_to_delete = []
    for i, loan in enumerate(st.session_state.loans):
        with st.expander(f"📋 {loan['name']} - {loan.get('lender', '未設定')}", expanded=True):
            col1, col2 = st.columns(2)

            with col1:
                st.session_state.loans[i]["name"] = st.text_input(
                    "契約名", value=loan["name"], key=f"loan_name_{i}"
                )
                st.session_state.loans[i]["lender"] = st.text_input(
                    "借入先", value=loan.get("lender", ""), key=f"loan_lender_{i}"
                )
                st.session_state.loans[i]["remaining_balance"] = st.number_input(
                    "借入残高（円）", value=loan["remaining_balance"],
                    min_value=0, step=100000, key=f"loan_balance_{i}"
                )

            with col2:
                st.session_state.loans[i]["monthly_payment"] = st.number_input(
                    "月額返済額（円）", value=loan["monthly_payment"],
                    min_value=0, step=10000, key=f"loan_monthly_{i}"
                )
                st.session_state.loans[i]["interest_rate"] = st.number_input(
                    "年利率（%）", value=loan["interest_rate"],
                    min_value=0.0, max_value=20.0, step=0.1,
                    format="%.2f", key=f"loan_rate_{i}"
                )
                st.session_state.loans[i]["loan_type"] = st.selectbox(
                    "借入種別", options=["長期", "短期"],
                    index=0 if loan.get("loan_type", "長期") == "長期" else 1,
                    key=f"loan_type_{i}"
                )

            if st.button("🗑️ この借入を削除", key=f"delete_loan_{i}"):
                loans_to_delete.append(i)

    # 削除処理
    for idx in sorted(loans_to_delete, reverse=True):
        st.session_state.loans.pop(idx)
    if loans_to_delete:
        st.rerun()

    return st.session_state.loans
