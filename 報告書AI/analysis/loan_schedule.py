"""借入金返済スケジュール分析"""

import math


def compute_loan_schedule(loans: list) -> dict:
    """
    借入金の返済スケジュールを計算する。

    Args:
        loans: [{
            "name": 契約名,
            "lender": 借入先,
            "remaining_balance": 残高,
            "monthly_payment": 月額返済額,
            "interest_rate": 年利率（%）,
            "loan_type": "長期" or "短期",
        }]

    Returns:
        {
            "contracts": [{各契約の詳細 + 残回数・残期間}],
            "total": {合計情報},
        }
    """
    contracts = []
    total_balance = 0
    total_monthly = 0
    total_annual = 0

    for loan in loans:
        balance = loan.get("remaining_balance", 0)
        monthly = loan.get("monthly_payment", 0)
        rate = loan.get("interest_rate", 0) / 100

        if monthly > 0:
            # 利息考慮した残回数の概算
            if rate > 0:
                monthly_rate = rate / 12
                # 元利均等返済の残回数
                try:
                    remaining_payments = math.ceil(
                        -math.log(1 - (balance * monthly_rate / monthly)) / math.log(1 + monthly_rate)
                    )
                except (ValueError, ZeroDivisionError):
                    remaining_payments = math.ceil(balance / monthly)
            else:
                remaining_payments = math.ceil(balance / monthly)

            remaining_years = remaining_payments / 12
            remaining_years_int = int(remaining_years)
            remaining_months_frac = round((remaining_years - remaining_years_int) * 12)
        else:
            remaining_payments = None
            remaining_years = None
            remaining_years_int = None
            remaining_months_frac = None

        annual_payment = monthly * 12

        contract_info = {
            **loan,
            "remaining_payments": remaining_payments,
            "remaining_years": remaining_years_int,
            "remaining_months": remaining_months_frac,
            "remaining_period_str": _format_period(remaining_years_int, remaining_months_frac),
            "annual_payment": annual_payment,
        }
        contracts.append(contract_info)

        total_balance += balance
        total_monthly += monthly
        total_annual += annual_payment

    return {
        "contracts": contracts,
        "total": {
            "total_balance": total_balance,
            "total_monthly_payment": total_monthly,
            "total_annual_payment": total_annual,
        },
    }


def _format_period(years, months):
    """残期間を文字列でフォーマット"""
    if years is None:
        return "-"
    parts = []
    if years > 0:
        parts.append(f"{years}年")
    if months > 0:
        parts.append(f"{months}ヶ月")
    return "".join(parts) if parts else "完済"
