"""当月月次試算表パーサー"""

import pandas as pd
import re
from config import ACCOUNT_ALIASES


def parse_trial_balance(uploaded_file) -> dict:
    """
    月次試算表を解析する。

    Returns:
        {
            "accounts": {科目名: {"debit": float, "credit": float, "balance": float}},
            "bs_items": {科目名: 残高},
            "pl_items": {科目名: 残高},
        }
    """
    filename = uploaded_file.name.lower()

    if filename.endswith(".csv"):
        try:
            df = pd.read_csv(uploaded_file, header=None, encoding="utf-8")
        except UnicodeDecodeError:
            uploaded_file.seek(0)
            df = pd.read_csv(uploaded_file, header=None, encoding="cp932")
    else:
        df = pd.read_excel(uploaded_file, header=None)

    # ヘッダー行を検出
    header_row = _find_header_row(df)
    if header_row is None:
        header_row = 0

    # 列の特定
    col_map = _identify_columns(df, header_row)

    accounts = {}
    for idx in range(header_row + 1, len(df)):
        account_name = str(df.iloc[idx, col_map["account"]]).strip()
        if not account_name or account_name == "nan":
            continue

        normalized = ACCOUNT_ALIASES.get(account_name, account_name)

        debit = _parse_number(df.iloc[idx, col_map.get("debit", -1)] if "debit" in col_map else 0)
        credit = _parse_number(df.iloc[idx, col_map.get("credit", -1)] if "credit" in col_map else 0)
        balance = _parse_number(df.iloc[idx, col_map.get("balance", -1)] if "balance" in col_map else debit - credit)

        accounts[normalized] = {
            "debit": debit,
            "credit": credit,
            "balance": balance,
        }

    # BS/PL分離
    bs_keywords = ["資産", "負債", "純資産", "現金", "預金", "売掛", "買掛", "借入",
                    "棚卸", "固定資産", "土地", "建物", "資本金", "利益剰余金",
                    "未払", "前受", "前払", "仮受", "仮払", "貸付", "有価証券",
                    "敷金", "保証金", "退職", "長期", "短期"]

    bs_items = {}
    pl_items = {}
    for name, vals in accounts.items():
        if any(kw in name for kw in bs_keywords):
            bs_items[name] = vals["balance"]
        else:
            pl_items[name] = vals["balance"]

    return {
        "accounts": accounts,
        "bs_items": bs_items,
        "pl_items": pl_items,
    }


def _find_header_row(df):
    """ヘッダー行を検出"""
    header_keywords = ["勘定科目", "科目", "借方", "貸方", "残高"]
    for idx in range(min(10, len(df))):
        row_str = " ".join(str(v) for v in df.iloc[idx])
        if any(kw in row_str for kw in header_keywords):
            return idx
    return None


def _identify_columns(df, header_row):
    """列マッピングを特定"""
    col_map = {"account": 0}

    for col in range(df.shape[1]):
        val = str(df.iloc[header_row, col]).strip()
        if "科目" in val or "勘定" in val:
            col_map["account"] = col
        elif "借方" in val:
            col_map["debit"] = col
        elif "貸方" in val:
            col_map["credit"] = col
        elif "残高" in val:
            col_map["balance"] = col

    return col_map


def _parse_number(val):
    """数値パース"""
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return 0
    try:
        s = str(val).replace(",", "").replace("▲", "-").replace("△", "-").strip()
        if not s or s == "nan":
            return 0
        return float(s)
    except (ValueError, TypeError):
        return 0
