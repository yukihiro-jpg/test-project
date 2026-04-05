"""
KPI計算モジュール（P/L、利益率、3期比較、前年対比、損益分岐点）
"""
import pandas as pd
from config import COST_BEHAVIOR


def compute_monthly_pl(df: pd.DataFrame) -> pd.DataFrame:
    """
    分類済み元帳DataFrameから月次損益計算書を算出する。

    収益科目: 貸方 - 借方 で計上
    費用科目: 借方 - 貸方 で計上
    期末棚卸高: 貸方（売上原価のマイナス）として扱う

    Returns:
        DataFrame with columns: year_month, 売上高, 売上原価, 売上総利益,
        販売費及び一般管理費, 営業利益, 営業外収益, 営業外費用, 経常利益,
        特別利益, 特別損失, 税引前利益, 法人税等, 当期純利益
    """
    pl_data = df[df["statement_type"] == "PL"].copy()

    if pl_data.empty:
        return pd.DataFrame()

    monthly = pl_data.groupby(["year_month", "category"]).agg(
        借方合計=("借方金額", "sum"),
        貸方合計=("貸方金額", "sum"),
    ).reset_index()

    months = sorted(pl_data["year_month"].unique())
    records = []

    for month in months:
        month_data = monthly[monthly["year_month"] == month]

        def get_amount(category, revenue_type=False):
            row = month_data[month_data["category"] == category]
            if row.empty:
                return 0
            if revenue_type:
                return float(row["貸方合計"].sum() - row["借方合計"].sum())
            return float(row["借方合計"].sum() - row["貸方合計"].sum())

        revenue = get_amount("revenue", revenue_type=True)
        cogs = get_amount("cogs")
        gross_profit = revenue - cogs
        sga = get_amount("sga")
        operating_profit = gross_profit - sga
        non_op_income = get_amount("non_op_income", revenue_type=True)
        non_op_expense = get_amount("non_op_expense")
        ordinary_profit = operating_profit + non_op_income - non_op_expense
        extraordinary_income = get_amount("extraordinary_income", revenue_type=True)
        extraordinary_loss = get_amount("extraordinary_loss")
        pretax_profit = ordinary_profit + extraordinary_income - extraordinary_loss
        tax = get_amount("tax")
        net_profit = pretax_profit - tax

        records.append({
            "year_month": month,
            "売上高": revenue,
            "売上原価": cogs,
            "売上総利益": gross_profit,
            "販売費及び一般管理費": sga,
            "営業利益": operating_profit,
            "営業外収益": non_op_income,
            "営業外費用": non_op_expense,
            "経常利益": ordinary_profit,
            "特別利益": extraordinary_income,
            "特別損失": extraordinary_loss,
            "税引前当期純利益": pretax_profit,
            "法人税等": tax,
            "当期純利益": net_profit,
        })

    result = pd.DataFrame(records)
    return result


def compute_annual_pl(monthly_pl: pd.DataFrame) -> pd.Series:
    """月次P/Lを年度合計にする"""
    numeric_cols = monthly_pl.select_dtypes(include="number").columns
    return monthly_pl[numeric_cols].sum()


def compute_cumulative_pl(monthly_pl: pd.DataFrame) -> pd.DataFrame:
    """月次P/Lの累計を算出"""
    result = monthly_pl.copy()
    numeric_cols = result.select_dtypes(include="number").columns
    result[numeric_cols] = result[numeric_cols].cumsum()
    return result


def compute_margins(monthly_pl: pd.DataFrame) -> pd.DataFrame:
    """利益率を算出して列追加"""
    result = monthly_pl.copy()
    result["売上総利益率"] = (result["売上総利益"] / result["売上高"] * 100).fillna(0)
    result["営業利益率"] = (result["営業利益"] / result["売上高"] * 100).fillna(0)
    result["経常利益率"] = (result["経常利益"] / result["売上高"] * 100).fillna(0)
    result["当期純利益率"] = (result["当期純利益"] / result["売上高"] * 100).fillna(0)
    return result


