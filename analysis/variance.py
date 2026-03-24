"""増減分析"""

from config import VARIANCE_THRESHOLD_PCT, VARIANCE_THRESHOLD_ABS
from utils.formatting import format_change


def compute_variance_analysis(comparative_data: dict, periods: list) -> list:
    """
    3期比較の増減分析を行う。

    Args:
        comparative_data: {科目名: {期名: 金額}}
        periods: 期名リスト（古い順）

    Returns:
        [{
            "account": 科目名,
            "values": {期名: 金額},
            "changes": [{
                "from": 期名, "to": 期名,
                "amount": 増減額, "rate": 増減率,
                "is_significant": bool
            }],
        }]
    """
    results = []

    for account, values in comparative_data.items():
        changes = []
        for i in range(1, len(periods)):
            prev_period = periods[i - 1]
            curr_period = periods[i]
            prev_val = values.get(prev_period, 0)
            curr_val = values.get(curr_period, 0)

            change_amt, change_rate = format_change(curr_val, prev_val)

            is_significant = False
            if change_amt is not None:
                if abs(change_amt) >= VARIANCE_THRESHOLD_ABS:
                    is_significant = True
                if change_rate is not None and abs(change_rate) >= VARIANCE_THRESHOLD_PCT:
                    is_significant = True

            changes.append({
                "from": prev_period,
                "to": curr_period,
                "amount": change_amt,
                "rate": change_rate,
                "is_significant": is_significant,
            })

        results.append({
            "account": account,
            "values": values,
            "changes": changes,
        })

    return results
