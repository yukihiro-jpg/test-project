"""
Plotlyチャート生成モジュール
"""
import plotly.graph_objects as go
import plotly.express as px
import pandas as pd
from config import COLORS


def _format_months_jp(year_month_series) -> list[str]:
    """year_monthを '2025年4月' 形式の日本語に変換"""
    result = []
    for p in year_month_series:
        s = str(p)
        if "-" in s:
            parts = s.split("-")
            result.append(f"{parts[0]}年{int(parts[1])}月")
        else:
            result.append(s)
    return result


def _common_layout(fig, title="", height=450):
    """共通のレイアウト設定"""
    fig.update_layout(
        title=dict(text=title, font=dict(size=16, color=COLORS["primary"])),
        template="plotly_white",
        height=height,
        font=dict(family="sans-serif", size=12),
        legend=dict(orientation="h", yanchor="bottom", y=-0.25, xanchor="center", x=0.5),
        margin=dict(l=60, r=30, t=50, b=60),
        hovermode="x unified",
    )
    return fig


def _format_axis_yen(fig, axis="y"):
    """Y軸を円表示にフォーマット"""
    fig.update_yaxes(tickformat=",", ticksuffix="円")
    return fig


def create_monthly_trend_chart(monthly_pl: pd.DataFrame) -> go.Figure:
    """月次売上・利益推移チャート（棒グラフ+折れ線）"""
    fig = go.Figure()

    months = _format_months_jp(monthly_pl["year_month"])

    fig.add_trace(go.Bar(
        x=months, y=monthly_pl["売上高"],
        name="売上高", marker_color=COLORS["primary"],
        opacity=0.8,
    ))
    fig.add_trace(go.Bar(
        x=months, y=monthly_pl["売上総利益"],
        name="売上総利益", marker_color=COLORS["secondary"],
        opacity=0.7,
    ))
    fig.add_trace(go.Scatter(
        x=months, y=monthly_pl["営業利益"],
        name="営業利益", mode="lines+markers",
        line=dict(color=COLORS["accent_orange"], width=2),
        marker=dict(size=6),
    ))
    fig.add_trace(go.Scatter(
        x=months, y=monthly_pl["当期純利益"],
        name="当期純利益", mode="lines+markers",
        line=dict(color=COLORS["accent_green"], width=2, dash="dot"),
        marker=dict(size=5),
    ))

    fig = _common_layout(fig, "月次売上・利益推移")
    fig = _format_axis_yen(fig)
    fig.update_layout(barmode="group")

    return fig


def create_cumulative_chart(cumulative_pl: pd.DataFrame) -> go.Figure:
    """累計推移チャート"""
    fig = go.Figure()

    months = _format_months_jp(cumulative_pl["year_month"])

    for item, color in [
        ("売上高", COLORS["primary"]),
        ("売上総利益", COLORS["secondary"]),
        ("営業利益", COLORS["accent_orange"]),
    ]:
        fig.add_trace(go.Scatter(
            x=months, y=cumulative_pl[item],
            name=item, mode="lines+markers",
            line=dict(color=color, width=2),
        ))

    fig = _common_layout(fig, "累計推移")
    fig = _format_axis_yen(fig)
    return fig


def create_budget_comparison_chart(comparison_df: pd.DataFrame) -> go.Figure:
    """予算対比チャート"""
    fig = go.Figure()

    months = _format_months_jp(comparison_df["year_month"])

    fig.add_trace(go.Bar(
        x=months, y=comparison_df["予算_売上高"],
        name="予算", marker_color=COLORS["light_gray"],
    ))
    fig.add_trace(go.Bar(
        x=months, y=comparison_df["売上高"],
        name="実績", marker_color=COLORS["primary"],
    ))

    fig = _common_layout(fig, "売上高 予算対比")
    fig = _format_axis_yen(fig)
    fig.update_layout(barmode="group")

    return fig


