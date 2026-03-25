"""決算着地見込み分析"""


def compute_forecast(pl_data: dict, months: list, current_month_idx: int,
                     prior_year_pl: dict = None, prior_year_months: list = None) -> dict:
    """
    決算着地見込みを2パターンで計算する。

    パターンA: 残期間を当期実績の月平均で推計
    パターンB: 残期間を前期実績で推計

    Args:
        pl_data: 当期月次推移 {科目名: {月名: 金額}}
        months: 当期の月名リスト
        current_month_idx: 当月のインデックス（0始まり）
        prior_year_pl: 前期月次推移 {科目名: {月名: 金額}}
        prior_year_months: 前期の月名リスト

    Returns:
        {
            "actual_ytd": {科目名: 累計実績},
            "pattern_a": {科目名: 着地見込み（平均）},
            "pattern_b": {科目名: 着地見込み（前期）},
            "elapsed": 経過月数,
            "remaining": 残月数,
        }
    """
    elapsed = current_month_idx + 1
    remaining = len(months) - elapsed
    actual_months = months[:elapsed]

    actual_ytd = {}
    pattern_a = {}
    pattern_b = {}

    for account, values in pl_data.items():
        # 実績累計
        ytd = sum(values.get(m, 0) for m in actual_months)
        actual_ytd[account] = ytd

        # パターンA: 月平均 × 残月数
        monthly_avg = ytd / elapsed if elapsed > 0 else 0
        pattern_a[account] = ytd + (monthly_avg * remaining)

        # パターンB: 前期実績
        if prior_year_pl and account in prior_year_pl and prior_year_months:
            # 残期間に対応する前期の月の実績を使用
            remaining_months_prior = prior_year_months[elapsed:elapsed + remaining]
            prior_remaining = sum(prior_year_pl[account].get(m, 0) for m in remaining_months_prior)
            pattern_b[account] = ytd + prior_remaining
        else:
            # 前期データがない場合はパターンAと同じ
            pattern_b[account] = pattern_a[account]

    return {
        "actual_ytd": actual_ytd,
        "pattern_a": pattern_a,
        "pattern_b": pattern_b,
        "elapsed": elapsed,
        "remaining": remaining,
    }
