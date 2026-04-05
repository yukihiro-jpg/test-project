"""
Excel出力モジュール
"""
import io
import pandas as pd
from src.metrics import (
    compute_annual_pl,
    compute_three_period_comparison,
    compute_margins,
)
from src.loan_analyzer import compute_loan_balance, compute_interest_summary
from src.cash_flow import compute_monthly_cashflow


def generate_excel(
    fiscal_years: dict,
    period_pls: dict,
    client_name: str,
    fiscal_year_end_month: int,
) -> io.BytesIO:
    """
    複数シートのExcelワークブックを生成する。

    Returns:
        BytesIO buffer containing the Excel file
    """
    buffer = io.BytesIO()

    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        # Sheet 1: 当期月次P/L
        periods = list(period_pls.keys())
        if periods:
            current_pl = period_pls[periods[0]].copy()
            current_pl["year_month"] = current_pl["year_month"].astype(str)
            current_pl = current_pl.rename(columns={"year_month": "年月"})
            current_pl.to_excel(writer, sheet_name="当期月次損益", index=False)

        # Sheet 2: 3期比較
        if len(period_pls) >= 2:
            comparison = compute_three_period_comparison(period_pls)
            comparison.to_excel(writer, sheet_name="3期比較", index=False)

        # Sheet 3: 利益率推移
        if periods:
            margins = compute_margins(period_pls[periods[0]]).copy()
            margins["year_month"] = margins["year_month"].astype(str)
            margins = margins.rename(columns={"year_month": "年月"})
            margin_cols = ["年月", "売上総利益率", "営業利益率", "経常利益率", "当期純利益率"]
            margins[margin_cols].to_excel(writer, sheet_name="利益率推移", index=False)

        # Sheet 4: 借入金推移
        all_data = pd.concat(fiscal_years.values(), ignore_index=True)
        loan_balance = compute_loan_balance(all_data)
        if not loan_balance.empty:
            lb = loan_balance.copy()
            lb["year_month"] = lb["year_month"].astype(str)
            lb = lb.rename(columns={"year_month": "年月"})
            lb.to_excel(writer, sheet_name="借入金推移", index=False)

        # Sheet 5: キャッシュフロー
        if periods:
            current_data = fiscal_years[periods[0]]
            cf = compute_monthly_cashflow(current_data)
            if not cf.empty:
                cf_display = cf.copy()
                cf_display["year_month"] = cf_display["year_month"].astype(str)
                cf_display = cf_display.rename(columns={"year_month": "年月"})
                cf_display.to_excel(writer, sheet_name="キャッシュフロー", index=False)

    buffer.seek(0)
    return buffer
