"""PL サマリー分析"""

from config import PL_SUMMARY_ITEMS
from utils.formatting import safe_div


def compute_pl_summary(pl_data: dict, months: list, current_month_idx: int) -> dict:
    """
    PLサマリーを計算する。

    Args:
        pl_data: {科目名: {月名: 金額}} 形式のdict
        months: 月名リスト
        current_month_idx: 当月のインデックス

    Returns:
        {
            "items": [{
                "account": 科目名,
                "current_month": 当月金額,
                "ytd": 期首累計,
                "ratio": 対売上比率,
            }]
        }
    """
    current_month = months[current_month_idx] if current_month_idx < len(months) else months[-1]
    ytd_months = months[:current_month_idx + 1]

    items = []
    revenue_current = 0
    revenue_ytd = 0

    for account in PL_SUMMARY_ITEMS:
        if account in pl_data:
            values = pl_data[account]
            current_val = values.get(current_month, 0)
            ytd_val = sum(values.get(m, 0) for m in ytd_months)
        else:
            current_val = 0
            ytd_val = 0

        if account == "売上高":
            revenue_current = current_val
            revenue_ytd = ytd_val

        ratio_current = safe_div(current_val, revenue_current) * 100 if revenue_current else None
        ratio_ytd = safe_div(ytd_val, revenue_ytd) * 100 if revenue_ytd else None

        items.append({
            "account": account,
            "current_month": current_val,
            "ytd": ytd_val,
            "ratio_current": ratio_current,
            "ratio_ytd": ratio_ytd,
        })

    return {"items": items}


def compute_monthly_transition(pl_data: dict, months: list, accounts: list = None) -> dict:
    """月次推移データを整形"""
    if accounts is None:
        accounts = list(pl_data.keys())

    transition = {}
    for account in accounts:
        if account in pl_data:
            transition[account] = {m: pl_data[account].get(m, 0) for m in months}
        else:
            transition[account] = {m: 0 for m in months}

    return transition
