"""
勘定科目を財務諸表カテゴリに分類するモジュール
"""
import re
from config import ACCOUNT_MAP


def normalize_account_name(name: str) -> str:
    """勘定科目名を正規化（全角→半角スペース、前後空白除去）"""
    name = name.strip()
    name = name.replace("\u3000", " ")  # 全角スペース→半角
    name = re.sub(r"\s+", "", name)  # スペース除去
    name = name.replace("・", "")  # 中黒除去
    return name


def classify_account(account_name: str) -> tuple[str, str, str] | None:
    """
    勘定科目名を分類する。

    Returns:
        (statement_type, category, display_group) or None if unrecognized
        例: ("PL", "revenue", "売上高")
    """
    normalized = normalize_account_name(account_name)

    # 1. 完全一致
    if normalized in ACCOUNT_MAP:
        return ACCOUNT_MAP[normalized]

    # 2. 正規化前の元名で完全一致
    if account_name.strip() in ACCOUNT_MAP:
        return ACCOUNT_MAP[account_name.strip()]

    # 3. 部分一致（前方一致優先）
    for key, value in ACCOUNT_MAP.items():
        if normalized.startswith(key) or key.startswith(normalized):
            return value

    # 4. 部分文字列一致
    for key, value in ACCOUNT_MAP.items():
        if key in normalized or normalized in key:
            return value

    return None


def classify_dataframe(df, account_col: str = "勘定科目"):
    """
    DataFrameの勘定科目列を分類し、分類列を追加して返す。

    追加列:
        - statement_type: "PL" or "BS"
        - category: 詳細カテゴリ
        - display_group: 表示用グループ名
    """
    classifications = df[account_col].apply(classify_account)

    df = df.copy()
    df["statement_type"] = classifications.apply(lambda x: x[0] if x else None)
    df["category"] = classifications.apply(lambda x: x[1] if x else None)
    df["display_group"] = classifications.apply(lambda x: x[2] if x else None)

    return df


def get_unclassified_accounts(df, account_col: str = "勘定科目") -> list[str]:
    """未分類の勘定科目一覧を返す"""
    accounts = df[account_col].unique()
    return [a for a in accounts if classify_account(a) is None]
