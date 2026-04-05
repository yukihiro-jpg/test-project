"""
CSV読込・バリデーション・前処理モジュール
"""
import pandas as pd
import io
from src.account_classifier import classify_dataframe

# 列名の正規化マッピング（よくある表記ゆれを統一）
COLUMN_ALIASES = {
    "日付": ["日付", "取引日", "伝票日付", "年月日"],
    "勘定科目": ["勘定科目", "科目", "科目名", "勘定科目名"],
    "補助科目": ["補助科目", "補助科目名", "補助"],
    "借方金額": ["借方金額", "借方", "借方額"],
    "貸方金額": ["貸方金額", "貸方", "貸方額"],
    "摘要": ["摘要", "摘要文", "適用", "メモ"],
    "部門": ["部門", "部門名", "部門コード"],
}


def _try_read_csv(file_or_path, encodings=None) -> pd.DataFrame:
    """複数エンコーディングを試行してCSVを読み込む"""
    if encodings is None:
        encodings = ["utf-8-sig", "utf-8", "shift_jis", "cp932"]

    for enc in encodings:
        try:
            if isinstance(file_or_path, (str,)):
                df = pd.read_csv(file_or_path, encoding=enc, dtype=str)
            else:
                file_or_path.seek(0)
                df = pd.read_csv(file_or_path, encoding=enc, dtype=str)
            return df
        except (UnicodeDecodeError, UnicodeError):
            continue

    raise ValueError("CSVの文字コードを自動判別できませんでした。UTF-8またはShift-JISで保存してください。")


def _normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    """列名を正規化する"""
    rename_map = {}
    for standard_name, aliases in COLUMN_ALIASES.items():
        for alias in aliases:
            for col in df.columns:
                if col.strip() == alias:
                    rename_map[col] = standard_name
                    break

    df = df.rename(columns=rename_map)
    return df


def _clean_amount(series: pd.Series) -> pd.Series:
    """金額列をクリーニングして数値に変換"""
    cleaned = series.astype(str)
    # カンマ除去
    cleaned = cleaned.str.replace(",", "", regex=False)
    # 全角数字→半角
    for zenkaku, hankaku in zip("０１２３４５６７８９", "0123456789"):
        cleaned = cleaned.str.replace(zenkaku, hankaku, regex=False)
    # 空文字・NaN→0
    cleaned = cleaned.str.strip()
    cleaned = cleaned.replace({"": "0", "nan": "0", "None": "0"})
    return pd.to_numeric(cleaned, errors="coerce").fillna(0)


def load_ledger_csv(file_or_path) -> pd.DataFrame:
    """
    元帳CSVを読み込み、正規化・分類済みのDataFrameを返す。

    必須列: 日付, 勘定科目, 借方金額, 貸方金額
    任意列: 補助科目, 摘要, 部門

    Returns:
        DataFrame with columns:
            日付, 勘定科目, 補助科目, 借方金額, 貸方金額, 摘要, 部門,
            year_month, fiscal_year, statement_type, category, display_group
    """
    df = _try_read_csv(file_or_path)
    df = _normalize_columns(df)

    # 必須列チェック
    required = ["日付", "勘定科目", "借方金額", "貸方金額"]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"必須列が見つかりません: {', '.join(missing)}")

    # 任意列の補完
    for col in ["補助科目", "摘要", "部門"]:
        if col not in df.columns:
            df[col] = ""

    # 金額クリーニング
    df["借方金額"] = _clean_amount(df["借方金額"])
    df["貸方金額"] = _clean_amount(df["貸方金額"])

    # 日付パース
    df["日付"] = pd.to_datetime(df["日付"], format="mixed", dayfirst=False)
    df = df.dropna(subset=["日付"])

    # 年月列追加
    df["year_month"] = df["日付"].dt.to_period("M")

    # 勘定科目分類
    df = classify_dataframe(df)

    return df


def load_budget_csv(file_or_path) -> pd.DataFrame:
    """
    予算CSVを読み込む。

    期待列: 年月, 勘定科目, 予算額
    """
    df = _try_read_csv(file_or_path)

    # 列名の正規化
    rename_map = {}
    for col in df.columns:
        col_stripped = col.strip()
        if col_stripped in ["年月", "月", "期間"]:
            rename_map[col] = "年月"
        elif col_stripped in ["勘定科目", "科目", "科目名"]:
            rename_map[col] = "勘定科目"
        elif col_stripped in ["予算額", "予算", "金額"]:
            rename_map[col] = "予算額"
    df = df.rename(columns=rename_map)

    required = ["年月", "勘定科目", "予算額"]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"予算CSVに必須列が見つかりません: {', '.join(missing)}")

    df["予算額"] = _clean_amount(df["予算額"])
    df["年月"] = pd.to_datetime(df["年月"], format="mixed").dt.to_period("M")

    return df


def split_fiscal_years(df: pd.DataFrame, fiscal_year_end_month: int = 3) -> dict[str, pd.DataFrame]:
    """
    DataFrameを会計年度ごとに分割する。

    Args:
        df: year_month列を持つDataFrame
        fiscal_year_end_month: 決算月（デフォルト3月）

    Returns:
        {"2024年3月期": DataFrame, "2023年3月期": DataFrame, ...}
    """
    df = df.copy()

    def get_fiscal_year(period):
        if period.month <= fiscal_year_end_month:
            return period.year
        return period.year + 1

    df["fiscal_year"] = df["year_month"].apply(get_fiscal_year)
    result = {}

    for fy in sorted(df["fiscal_year"].unique(), reverse=True):
        label = f"{fy}年{fiscal_year_end_month}月期"
        result[label] = df[df["fiscal_year"] == fy].copy()

    return result


def get_fiscal_year_label(period, fiscal_year_end_month: int = 3) -> str:
    """期間から会計年度ラベルを取得"""
    if period.month <= fiscal_year_end_month:
        fy = period.year
    else:
        fy = period.year + 1
    return f"{fy}年{fiscal_year_end_month}月期"
