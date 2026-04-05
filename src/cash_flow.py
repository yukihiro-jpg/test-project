"""
キャッシュフロー計算モジュール（簡易方式：現金/預金科目の動きを追跡）
"""
import pandas as pd


def compute_monthly_cashflow(df: pd.DataFrame) -> pd.DataFrame:
    """
    元帳データから月次キャッシュフローを簡易算出する。

    営業CF: 営業収入（売上入金）- 営業支出（仕入・経費支払）
    投資CF: 固定資産の取得・売却
    財務CF: 借入金の借入・返済

    簡易方式: 現金/預金科目への入出金を相手科目のカテゴリで分類
    """
    cash_accounts = df[df["category"] == "cash"].copy()

    if cash_accounts.empty:
        return pd.DataFrame()

    months = sorted(df["year_month"].unique())
    records = []

    for month in months:
        month_data = df[df["year_month"] == month]

        # 営業CF: PL科目に関連する現金の動き
        pl_related = month_data[month_data["statement_type"] == "PL"]
        operating_income = float(pl_related[pl_related["category"] == "revenue"]["貸方金額"].sum())
        operating_expense = float(
            pl_related[pl_related["category"].isin(["cogs", "sga", "non_op_expense"])]["借方金額"].sum()
        )
        # 売上債権・仕入債務の変動も考慮（簡易）
        receivable_change = float(
            month_data[month_data["category"] == "receivable"]["借方金額"].sum()
            - month_data[month_data["category"] == "receivable"]["貸方金額"].sum()
        )
        payable_change = float(
            month_data[month_data["category"] == "payable"]["貸方金額"].sum()
            - month_data[month_data["category"] == "payable"]["借方金額"].sum()
        )
        operating_cf = operating_income - operating_expense - receivable_change + payable_change

        # 投資CF: 固定資産の取得（借方）・売却（貸方）
        fixed_asset = month_data[month_data["category"] == "fixed_asset"]
        investing_cf = float(fixed_asset["貸方金額"].sum() - fixed_asset["借方金額"].sum())

        # 財務CF: 借入金の借入（貸方）・返済（借方）
        loan_data = month_data[
            month_data["category"].isin(["short_term_loan", "long_term_loan"])
        ]
        financing_cf = float(loan_data["貸方金額"].sum() - loan_data["借方金額"].sum())

        # 現金残高: 現金/預金科目の借方 - 貸方の累計
        cash_data = month_data[month_data["category"] == "cash"]
        cash_movement = float(cash_data["借方金額"].sum() - cash_data["貸方金額"].sum())

        records.append({
            "year_month": month,
            "営業CF": operating_cf,
            "投資CF": investing_cf,
            "財務CF": financing_cf,
            "CF合計": operating_cf + investing_cf + financing_cf,
            "現金増減": cash_movement,
        })

    result = pd.DataFrame(records)

    # 現金残高の累計算出
    result["現金残高累計"] = result["現金増減"].cumsum()

    return result