def compute_three_period_comparison(
    fiscal_year_data: dict[str, pd.DataFrame],
) -> pd.DataFrame:
    """
    3期比較テーブルを作成する。

    Args:
        fiscal_year_data: {期ラベル: 月次P/L DataFrame} の辞書（最大3期）

    Returns:
        行=P/L項目、列=期ラベル+増減のDataFrame
    """
    pl_items = [
        "売上高", "売上原価", "売上総利益",
        "販売費及び一般管理費", "営業利益",
        "営業外収益", "営業外費用", "経常利益",
        "特別利益", "特別損失", "税引前当期純利益",
        "法人税等", "当期純利益",
    ]

    periods = list(fiscal_year_data.keys())[:3]
    result = pd.DataFrame({"科目": pl_items})

    for period in periods:
        annual = compute_annual_pl(fiscal_year_data[period])
        result[period] = [annual.get(item, 0) for item in pl_items]

    # 増減額（当期 - 前期）
    if len(periods) >= 2:
        result["増減額"] = result[periods[0]] - result[periods[1]]
        result["増減率(%)"] = (
            (result["増減額"] / result[periods[1]].abs() * 100)
            .replace([float("inf"), float("-inf")], 0)
            .fillna(0)
            .round(1)
        )

    return result


def compute_yoy_monthly(
    current_pl: pd.DataFrame,
    previous_pl: pd.DataFrame,
) -> pd.DataFrame:
    """
    前年対比（月次ベース）を算出する。

    月番号（4月=1, 5月=2, ...）で紐付けて比較。
    """
    items = ["売上高", "売上総利益", "営業利益", "経常利益", "当期純利益"]

    current = current_pl[["year_month"] + items].copy()
    current["月"] = current["year_month"].apply(lambda p: p.month)

    previous = previous_pl[["year_month"] + items].copy()
    previous["月"] = previous["year_month"].apply(lambda p: p.month)

    merged = current.merge(
        previous[["月"] + items],
        on="月",
        suffixes=("_当期", "_前期"),
        how="left",
    )

    for item in items:
        merged[f"{item}_増減"] = merged[f"{item}_当期"] - merged[f"{item}_前期"].fillna(0)
        merged[f"{item}_増減率(%)"] = (
            (merged[f"{item}_増減"] / merged[f"{item}_前期"].abs() * 100)
            .replace([float("inf"), float("-inf")], 0)
            .fillna(0)
            .round(1)
        )

    return merged


def compute_budget_comparison(
    monthly_pl: pd.DataFrame,
    budget_df: pd.DataFrame,
) -> pd.DataFrame:
    """月次P/Lと予算を比較"""
    from src.account_classifier import classify_account

    # 予算を月次・カテゴリ別に集計
    budget_df = budget_df.copy()
    classifications = budget_df["勘定科目"].apply(classify_account)
    budget_df["display_group"] = classifications.apply(lambda x: x[2] if x else None)

    budget_monthly = budget_df.groupby(["年月", "display_group"])["予算額"].sum().reset_index()

    # 売上高の予算を抽出
    sales_budget = budget_monthly[budget_monthly["display_group"] == "売上高"]
    sales_budget = sales_budget.rename(columns={"年月": "year_month", "予算額": "予算_売上高"})

    result = monthly_pl.merge(
        sales_budget[["year_month", "予算_売上高"]],
        on="year_month",
        how="left",
    )
    result["売上高_予算差異"] = result["売上高"] - result["予算_売上高"].fillna(0)
    result["売上高_予算達成率(%)"] = (
        (result["売上高"] / result["予算_売上高"] * 100)
        .replace([float("inf"), float("-inf")], 0)
        .fillna(0)
        .round(1)
    )

    return result