def create_three_period_chart(comparison_df: pd.DataFrame) -> go.Figure:
    """3期比較棒グラフ"""
    fig = go.Figure()

    items = ["売上高", "売上原価", "売上総利益", "販売費及び一般管理費", "営業利益", "経常利益", "当期純利益"]
    period_cols = [c for c in comparison_df.columns if c not in ["科目", "増減額", "増減率(%)"]]

    filtered = comparison_df[comparison_df["科目"].isin(items)]

    for i, period in enumerate(period_cols):
        fig.add_trace(go.Bar(
            x=filtered["科目"], y=filtered[period],
            name=period, marker_color=COLORS["period_colors"][i % 3],
        ))

    fig = _common_layout(fig, "3期比較", height=500)
    fig = _format_axis_yen(fig)
    fig.update_layout(barmode="group")

    return fig


def create_three_period_stacked_chart(comparison_df: pd.DataFrame) -> go.Figure:
    """3期比較 積み上げ棒グラフ（P/L構造）"""
    fig = go.Figure()

    period_cols = [c for c in comparison_df.columns if c not in ["科目", "増減額", "増減率(%)"]]
    structure_items = ["売上原価", "売上総利益"]

    for i, period in enumerate(period_cols):
        sales_row = comparison_df[comparison_df["科目"] == "売上原価"]
        gross_row = comparison_df[comparison_df["科目"] == "売上総利益"]

        if not sales_row.empty:
            fig.add_trace(go.Bar(
                x=[period], y=[float(sales_row[period].values[0])],
                name="売上原価" if i == 0 else None,
                marker_color=COLORS["accent_orange"],
                showlegend=(i == 0),
                legendgroup="売上原価",
            ))
        if not gross_row.empty:
            fig.add_trace(go.Bar(
                x=[period], y=[float(gross_row[period].values[0])],
                name="売上総利益" if i == 0 else None,
                marker_color=COLORS["secondary"],
                showlegend=(i == 0),
                legendgroup="売上総利益",
            ))

    fig = _common_layout(fig, "P/L構造 3期比較", height=500)
    fig = _format_axis_yen(fig)
    fig.update_layout(barmode="stack")

    return fig


def create_yoy_chart(yoy_df: pd.DataFrame) -> go.Figure:
    """前年対比チャート"""
    fig = go.Figure()

    months = _format_months_jp(yoy_df["year_month"])

    fig.add_trace(go.Bar(
        x=months, y=yoy_df["売上高_前期"],
        name="前期", marker_color=COLORS["light_gray"],
    ))
    fig.add_trace(go.Bar(
        x=months, y=yoy_df["売上高_当期"],
        name="当期", marker_color=COLORS["primary"],
    ))
    fig.add_trace(go.Scatter(
        x=months, y=yoy_df["売上高_増減率(%)"],
        name="増減率(%)", mode="lines+markers",
        line=dict(color=COLORS["accent_red"], width=2),
        yaxis="y2",
    ))

    fig = _common_layout(fig, "売上高 前年対比")
    fig.update_layout(
        barmode="group",
        yaxis=dict(title="金額", tickformat=",", ticksuffix="円"),
        yaxis2=dict(title="増減率(%)", overlaying="y", side="right", ticksuffix="%"),
    )

    return fig


def create_margin_trend_chart(monthly_pl_with_margins: pd.DataFrame) -> go.Figure:
    """利益率推移チャート"""
    fig = go.Figure()

    months = _format_months_jp(monthly_pl_with_margins["year_month"])

    for item, color in [
        ("売上総利益率", COLORS["primary"]),
        ("営業利益率", COLORS["secondary"]),
        ("経常利益率", COLORS["accent_green"]),
    ]:
        fig.add_trace(go.Scatter(
            x=months, y=monthly_pl_with_margins[item],
            name=item, mode="lines+markers",
            line=dict(color=color, width=2),
        ))

    fig = _common_layout(fig, "利益率推移")
    fig.update_yaxes(ticksuffix="%")

    return fig


