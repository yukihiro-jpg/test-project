"""3期比較PLパーサー"""

import pandas as pd
import re
from config import ACCOUNT_ALIASES


def parse_comparative_pl(uploaded_file) -> dict:
    """
    3期比較PLを解析する。
    単月比較と累積比較が1つのシートに含まれている前提。

    Returns:
        {
            "accounts": [科目名リスト],
            "periods": [期名リスト（例: "第10期", "第11期", "第12期"）],
            "single_month": {科目名: {期名: 金額}},   # 単月
            "cumulative": {科目名: {期名: 金額}},      # 累積
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

    # セクション分割を試みる（単月/累積）
    single_start, cumulative_start = _find_sections(df)

    if single_start is not None and cumulative_start is not None:
        # 2セクション構成
        single_data, periods_s, accounts_s = _parse_section(df, single_start, cumulative_start)
        cumulative_data, periods_c, accounts_c = _parse_section(df, cumulative_start, len(df))
        accounts = accounts_s  # 科目は同一の想定
        periods = periods_s or periods_c
    else:
        # 単一テーブル（列が単月と累積を両方含む場合）
        single_data, cumulative_data, periods, accounts = _parse_combined(df)

    return {
        "accounts": accounts,
        "periods": periods,
        "single_month": single_data,
        "cumulative": cumulative_data,
    }


def _find_sections(df):
    """単月セクションと累積セクションの開始行を探す"""
    single_start = None
    cumulative_start = None

    for idx in range(len(df)):
        row_str = " ".join(str(v) for v in df.iloc[idx])
        if "単月" in row_str and single_start is None:
            single_start = idx
        elif "累計" in row_str or "累積" in row_str:
            if cumulative_start is None:
                cumulative_start = idx

    return single_start, cumulative_start


def _parse_section(df, start_row, end_row):
    """テーブルセクションを解析"""
    # ヘッダー行を見つける
    header_row = start_row
    for idx in range(start_row, min(start_row + 5, end_row)):
        row_str = " ".join(str(v) for v in df.iloc[idx])
        if "期" in row_str or re.search(r"\d{4}", row_str):
            header_row = idx
            break

    # 期名を取得
    periods = []
    account_col = 0
    period_cols = []

    for col in range(df.shape[1]):
        val = str(df.iloc[header_row, col]).strip()
        if "科目" in val or "勘定" in val:
            account_col = col
        elif val and val != "nan" and ("期" in val or re.search(r"\d{4}", val)):
            periods.append(val)
            period_cols.append(col)

    if not period_cols:
        # 科目列の次の列から順に期として扱う
        for col in range(account_col + 1, df.shape[1]):
            val = str(df.iloc[header_row, col]).strip()
            if val and val != "nan":
                periods.append(val)
                period_cols.append(col)

    # データ行を解析
    data = {}
    accounts = []
    for idx in range(header_row + 1, end_row):
        account_name = str(df.iloc[idx, account_col]).strip()
        if not account_name or account_name == "nan":
            continue

        normalized = ACCOUNT_ALIASES.get(account_name, account_name)
        accounts.append(normalized)

        values = {}
        for period_name, col_idx in zip(periods, period_cols):
            val = df.iloc[idx, col_idx]
            try:
                values[period_name] = float(str(val).replace(",", "").replace("▲", "-").replace("△", "-"))
            except (ValueError, TypeError):
                values[period_name] = 0

        data[normalized] = values

    return data, periods, accounts


def _parse_combined(df):
    """単月・累積が列として並んでいる場合の解析"""
    # ヘッダー行を検出
    header_row = 0
    for idx in range(min(10, len(df))):
        row_str = " ".join(str(v) for v in df.iloc[idx])
        if "科目" in row_str or "勘定" in row_str:
            header_row = idx
            break

    account_col = 0
    all_cols = []

    for col in range(df.shape[1]):
        val = str(df.iloc[header_row, col]).strip()
        if "科目" in val or "勘定" in val:
            account_col = col
        elif val and val != "nan":
            all_cols.append((val, col))

    # 列を単月/累積に分類（列名に"単月"/"累計"が含まれるか、前半/後半で分ける）
    single_cols = []
    cumulative_cols = []
    periods = []

    for name, col_idx in all_cols:
        if "単月" in name:
            clean_name = name.replace("単月", "").strip()
            single_cols.append((clean_name, col_idx))
            if clean_name not in periods:
                periods.append(clean_name)
        elif "累計" in name or "累積" in name:
            clean_name = name.replace("累計", "").replace("累積", "").strip()
            cumulative_cols.append((clean_name, col_idx))
            if clean_name not in periods:
                periods.append(clean_name)
        else:
            # 分類できない場合は全て単月扱い
            single_cols.append((name, col_idx))
            if name not in periods:
                periods.append(name)

    # 累積が見つからなければ全列を両方に使う
    if not cumulative_cols:
        cumulative_cols = single_cols

    # データ解析
    single_data = {}
    cumulative_data = {}
    accounts = []

    for idx in range(header_row + 1, len(df)):
        account_name = str(df.iloc[idx, account_col]).strip()
        if not account_name or account_name == "nan":
            continue

        normalized = ACCOUNT_ALIASES.get(account_name, account_name)
        accounts.append(normalized)

        s_vals = {}
        for period_name, col_idx in single_cols:
            val = df.iloc[idx, col_idx]
            try:
                s_vals[period_name] = float(str(val).replace(",", "").replace("▲", "-").replace("△", "-"))
            except (ValueError, TypeError):
                s_vals[period_name] = 0
        single_data[normalized] = s_vals

        c_vals = {}
        for period_name, col_idx in cumulative_cols:
            val = df.iloc[idx, col_idx]
            try:
                c_vals[period_name] = float(str(val).replace(",", "").replace("▲", "-").replace("△", "-"))
            except (ValueError, TypeError):
                c_vals[period_name] = 0
        cumulative_data[normalized] = c_vals

    return single_data, cumulative_data, periods, accounts
