"""
借入金分析・返済スケジュール・完済シミュレーションモジュール
"""
import pandas as pd
import numpy as np
from config import LOAN_ACCOUNTS, INTEREST_ACCOUNTS


def extract_loan_data(df: pd.DataFrame) -> pd.DataFrame:
    """
    元帳データから借入金関連の仕訳を抽出する。
    """
    loan_mask = df["勘定科目"].isin(LOAN_ACCOUNTS)
    return df[loan_mask].copy()


def extract_interest_data(df: pd.DataFrame) -> pd.DataFrame:
    """支払利息の仕訳を抽出"""
    interest_mask = df["勘定科目"].isin(INTEREST_ACCOUNTS)
    return df[interest_mask].copy()


def compute_loan_balance(df: pd.DataFrame) -> pd.DataFrame:
    """
    月次の借入金残高推移を算出する。

    借入金は貸方で増加（借入実行）、借方で減少（返済）。

    Returns:
        DataFrame: year_month, 長期借入金_残高, 短期借入金_残高, 合計残高,
                   返済額, 新規借入額
    """
    loan_data = extract_loan_data(df)

    if loan_data.empty:
        return pd.DataFrame()

    months = sorted(df["year_month"].unique())
    records = []

    cumulative_long = 0
    cumulative_short = 0

    for month in months:
        month_loans = loan_data[loan_data["year_month"] == month]

        # 長期借入金
        long_term = month_loans[
            month_loans["勘定科目"].isin(["長期借入金"])
        ]
        long_borrow = float(long_term["貸方金額"].sum())
        long_repay = float(long_term["借方金額"].sum())

        # 短期借入金（一年以内返済長期借入金を含む）
        short_term = month_loans[
            month_loans["勘定科目"].isin(["短期借入金", "一年以内返済長期借入金"])
        ]
        short_borrow = float(short_term["貸方金額"].sum())
        short_repay = float(short_term["借方金額"].sum())

        cumulative_long += long_borrow - long_repay
        cumulative_short += short_borrow - short_repay

        total_repay = long_repay + short_repay
        total_borrow = long_borrow + short_borrow

        records.append({
            "year_month": month,
            "長期借入金_残高": cumulative_long,
            "短期借入金_残高": cumulative_short,
            "合計残高": cumulative_long + cumulative_short,
            "返済額": total_repay,
            "新規借入額": total_borrow,
        })

    return pd.DataFrame(records)


def compute_interest_summary(df: pd.DataFrame) -> pd.DataFrame:
    """月次の支払利息を集計"""
    interest_data = extract_interest_data(df)

    if interest_data.empty:
        return pd.DataFrame()

    monthly_interest = interest_data.groupby("year_month").agg(
        支払利息=pd.NamedAgg(column="借方金額", aggfunc="sum"),
    ).reset_index()

    return monthly_interest


def estimate_effective_rate(
    loan_balance: pd.DataFrame,
    interest_summary: pd.DataFrame,
) -> float:
    """
    直近6ヶ月の実効金利を推定する。

    実効年利 = (直近6ヶ月の支払利息合計 / 直近6ヶ月の平均残高) × 2
    """
    if loan_balance.empty or interest_summary.empty:
        return 0.0

    recent_months = loan_balance.tail(6)
    avg_balance = recent_months["合計残高"].mean()

    if avg_balance <= 0:
        return 0.0

    recent_interest = interest_summary.tail(6)
    total_interest = recent_interest["支払利息"].sum()

    months_count = len(recent_months)
    annual_rate = (total_interest / avg_balance) * (12 / months_count) * 100

    return round(annual_rate, 2)


def simulate_payoff(
    current_balance: float,
    monthly_repayment: float,
    annual_rate: float,
    extra_monthly_payment: float = 0,
    max_months: int = 360,
) -> pd.DataFrame:
    """
    完済シミュレーションを行う。

    Args:
        current_balance: 現在の借入金残高
        monthly_repayment: 月次返済額（元金+利息）
        annual_rate: 年利（%）
        extra_monthly_payment: 繰上返済月額
        max_months: 最大シミュレーション月数

    Returns:
        DataFrame: 月, 返済額, 利息, 元金返済, 残高
    """
    if current_balance <= 0 or monthly_repayment <= 0:
        return pd.DataFrame()

    monthly_rate = annual_rate / 100 / 12
    balance = current_balance
    total_repayment = monthly_repayment + extra_monthly_payment
    records = []

    for month in range(1, max_months + 1):
        interest = balance * monthly_rate
        principal = min(total_repayment - interest, balance)

        if principal <= 0:
            # 利息が返済額を超える場合
            principal = 0
            interest = total_repayment

        balance -= principal

        records.append({
            "月": month,
            "返済額": total_repayment,
            "利息": interest,
            "元金返済": principal,
            "残高": max(balance, 0),
        })

        if balance <= 0:
            break

    return pd.DataFrame(records)


def get_loan_summary(df: pd.DataFrame) -> dict:
    """
    借入金のサマリー情報を返す。

    Returns:
        {
            "current_balance": float,  # 現在の借入金残高
            "long_term_balance": float,
            "short_term_balance": float,
            "avg_monthly_repayment": float,  # 直近6ヶ月平均返済額
            "estimated_rate": float,  # 推定実効金利(%)
            "total_interest_ytd": float,  # 当期支払利息累計
        }
    """
    loan_balance = compute_loan_balance(df)
    interest_summary = compute_interest_summary(df)

    if loan_balance.empty:
        return {
            "current_balance": 0,
            "long_term_balance": 0,
            "short_term_balance": 0,
            "avg_monthly_repayment": 0,
            "estimated_rate": 0,
            "total_interest_ytd": 0,
        }

    latest = loan_balance.iloc[-1]
    recent_repayments = loan_balance.tail(6)
    avg_repayment = recent_repayments["返済額"].mean()

    rate = estimate_effective_rate(loan_balance, interest_summary)
    total_interest = float(interest_summary["支払利息"].sum()) if not interest_summary.empty else 0

    return {
        "current_balance": float(latest["合計残高"]),
        "long_term_balance": float(latest["長期借入金_残高"]),
        "short_term_balance": float(latest["短期借入金_残高"]),
        "avg_monthly_repayment": float(avg_repayment),
        "estimated_rate": rate,
        "total_interest_ytd": total_interest,
    }