def create_pl_waterfall_chart(monthly_pl: pd.DataFrame, month_label: str = None) -> go.Figure:
    """P/Lウォーターフォールチャート"""
    if month_label:
        data = monthly_pl[monthly_pl["year_month"].astype(str) == month_label].iloc[0]
    else:
        data = monthly_pl.iloc[-1]

    labels = ["売上高", "売上原価", "売上総利益", "販管費", "営業利益",
              "営業外損益", "経常利益", "特別損益", "税引前利益", "法人税等", "当期純利益"]
    values = [
        data["売上高"],
        -data["売上原価"],
        data["売上総利益"],
        -data["販売費及び一般管理費"],
        data["営業利益"],
        data["営業外収益"] - data["営業外費用"],
        data["経常利益"],
        data["特別利益"] - data["特別損失"],
        data["税引前当期純利益"],
        -data["法人税等"],
        data["当期純利益"],
    ]
    measures = ["absolute", "relative", "total", "relative", "total",
                "relative", "total", "relative", "total", "relative", "total"]

    fig = go.Figure(go.Waterfall(
        x=labels, y=values, measure=measures,
        connector=dict(line=dict(color=COLORS["light_gray"])),
        increasing=dict(marker=dict(color=COLORS["accent_green"])),
        decreasing=dict(marker=dict(color=COLORS["accent_red"])),
        totals=dict(marker=dict(color=COLORS["primary"])),
    ))

    fig = _common_layout(fig, "損益計算書 ウォーターフォール", height=500)
    fig = _format_axis_yen(fig)

    return fig


def create_cost_breakdown_pie(sga_breakdown: pd.DataFrame) -> go.Figure:
    """費用内訳円グラフ"""
    top_items = sga_breakdown.head(10)
    others = sga_breakdown.iloc[10:]

    labels = list(top_items["勘定科目"])
    values = list(top_items["金額"])

    if not others.empty:
        labels.append("その他")
        values.append(others["金額"].sum())

    fig = go.Figure(go.Pie(
        labels=labels, values=values,
        hole=0.4,
        marker=dict(colors=COLORS["chart_sequence"]),
        textinfo="label+percent",
        textposition="outside",
    ))

    fig = _common_layout(fig, "販管費内訳", height=500)

    return fig


def create_cashflow_chart(cf_df: pd.DataFrame) -> go.Figure:
    """キャッシュフローチャート"""
    fig = go.Figure()

    months = _format_months_jp(cf_df["year_month"])

    fig.add_trace(go.Bar(
        x=months, y=cf_df["営業CF"],
        name="営業CF", marker_color=COLORS["primary"],
    ))
    fig.add_trace(go.Bar(
        x=months, y=cf_df["投資CF"],
        name="投資CF", marker_color=COLORS["accent_blue"],
    ))
    fig.add_trace(go.Bar(
        x=months, y=cf_df["財務CF"],
        name="財務CF", marker_color=COLORS["accent_orange"],
    ))
    fig.add_trace(go.Scatter(
        x=months, y=cf_df["現金残高累計"],
        name="現金残高", mode="lines+markers",
        line=dict(color=COLORS["accent_green"], width=3),
        yaxis="y2",
    ))

    fig = _common_layout(fig, "キャッシュフロー推移")
    fig.update_layout(
        barmode="relative",
        yaxis=dict(title="CF金額", tickformat=",", ticksuffix="円"),
        yaxis2=dict(title="現金残高", overlaying="y", side="right", tickformat=",", ticksuffix="円"),
    )

    return fig