def compute_sga_breakdown(df: pd.DataFrame) -> pd.DataFrame:
    """販管費の内訳を勘定科目別に集計"""
    sga_data = df[(df["statement_type"] == "PL") & (df["category"] == "sga")].copy()

    if sga_data.empty:
        return pd.DataFrame(columns=["勘定科目", "金額"])

    breakdown = sga_data.groupby("勘定科目").agg(
        金額=pd.NamedAgg(column="借方金額", aggfunc="sum"),
        貸方=pd.NamedAgg(column="貸方金額", aggfunc="sum"),
    ).reset_index()

    breakdown["金額"] = breakdown["金額"] - breakdown["貸方"]
    breakdown = breakdown[["勘定科目", "金額"]]
    breakdown = breakdown.sort_values("金額", ascending=False)

    return breakdown


def compute_breakeven(
    monthly_pl: pd.DataFrame,
    df: pd.DataFrame,
) -> dict:
    """
    損益分岐点分析を行う。

    固変分解:
    - 売上原価 → 変動費
    - 販管費 → COST_BEHAVIOR辞書に基づいて分類

    Returns:
        {
            "売上高": float,
            "変動費": float,
            "固定費": float,
            "変動費率": float,
            "限界利益": float,
            "限界利益率": float,
            "損益分岐点売上高": float,
            "安全余裕率": float,
        }
    """
    total_sales = monthly_pl["売上高"].sum()
    total_cogs = monthly_pl["売上原価"].sum()

    # 販管費を固変分解
    sga_data = df[(df["statement_type"] == "PL") & (df["category"] == "sga")].copy()
    fixed_sga = 0
    variable_sga = 0

    if not sga_data.empty:
        for _, row in sga_data.iterrows():
            amount = row["借方金額"] - row["貸方金額"]
            behavior = COST_BEHAVIOR.get(row["勘定科目"], "fixed")
            if behavior == "variable":
                variable_sga += amount
            else:
                fixed_sga += amount

    variable_cost = total_cogs + variable_sga
    fixed_cost = fixed_sga

    variable_cost_ratio = variable_cost / total_sales if total_sales else 0
    marginal_profit = total_sales - variable_cost
    marginal_profit_ratio = marginal_profit / total_sales if total_sales else 0
    breakeven_sales = fixed_cost / marginal_profit_ratio if marginal_profit_ratio else 0
    safety_margin = ((total_sales - breakeven_sales) / total_sales * 100) if total_sales else 0

    return {
        "売上高": total_sales,
        "変動費": variable_cost,
        "固定費": fixed_cost,
        "変動費率": variable_cost_ratio * 100,
        "限界利益": marginal_profit,
        "限界利益率": marginal_profit_ratio * 100,
        "損益分岐点売上高": breakeven_sales,
        "安全余裕率": safety_margin,
    }


def compute_kpi_summary(
    current_pl: pd.DataFrame,
    previous_pl: pd.DataFrame | None = None,
) -> dict:
    """
    KPIサマリーを算出する。

    Returns:
        {
            "売上高": {"value": float, "delta": float, "delta_pct": float},
            "売上総利益": {...},
            "営業利益": {...},
            "当期純利益": {...},
        }
    """
    current_total = compute_annual_pl(current_pl)
    previous_total = compute_annual_pl(previous_pl) if previous_pl is not None and not previous_pl.empty else None

    items = ["売上高", "売上総利益", "営業利益", "当期純利益"]
    result = {}

    for item in items:
        current_val = current_total.get(item, 0)
        if previous_total is not None:
            prev_val = previous_total.get(item, 0)
            delta = current_val - prev_val
            delta_pct = (delta / abs(prev_val) * 100) if prev_val != 0 else 0
        else:
            delta = 0
            delta_pct = 0

        result[item] = {
            "value": current_val,
            "delta": delta,
            "delta_pct": round(delta_pct, 1),
        }

    return result
