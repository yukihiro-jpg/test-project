"""月次推移PLBS パーサー"""

import pandas as pd
import re
from config import ACCOUNT_ALIASES


def parse_plbs(uploaded_file) -> dict:
    """
    月次推移PLBSファイルを解析する。

    Returns:
        {
            "pl": DataFrame (科目名 x 月),
            "bs": DataFrame (科目名 x 月),
            "months": list of column names (月),
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

    # ヘッダー行を検出（月の列を探す）
    header_row = _find_header_row(df)
    if header_row is None:
        # ヘッダーが見つからない場合、1行目をヘッダーとする
        header_row = 0

    # 科目名列を検出
    account_col = _find_account_column(df, header_row)

    # 月の列を取得
    month_cols = _find_month_columns(df, header_row, account_col)

    # データを整理
    result_data = {}
    for idx in range(header_row + 1, len(df)):
        account_name = str(df.iloc[idx, account_col]).strip()
        if not account_name or account_name == "nan":
            continue

        # 名寄せ
        normalized = ACCOUNT_ALIASES.get(account_name, account_name)

        values = {}
        for month_name, col_idx in month_cols:
            val = df.iloc[idx, col_idx]
            try:
                values[month_name] = float(str(val).replace(",", "").replace("▲", "-").replace("△", "-"))
            except (ValueError, TypeError):
                values[month_name] = 0

        result_data[normalized] = values

    months = [m for m, _ in month_cols]

    # PL/BS分離（簡易判定：BSっぽい科目かどうか）
    bs_keywords = ["資産", "負債", "純資産", "現金", "預金", "売掛", "買掛", "借入",
                    "棚卸", "固定資産", "土地", "建物", "車両", "備品", "投資",
                    "資本金", "利益剰余金", "繰越利益"]

    pl_data = {}
    bs_data = {}
    for account, values in result_data.items():
        if any(kw in account for kw in bs_keywords):
            bs_data[account] = values
        else:
            pl_data[account] = values

    pl_df = pd.DataFrame(pl_data).T
    pl_df.columns = months if len(pl_df.columns) == len(months) else pl_df.columns

    bs_df = pd.DataFrame(bs_data).T
    bs_df.columns = months if len(bs_df.columns) == len(months) else bs_df.columns

    return {
        "pl": pl_df,
        "bs": bs_df,
        "months": months,
        "raw": result_data,
    }


def _find_header_row(df):
    """月を示すヘッダー行を検出"""
    month_patterns = [
        r"\d{4}[/\-年]\d{1,2}",  # 2024/04, 2024-04, 2024年4
        r"\d{1,2}月",             # 4月
    ]
    for idx in range(min(10, len(df))):
        row_str = " ".join(str(v) for v in df.iloc[idx])
        for pattern in month_patterns:
            if re.search(pattern, row_str):
                return idx
    return None


def _find_account_column(df, header_row):
    """科目名の列を検出"""
    known_accounts = ["売上高", "売上原価", "営業利益", "経常利益", "勘定科目", "科目"]
    for col in range(min(5, df.shape[1])):
        for row in range(header_row, min(header_row + 30, len(df))):
            val = str(df.iloc[row, col]).strip()
            if any(kw in val for kw in known_accounts):
                return col
    return 0  # デフォルトは最初の列


def _find_month_columns(df, header_row, account_col):
    """月の列インデックスとラベルを返す"""
    month_cols = []
    for col in range(df.shape[1]):
        if col == account_col:
            continue
        val = str(df.iloc[header_row, col]).strip()
        if val and val != "nan":
            # 数値のみの列はスキップ
            if re.search(r"[月/\-年]", val) or re.search(r"\d{4}", val):
                month_cols.append((val, col))
            elif "合計" in val or "累計" in val:
                month_cols.append((val, col))

    # 月が見つからない場合、account_col以降の全列を使用
    if not month_cols:
        for col in range(df.shape[1]):
            if col == account_col:
                continue
            val = str(df.iloc[header_row, col]).strip()
            if val and val != "nan":
                month_cols.append((val, col))

    return month_cols