def create_loan_balance_chart(loan_balance: pd.DataFrame) -> go.Figure:
    """借入金残高推移チャート"""
    fig = go.Figure()

    months = _format_months_jp(loan_balance["year_month"])

    fig.add_trace(go.Bar(
        x=months, y=loan_balance["長期借入金_残高"],
        name="長期借入金", marker_color=COLORS["primary"],
    ))
    fig.add_trace(go.Bar(
        x=months, y=loan_balance["短期借入金_残高"],
        name="短期借入金", marker_color=COLORS["secondary"],
    ))
    fig.add_trace(go.Scatter(
        x=months, y=loan_balance["返済額"],
        name="月次返済額", mode="lines+markers",
        line=dict(color=COLORS["accent_red"], width=2),
        yaxis="y2",
    ))

    fig = _common_layout(fig, "借入金残高推移")
    fig.update_layout(
        barmode="stack",
        yaxis=dict(title="残高", tickformat=",", ticksuffix="円"),
        yaxis2=dict(title="返済額", overlaying="y", side="right", tickformat=",", ticksuffix="円"),
    )

    return fig


def create_payoff_simulation_chart(
    simulation_df: pd.DataFrame,
    simulation_extra_df: pd.DataFrame = None,
) -> go.Figure:
    """完済シミュレーションチャート"""
    fig = go.Figure()

    fig.add_trace(go.Scatter(
        x=simulation_df["月"], y=simulation_df["残高"],
        name="通常返済", mode="lines",
        line=dict(color=COLORS["primary"], width=2),
        fill="tozeroy",
        fillcolor="rgba(30, 58, 95, 0.1)",
    ))

    if simulation_extra_df is not None and not simulation_extra_df.empty:
        fig.add_trace(go.Scatter(
            x=simulation_extra_df["月"], y=simulation_extra_df["残高"],
            name="繰上返済あり", mode="lines",
            line=dict(color=COLORS["accent_green"], width=2, dash="dash"),
            fill="tozeroy",
            fillcolor="rgba(39, 174, 96, 0.1)",
        ))

    fig = _common_layout(fig, "完済シミュレーション")
    fig.update_xaxes(title="月数")
    fig = _format_axis_yen(fig)

    return fig


def create_breakeven_chart(breakeven_data: dict) -> go.Figure:
    """損益分岐点チャート"""
    sales = breakeven_data["売上高"]
    fixed = breakeven_data["固定費"]
    variable_ratio = breakeven_data["変動費率"] / 100
    bep = breakeven_data["損益分岐点売上高"]

    max_sales = sales * 1.3
    x_range = [0, max_sales]

    fig = go.Figure()

    # 売上高線
    fig.add_trace(go.Scatter(
        x=x_range, y=x_range,
        name="売上高", mode="lines",
        line=dict(color=COLORS["primary"], width=2),
    ))

    # 総費用線
    total_cost_at_0 = fixed
    total_cost_at_max = fixed + max_sales * variable_ratio
    fig.add_trace(go.Scatter(
        x=x_range, y=[total_cost_at_0, total_cost_at_max],
        name="総費用", mode="lines",
        line=dict(color=COLORS["accent_red"], width=2),
    ))

    # 固定費線
    fig.add_trace(go.Scatter(
        x=x_range, y=[fixed, fixed],
        name="固定費", mode="lines",
        line=dict(color=COLORS["accent_orange"], width=1, dash="dot"),
    ))

    # 損益分岐点
    fig.add_trace(go.Scatter(
        x=[bep], y=[bep],
        name=f"損益分岐点: {bep:,.0f}円",
        mode="markers+text",
        marker=dict(size=12, color=COLORS["accent_red"], symbol="star"),
        text=[f"損益分岐点: {bep:,.0f}円"],
        textposition="top right",
    ))

    # 現在の売上高
    fig.add_trace(go.Scatter(
        x=[sales], y=[sales],
        name=f"現在売上高: {sales:,.0f}円",
        mode="markers",
        marker=dict(size=10, color=COLORS["accent_green"], symbol="diamond"),
    ))

    fig = _common_layout(fig, "損益分岐点分析", height=500)
    fig.update_xaxes(title="売上高", tickformat=",", ticksuffix="円")
    fig.update_yaxes(title="金額", tickformat=",", ticksuffix="円")

    return fig
