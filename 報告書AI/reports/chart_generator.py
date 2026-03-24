"""グラフ生成モジュール - PDF埋め込み用のmatplotlibチャートを生成"""

import io
import math
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
from reportlab.lib.units import mm
from reportlab.platypus import Image

# 日本語フォント設定
_FONT_PATHS = [
    "fonts/ipaexg.ttf",
    "/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf",
    "/usr/share/fonts/opentype/ipafont-gothic/ipagp.ttf",
    "/usr/share/fonts/truetype/fonts-japanese-gothic.ttf",
]

_font_prop = None
for _fp in _FONT_PATHS:
    try:
        _font_prop = fm.FontProperties(fname=_fp)
        break
    except Exception:
        continue

if _font_prop:
    plt.rcParams["font.family"] = _font_prop.get_name()
    # フォントをmatplotlibに登録
    fm.fontManager.addfont(_font_prop.get_file())
else:
    plt.rcParams["font.family"] = ["WenQuanYi Zen Hei", "IPAGothic", "sans-serif"]

plt.rcParams["axes.unicode_minus"] = False


# カラーパレット
COLORS = {
    "売上高": "#2980B9",
    "売上総利益": "#27AE60",
    "営業利益": "#E67E22",
    "bar_palette": ["#3498DB", "#E74C3C", "#2ECC71", "#F39C12", "#9B59B6",
                     "#1ABC9C", "#E91E63", "#00BCD4", "#FF9800", "#795548"],
    "total_line": "#2C3E50",
    "ebitda_line": "#C0392B",
}


def _fig_to_image(fig, width_mm=250, height_mm=140):
    """matplotlibのfigureをReportLab Imageオブジェクトに変換"""
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=150, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    buf.seek(0)
    img = Image(buf, width=width_mm * mm, height=height_mm * mm)
    return img


def _format_axis_yen(ax, unit_label="千円"):
    """Y軸を千円表示にフォーマット"""
    ax.yaxis.set_major_formatter(
        plt.FuncFormatter(lambda x, _: f"{x:,.0f}")
    )
    ax.set_ylabel(f"（{unit_label}）", fontsize=8)


def _shorten_month(m):
    """'2024/04' → '4月' に短縮"""
    try:
        parts = m.replace("年", "/").replace("月", "").split("/")
        if len(parts) >= 2:
            return f"{int(parts[-1])}月"
    except (ValueError, IndexError):
        pass
    return m[:6]


def generate_pl_trend_chart(transition_data, months, unit=1000):
    """
    月次推移PLから売上高・売上総利益・営業利益の折れ線グラフを生成。

    Returns: ReportLab Image object
    """
    unit_label = {1: "円", 1000: "千円", 1000000: "百万円"}.get(unit, "千円")
    target_accounts = ["売上高", "売上総利益", "営業利益"]

    fig, ax = plt.subplots(figsize=(10, 4.5))
    short_months = [_shorten_month(m) for m in months]

    has_data = False
    for account in target_accounts:
        if account in transition_data:
            values = [
                (transition_data[account].get(m, 0) or 0) / unit
                for m in months
            ]
            if any(v != 0 for v in values):
                color = COLORS.get(account, "#333333")
                ax.plot(short_months, values, marker="o", linewidth=2,
                        markersize=5, label=account, color=color)
                # 値ラベル
                for i, v in enumerate(values):
                    if v != 0:
                        ax.annotate(f"{v:,.0f}", (short_months[i], v),
                                    textcoords="offset points", xytext=(0, 8),
                                    ha="center", fontsize=6, color=color)
                has_data = True

    if not has_data:
        plt.close(fig)
        return None

    ax.set_title("月次推移（売上高・売上総利益・営業利益）", fontsize=12, fontweight="bold")
    _format_axis_yen(ax, unit_label)
    ax.legend(loc="upper left", fontsize=8)
    ax.grid(axis="y", alpha=0.3)
    ax.tick_params(axis="x", rotation=0, labelsize=8)
    fig.tight_layout()

    return _fig_to_image(fig, width_mm=250, height_mm=120)


def generate_loan_balance_chart(loan_data, unit=1000):
    """
    借入契約ごとの残高推移（返済による減少）を棒グラフで表示。
    月ごとの残高を契約別にスタック棒グラフで表示。

    Returns: ReportLab Image object
    """
    contracts = loan_data.get("contracts", [])
    if not contracts:
        return None

    unit_label = {1: "円", 1000: "千円", 1000000: "百万円"}.get(unit, "千円")

    # 最大返済期間を決定（最長5年=60ヶ月まで、年次で表示）
    max_months = 0
    for c in contracts:
        rp = c.get("remaining_payments")
        if rp and rp > 0:
            max_months = max(max_months, rp)

    if max_months == 0:
        return None

    # 年次でプロット（最大10年）
    max_years = min(math.ceil(max_months / 12), 10)
    year_labels = ["現在"] + [f"{i}年後" for i in range(1, max_years + 1)]
    n_points = len(year_labels)

    # 各契約の年次残高を計算
    contract_balances = {}
    for c in contracts:
        name = c["name"]
        balance = c.get("remaining_balance", 0)
        monthly = c.get("monthly_payment", 0)
        rate = c.get("interest_rate", 0) / 100
        monthly_rate = rate / 12 if rate > 0 else 0

        balances = []
        current_balance = balance
        for year_idx in range(n_points):
            balances.append(max(current_balance / unit, 0))
            # 12ヶ月分返済を進める
            for _ in range(12):
                if current_balance <= 0:
                    break
                interest = current_balance * monthly_rate
                principal = monthly - interest
                if principal <= 0:
                    principal = monthly
                current_balance -= principal
                if current_balance < 0:
                    current_balance = 0

        contract_balances[name] = balances

    fig, ax = plt.subplots(figsize=(10, 4.5))
    x = range(n_points)
    bottom = [0] * n_points

    for i, (name, balances) in enumerate(contract_balances.items()):
        color = COLORS["bar_palette"][i % len(COLORS["bar_palette"])]
        ax.bar(x, balances, bottom=bottom, label=name, color=color, alpha=0.85, width=0.6)
        bottom = [b + v for b, v in zip(bottom, balances)]

    ax.set_title("借入金残高推移（契約別）", fontsize=12, fontweight="bold")
    ax.set_xticks(x)
    ax.set_xticklabels(year_labels, fontsize=8)
    _format_axis_yen(ax, unit_label)
    ax.legend(loc="upper right", fontsize=7)
    ax.grid(axis="y", alpha=0.3)
    fig.tight_layout()

    return _fig_to_image(fig, width_mm=250, height_mm=120)


def generate_debt_vs_ebitda_chart(loan_data, ebitda_data, unit=1000):
    """
    借入契約別残高（積み上げ棒グラフ）+ 借入総額（折れ線）+ EBITDA年額（水平線）
    の比較チャートを生成。

    Returns: ReportLab Image object
    """
    contracts = loan_data.get("contracts", [])
    if not contracts:
        return None

    ebitda_annual = ebitda_data.get("ebitda", 0)
    unit_label = {1: "円", 1000: "千円", 1000000: "百万円"}.get(unit, "千円")

    # 年次残高を計算
    max_months = 0
    for c in contracts:
        rp = c.get("remaining_payments")
        if rp and rp > 0:
            max_months = max(max_months, rp)

    if max_months == 0:
        return None

    max_years = min(math.ceil(max_months / 12), 10)
    year_labels = ["現在"] + [f"{i}年後" for i in range(1, max_years + 1)]
    n_points = len(year_labels)

    # 各契約の年次残高
    contract_balances = {}
    for c in contracts:
        name = c["name"]
        balance = c.get("remaining_balance", 0)
        monthly = c.get("monthly_payment", 0)
        rate = c.get("interest_rate", 0) / 100
        monthly_rate = rate / 12 if rate > 0 else 0

        balances = []
        current_balance = balance
        for year_idx in range(n_points):
            balances.append(max(current_balance / unit, 0))
            for _ in range(12):
                if current_balance <= 0:
                    break
                interest = current_balance * monthly_rate
                principal = monthly - interest
                if principal <= 0:
                    principal = monthly
                current_balance -= principal
                if current_balance < 0:
                    current_balance = 0

        contract_balances[name] = balances

    # 総額の折れ線データ
    totals = [0] * n_points
    for balances in contract_balances.values():
        totals = [t + b for t, b in zip(totals, balances)]

    fig, ax = plt.subplots(figsize=(10, 5))
    x = range(n_points)
    bottom = [0] * n_points

    # 契約別積み上げ棒グラフ
    for i, (name, balances) in enumerate(contract_balances.items()):
        color = COLORS["bar_palette"][i % len(COLORS["bar_palette"])]
        ax.bar(x, balances, bottom=bottom, label=name, color=color, alpha=0.8, width=0.6)
        bottom = [b + v for b, v in zip(bottom, balances)]

    # 借入総額の折れ線
    ax.plot(x, totals, marker="s", linewidth=2.5, color=COLORS["total_line"],
            label="借入総額", zorder=5)

    # EBITDA水平線（年額ベース）
    ebitda_val = ebitda_annual / unit
    if ebitda_val > 0:
        ax.axhline(y=ebitda_val, color=COLORS["ebitda_line"], linewidth=2,
                    linestyle="--", label=f"EBITDA（年額: {ebitda_val:,.0f}）", zorder=4)

        # 債務償還年数を注記
        if totals[0] > 0 and ebitda_val > 0:
            repayment_years = totals[0] / ebitda_val
            ax.annotate(
                f"債務償還年数: {repayment_years:.1f}年",
                xy=(0, totals[0]), xytext=(1.5, totals[0] * 0.95),
                fontsize=9, fontweight="bold", color=COLORS["ebitda_line"],
                arrowprops=dict(arrowstyle="->", color=COLORS["ebitda_line"], lw=1.5),
            )

    ax.set_title("借入金残高 vs EBITDA（正常収益力との比較）", fontsize=12, fontweight="bold")
    ax.set_xticks(x)
    ax.set_xticklabels(year_labels, fontsize=8)
    _format_axis_yen(ax, unit_label)
    ax.legend(loc="upper right", fontsize=7)
    ax.grid(axis="y", alpha=0.3)
    fig.tight_layout()

    return _fig_to_image(fig, width_mm=250, height_mm=130)
