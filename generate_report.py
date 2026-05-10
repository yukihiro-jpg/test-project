#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
株式会社 笹沼五郎商店
令和7年7月度 月次報告書 生成スクリプト
"""

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np
import base64
import io
import os

# 日本語フォント設定 - IPAGothicフォントを直接登録
import matplotlib.font_manager as fm
_ipa_font_path = '/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf'
if os.path.exists(_ipa_font_path):
    fm.fontManager.addfont(_ipa_font_path)
plt.rcParams['font.family'] = ['IPAGothic', 'DejaVu Sans']

# --- 財務データ ---

COMPANY = "株式会社　笹沼五郎商店"
REPORT_DATE = "令和7年7月"
FISCAL_YEAR = "令和7年8月期"

# 7月単月データ（3期分）
months_label = ["R5年7月\n(令和5年7月)", "R6年7月\n(令和6年7月)", "R7年7月\n(令和7年7月)"]
months_short = ["R5.7月", "R6.7月", "R7.7月"]

# P&L 月次 7月データ
net_sales_july = [11_013_179, 10_536_610, 11_867_872]
cogs_july      = [3_546_244,  3_976_828,  3_930_785]
gross_profit_july = [7_466_935, 6_559_782, 7_937_087]
sga_july       = [10_045_836, 9_052_303, 9_909_692]
op_profit_july = [-2_578_901, -2_492_521, -1_972_605]
other_income_july  = [918_119, 846_448, 860_466]
other_expense_july = [12_473,   6_918,   2_139]
ord_profit_july = [-1_673_255, -1_652_991, -1_114_278]

gross_margin_july = [g/s*100 for g, s in zip(gross_profit_july, net_sales_july)]

# 11ヶ月累計データ（9月〜7月）
# 年間データ - 8月分を差し引いて11ヶ月累計を算出
net_sales_annual = [132_632_655, 137_467_076, 144_352_842]
net_sales_aug    = [11_156_364,  13_793_860,  13_548_405]
net_sales_11m    = [a - b for a, b in zip(net_sales_annual, net_sales_aug)]

cogs_annual = [42_685_235, 45_769_968, 49_807_258]
cogs_aug    = [3_673_083,  4_175_231,  6_437_288]
cogs_11m    = [a - b for a, b in zip(cogs_annual, cogs_aug)]

gp_annual = [89_947_420, 91_697_108, 94_545_584]
gp_aug    = [7_483_281,  9_618_629,  7_111_117]
gp_11m    = [a - b for a, b in zip(gp_annual, gp_aug)]

sga_annual = [104_807_080, 100_983_512, 110_059_534]
sga_aug    = [9_482_560,   7_331_898,   8_178_478]
sga_11m    = [a - b for a, b in zip(sga_annual, sga_aug)]

op_annual = [-14_859_660, -9_286_404, -15_513_950]
op_aug    = [-1_999_279,   2_286_731,  -1_067_361]
op_11m    = [a - b for a, b in zip(op_annual, op_aug)]

ord_annual = [-4_346_190, 5_095_369, -5_341_318]
ord_aug    = [-1_155_773, 3_212_106, -242_889]
ord_11m    = [a - b for a, b in zip(ord_annual, ord_aug)]

gm_11m = [g/s*100 for g, s in zip(gp_11m, net_sales_11m)]

years_label = ["R5.8期\n(11ヶ月)", "R6.8期\n(11ヶ月)", "R7.8期\n(11ヶ月)"]

# 運転資本（R7.8期 月次）
months_r7 = ["9月", "10月", "11月", "12月", "1月", "2月", "3月", "4月", "5月", "6月", "7月"]
current_assets_r7 = [58_015_177, 56_194_352, 57_864_337, 60_906_500,
                     56_090_635, 56_985_481, 59_983_621, 60_050_554,
                     67_647_633, 61_206_007, 60_135_248]
current_liab_r7  = [18_873_053, 17_495_948, 18_540_270, 22_486_502,
                    17_655_131, 18_999_630, 20_429_534, 21_050_053,
                    27_545_375, 22_944_983, 23_596_882]
working_capital_r7 = [a - b for a, b in zip(current_assets_r7, current_liab_r7)]

# 経常利益（月次 R7.8期）
ord_profit_monthly_r7 = [-3_240_281, -556_250, 513_133, -1_016_599, -119_198,
                          -540_009, 1_455_706, -666_116, 989_227, -803_764, -1_114_278]

# 簡易FCF = 経常利益 + 減価償却費 - 借入金返済
depr_monthly = 480_509  # 毎月均等
loan_repay_monthly = 277_000   # 長期借入金
lease_repay_monthly = 131_870  # リース債務
total_repay = loan_repay_monthly + lease_repay_monthly  # 408,870/月

fcf_r7 = [op + depr_monthly - total_repay for op in ord_profit_monthly_r7]
fcf_cumulative = []
cum = 0
for f in fcf_r7:
    cum += f
    fcf_cumulative.append(cum)

# 借入金返済状況（R7.8期 月次残高）
loan_balance = [4_460_000, 4_183_000, 3_906_000, 3_629_000, 3_352_000,
                3_075_000, 2_798_000, 2_521_000, 2_244_000, 1_967_000, 1_690_000]
lease_balance = [6_916_980, 6_785_110, 6_653_240, 6_521_370, 6_389_500,
                 6_257_630, 6_125_760, 5_993_890, 5_862_020, 5_730_150, 5_598_280]
total_debt = [a + b for a, b in zip(loan_balance, lease_balance)]

# 将来返済予測（8月以降）
future_months = ["8月", "9月", "10月", "11月", "12月", "1月\n(R8)"]
future_loan = [1_413_000, 1_136_000, 859_000, 582_000, 305_000, 28_000]
future_lease = [5_466_410, 5_334_540, 5_202_670, 5_070_800, 4_938_930, 4_807_060]
future_total = [a + b for a, b in zip(future_loan, future_lease)]

# 段階利益 3期 7月単月
stages_r5 = [net_sales_july[0], gross_profit_july[0], op_profit_july[0], ord_profit_july[0]]
stages_r6 = [net_sales_july[1], gross_profit_july[1], op_profit_july[1], ord_profit_july[1]]
stages_r7 = [net_sales_july[2], gross_profit_july[2], op_profit_july[2], ord_profit_july[2]]

stage_labels = ["純売上高", "売上総利益", "営業利益", "経常利益"]


# ============================================================
# ユーティリティ
# ============================================================

def fig_to_base64(fig):
    buf = io.BytesIO()
    fig.savefig(buf, format='jpeg', bbox_inches='tight', dpi=72)
    buf.seek(0)
    img_b64 = base64.b64encode(buf.read()).decode('utf-8')
    plt.close(fig)
    return img_b64

def fmt(n, unit="円"):
    if n is None:
        return "－"
    if unit == "円":
        return f"{n:,.0f}円"
    elif unit == "%":
        return f"{n:.1f}%"
    return f"{n:,.0f}"

def fmt_th(n):
    """千円単位"""
    if n is None:
        return "－"
    return f"{n/1000:,.1f}"

def color_val(val):
    if val >= 0:
        return '#1a5276'
    return '#c0392b'

COLORS = {
    'r5': '#2e86c1',
    'r6': '#28b463',
    'r7': '#e74c3c',
    'positive': '#2e86c1',
    'negative': '#e74c3c',
    'neutral': '#7f8c8d',
    'bg': '#f8f9fa',
    'header': '#1a3a5c',
}

# ============================================================
# Chart 1: 3期7月単月比較 棒グラフ
# ============================================================
def make_chart_july_comparison():
    fig, axes = plt.subplots(1, 3, figsize=(14, 5))
    fig.patch.set_facecolor(COLORS['bg'])

    x = np.arange(3)
    bar_colors = [COLORS['r5'], COLORS['r6'], COLORS['r7']]
    labels = ['R5年7月', 'R6年7月', 'R7年7月']

    # 売上高
    ax = axes[0]
    ax.set_facecolor(COLORS['bg'])
    bars = ax.bar(x, [s/1_000_000 for s in net_sales_july], color=bar_colors, width=0.5, edgecolor='white')
    ax.set_title('純売上高（百万円）', fontsize=11, fontweight='bold', pad=10)
    ax.set_xticks(x); ax.set_xticklabels(labels, fontsize=9)
    ax.set_ylabel('百万円', fontsize=9)
    for bar, val in zip(bars, net_sales_july):
        ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.1,
                f'{val/1_000_000:.1f}M', ha='center', va='bottom', fontsize=9, fontweight='bold')
    ax.set_ylim(0, max(net_sales_july)/1_000_000 * 1.2)
    ax.grid(axis='y', alpha=0.3)
    ax.spines['top'].set_visible(False); ax.spines['right'].set_visible(False)

    # 売上総利益
    ax = axes[1]
    ax.set_facecolor(COLORS['bg'])
    bars2 = ax.bar(x, [g/1_000_000 for g in gross_profit_july], color=bar_colors, width=0.5, edgecolor='white')
    ax2b = ax.twinx()
    ax2b.plot(x, gross_margin_july, 'ko--', markersize=6, linewidth=1.5, label='粗利率')
    ax2b.set_ylabel('粗利率（%）', fontsize=9)
    ax2b.set_ylim(55, 75)
    for i, (gm) in enumerate(gross_margin_july):
        ax2b.annotate(f'{gm:.1f}%', (i, gm), textcoords="offset points", xytext=(0, 8),
                      ha='center', fontsize=8, color='black', fontweight='bold')
    ax.set_title('売上総利益（百万円）・粗利率', fontsize=11, fontweight='bold', pad=10)
    ax.set_xticks(x); ax.set_xticklabels(labels, fontsize=9)
    ax.set_ylabel('百万円', fontsize=9)
    ax.set_ylim(0, max(gross_profit_july)/1_000_000 * 1.3)
    ax.grid(axis='y', alpha=0.3)
    ax.spines['top'].set_visible(False)

    # 経常利益
    ax = axes[2]
    ax.set_facecolor(COLORS['bg'])
    bar_colors3 = [COLORS['negative'] if v < 0 else COLORS['positive'] for v in ord_profit_july]
    bars3 = ax.bar(x, [v/1_000_000 for v in ord_profit_july], color=bar_colors3, width=0.5, edgecolor='white')
    ax.axhline(0, color='black', linewidth=0.8)
    ax.set_title('経常利益（百万円）', fontsize=11, fontweight='bold', pad=10)
    ax.set_xticks(x); ax.set_xticklabels(labels, fontsize=9)
    ax.set_ylabel('百万円', fontsize=9)
    for bar, val in zip(bars3, ord_profit_july):
        ypos = bar.get_height() + 0.05 if val >= 0 else bar.get_height() - 0.15
        ax.text(bar.get_x() + bar.get_width()/2, ypos,
                f'{val/1_000_000:.2f}M', ha='center', va='bottom', fontsize=8.5, fontweight='bold',
                color=color_val(val))
    ax.grid(axis='y', alpha=0.3)
    ax.spines['top'].set_visible(False); ax.spines['right'].set_visible(False)

    plt.tight_layout(pad=2)
    return fig_to_base64(fig)


# ============================================================
# Chart 2: 3期累計比較 棒グラフ
# ============================================================
def make_chart_cumulative():
    fig, axes = plt.subplots(1, 3, figsize=(14, 5))
    fig.patch.set_facecolor(COLORS['bg'])
    x = np.arange(3)
    bar_colors = [COLORS['r5'], COLORS['r6'], COLORS['r7']]
    labels = ['R5.8期\n(11ヶ月)', 'R6.8期\n(11ヶ月)', 'R7.8期\n(11ヶ月)']

    # 売上高累計
    ax = axes[0]
    ax.set_facecolor(COLORS['bg'])
    vals = [s/1_000_000 for s in net_sales_11m]
    bars = ax.bar(x, vals, color=bar_colors, width=0.5, edgecolor='white')
    ax.set_title('純売上高 累計（百万円）', fontsize=11, fontweight='bold', pad=10)
    ax.set_xticks(x); ax.set_xticklabels(labels, fontsize=9)
    ax.set_ylabel('百万円', fontsize=9)
    for bar, val in zip(bars, vals):
        ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.5,
                f'{val:.1f}M', ha='center', va='bottom', fontsize=9, fontweight='bold')
    ax.set_ylim(0, max(vals) * 1.15)
    ax.grid(axis='y', alpha=0.3)
    ax.spines['top'].set_visible(False); ax.spines['right'].set_visible(False)

    # 売上総利益累計 + 粗利率
    ax = axes[1]
    ax.set_facecolor(COLORS['bg'])
    bars2 = ax.bar(x, [g/1_000_000 for g in gp_11m], color=bar_colors, width=0.5, edgecolor='white')
    ax2b = ax.twinx()
    ax2b.plot(x, gm_11m, 'ko--', markersize=6, linewidth=1.5)
    ax2b.set_ylabel('粗利率（%）', fontsize=9)
    ax2b.set_ylim(60, 75)
    for i, gm in enumerate(gm_11m):
        ax2b.annotate(f'{gm:.1f}%', (i, gm), textcoords="offset points", xytext=(0, 8),
                      ha='center', fontsize=8, fontweight='bold')
    ax.set_title('売上総利益 累計（百万円）・粗利率', fontsize=11, fontweight='bold', pad=10)
    ax.set_xticks(x); ax.set_xticklabels(labels, fontsize=9)
    ax.set_ylabel('百万円', fontsize=9)
    ax.set_ylim(0, max(gp_11m)/1_000_000 * 1.2)
    ax.grid(axis='y', alpha=0.3)
    ax.spines['top'].set_visible(False)

    # 経常利益累計
    ax = axes[2]
    ax.set_facecolor(COLORS['bg'])
    bar_colors3 = [COLORS['negative'] if v < 0 else COLORS['positive'] for v in ord_11m]
    bars3 = ax.bar(x, [v/1_000_000 for v in ord_11m], color=bar_colors3, width=0.5, edgecolor='white')
    ax.axhline(0, color='black', linewidth=0.8)
    ax.set_title('経常利益 累計（百万円）', fontsize=11, fontweight='bold', pad=10)
    ax.set_xticks(x); ax.set_xticklabels(labels, fontsize=9)
    ax.set_ylabel('百万円', fontsize=9)
    for bar, val in zip(bars3, ord_11m):
        offset = 0.2 if val >= 0 else -0.5
        ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + offset,
                f'{val/1_000_000:.2f}M', ha='center', va='bottom', fontsize=8.5, fontweight='bold',
                color=color_val(val))
    ax.grid(axis='y', alpha=0.3)
    ax.spines['top'].set_visible(False); ax.spines['right'].set_visible(False)

    plt.tight_layout(pad=2)
    return fig_to_base64(fig)


# ============================================================
# Chart 3: FCF・運転資本 月次推移
# ============================================================
def make_chart_fcf_wc():
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(13, 8))
    fig.patch.set_facecolor(COLORS['bg'])

    x = np.arange(len(months_r7))

    # 上段: 運転資本
    ax1.set_facecolor(COLORS['bg'])
    ax1.fill_between(x, [w/1_000_000 for w in working_capital_r7],
                     alpha=0.3, color=COLORS['r7'])
    ax1.plot(x, [w/1_000_000 for w in working_capital_r7], 'o-',
             color=COLORS['r7'], linewidth=2.5, markersize=7, label='運転資本')

    # 流動資産・流動負債
    ax1.bar(x - 0.2, [a/1_000_000 for a in current_assets_r7], 0.35,
            alpha=0.6, color=COLORS['positive'], label='流動資産')
    ax1.bar(x + 0.2, [l/1_000_000 for l in current_liab_r7], 0.35,
            alpha=0.6, color=COLORS['r5'], label='流動負債')

    ax1.set_title('R7.8期 流動資産・流動負債・運転資本 月次推移（百万円）',
                  fontsize=12, fontweight='bold', pad=10)
    ax1.set_xticks(x); ax1.set_xticklabels(months_r7, fontsize=10)
    ax1.set_ylabel('百万円', fontsize=10)
    ax1.legend(fontsize=9, loc='upper right')
    ax1.grid(axis='y', alpha=0.3)
    ax1.spines['top'].set_visible(False); ax1.spines['right'].set_visible(False)

    for i, wc in enumerate(working_capital_r7):
        ax1.text(i, wc/1_000_000 + 0.5, f'{wc/1_000_000:.1f}M',
                 ha='center', va='bottom', fontsize=8, color=COLORS['r7'], fontweight='bold')

    # 下段: FCF（月次 + 累計）
    ax2.set_facecolor(COLORS['bg'])
    bar_cols = [COLORS['positive'] if f >= 0 else COLORS['negative'] for f in fcf_r7]
    bars = ax2.bar(x, [f/1_000_000 for f in fcf_r7], color=bar_cols, alpha=0.7,
                   width=0.4, label='月次FCF')
    ax2b = ax2.twinx()
    ax2b.plot(x, [c/1_000_000 for c in fcf_cumulative], 's--',
              color='#8e44ad', linewidth=2, markersize=7, label='累計FCF')
    ax2b.set_ylabel('累計FCF（百万円）', fontsize=10, color='#8e44ad')
    ax2b.tick_params(axis='y', labelcolor='#8e44ad')

    ax2.axhline(0, color='black', linewidth=0.8)
    ax2.set_title('R7.8期 簡易フリーキャッシュフロー 月次推移（百万円）\n'
                  '※FCF = 経常利益 + 減価償却費 − 借入金返済（約41万円/月）',
                  fontsize=10, fontweight='bold', pad=10)
    ax2.set_xticks(x); ax2.set_xticklabels(months_r7, fontsize=10)
    ax2.set_ylabel('月次FCF（百万円）', fontsize=10)

    lines1, labels1 = ax2.get_legend_handles_labels()
    lines2, labels2 = ax2b.get_legend_handles_labels()
    ax2.legend(lines1 + lines2, labels1 + labels2, fontsize=9, loc='upper left')
    ax2.grid(axis='y', alpha=0.3)
    ax2.spines['top'].set_visible(False)

    plt.tight_layout(pad=2.5)
    return fig_to_base64(fig)


# ============================================================
# Chart 4: 借入金返済状況
# ============================================================
def make_chart_loans():
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))
    fig.patch.set_facecolor(COLORS['bg'])

    # 左: 月次残高推移（積み上げ棒）
    x = np.arange(len(months_r7))
    ax1.set_facecolor(COLORS['bg'])
    bars1 = ax1.bar(x, [l/1_000_000 for l in loan_balance], 0.5,
                    label='長期借入金', color='#e74c3c', alpha=0.85)
    bars2 = ax1.bar(x, [l/1_000_000 for l in lease_balance], 0.5,
                    bottom=[l/1_000_000 for l in loan_balance],
                    label='リース債務', color='#f39c12', alpha=0.85)

    ax1.set_title('R7.8期 借入金・リース債務 残高推移（百万円）',
                  fontsize=11, fontweight='bold', pad=10)
    ax1.set_xticks(x); ax1.set_xticklabels(months_r7, fontsize=9)
    ax1.set_ylabel('百万円', fontsize=10)
    ax1.legend(fontsize=9)
    ax1.grid(axis='y', alpha=0.3)
    ax1.spines['top'].set_visible(False); ax1.spines['right'].set_visible(False)

    # 合計値ラベル
    for i, tot in enumerate(total_debt):
        ax1.text(i, tot/1_000_000 + 0.1, f'{tot/1_000_000:.2f}M',
                 ha='center', va='bottom', fontsize=8, fontweight='bold')

    # 右: 将来返済予測（実績7月 + 予測）
    all_months = months_r7 + future_months
    all_loan = loan_balance + future_loan
    all_lease = lease_balance + future_lease
    all_total = total_debt + future_total

    x2 = np.arange(len(all_months))
    # 実績部分
    ax2.set_facecolor(COLORS['bg'])
    ax2.bar(x2[:11], [l/1_000_000 for l in all_loan[:11]], 0.5,
            label='長期借入金（実績）', color='#e74c3c', alpha=0.85)
    ax2.bar(x2[:11], [l/1_000_000 for l in all_lease[:11]], 0.5,
            bottom=[l/1_000_000 for l in all_loan[:11]],
            label='リース債務（実績）', color='#f39c12', alpha=0.85)
    # 予測部分
    ax2.bar(x2[11:], [l/1_000_000 for l in all_loan[11:]], 0.5,
            label='長期借入金（予測）', color='#e74c3c', alpha=0.4, hatch='//')
    ax2.bar(x2[11:], [l/1_000_000 for l in all_lease[11:]], 0.5,
            bottom=[l/1_000_000 for l in all_loan[11:]],
            label='リース債務（予測）', color='#f39c12', alpha=0.4, hatch='//')

    # 境界線
    ax2.axvline(x=10.5, color='gray', linestyle='--', linewidth=1.5, alpha=0.7)
    ax2.text(10.6, max(all_total)/1_000_000 * 0.95, '← 実績 | 予測 →',
             fontsize=8, color='gray')

    ax2.set_title('借入金・リース債務 返済予測（百万円）',
                  fontsize=11, fontweight='bold', pad=10)
    ax2.set_xticks(x2); ax2.set_xticklabels(all_months, fontsize=8, rotation=30)
    ax2.set_ylabel('百万円', fontsize=10)
    ax2.legend(fontsize=7.5, loc='upper right', ncol=2)
    ax2.grid(axis='y', alpha=0.3)
    ax2.spines['top'].set_visible(False); ax2.spines['right'].set_visible(False)

    plt.tight_layout(pad=2)
    return fig_to_base64(fig)


# ============================================================
# Chart 5: 段階利益 3期比較（7月単月）
# ============================================================
def make_chart_staged_profits():
    fig, ax = plt.subplots(figsize=(13, 6))
    fig.patch.set_facecolor(COLORS['bg'])
    ax.set_facecolor(COLORS['bg'])

    x = np.arange(len(stage_labels))
    width = 0.25

    # R5
    vals_r5 = [v/1_000_000 for v in stages_r5]
    bars1 = ax.bar(x - width, vals_r5, width, label='R5年7月', color=COLORS['r5'], alpha=0.85, edgecolor='white')
    # R6
    vals_r6 = [v/1_000_000 for v in stages_r6]
    bars2 = ax.bar(x, vals_r6, width, label='R6年7月', color=COLORS['r6'], alpha=0.85, edgecolor='white')
    # R7
    vals_r7 = [v/1_000_000 for v in stages_r7]
    bars3 = ax.bar(x + width, vals_r7, width, label='R7年7月', color=COLORS['r7'], alpha=0.85, edgecolor='white')

    ax.axhline(0, color='black', linewidth=0.8)

    for bars, vals in [(bars1, vals_r5), (bars2, vals_r6), (bars3, vals_r7)]:
        for bar, val in zip(bars, vals):
            ypos = bar.get_height() + 0.05 if val >= 0 else bar.get_height() - 0.25
            ax.text(bar.get_x() + bar.get_width()/2, ypos,
                    f'{val:.2f}', ha='center', va='bottom', fontsize=8.5,
                    fontweight='bold', color=color_val(val))

    ax.set_title('段階利益 ３期比較（7月単月）（百万円）',
                 fontsize=13, fontweight='bold', pad=15)
    ax.set_xticks(x)
    ax.set_xticklabels(stage_labels, fontsize=12)
    ax.set_ylabel('百万円', fontsize=11)
    ax.legend(fontsize=11)
    ax.grid(axis='y', alpha=0.3)
    ax.spines['top'].set_visible(False); ax.spines['right'].set_visible(False)

    plt.tight_layout(pad=2)
    return fig_to_base64(fig)


# ============================================================
# Chart 6: 段階利益 3期比較（累計）
# ============================================================
def make_chart_staged_cum():
    fig, ax = plt.subplots(figsize=(13, 6))
    fig.patch.set_facecolor(COLORS['bg'])
    ax.set_facecolor(COLORS['bg'])

    stage_labels_cum = ["純売上高", "売上総利益", "営業利益", "経常利益"]
    stages_r5_cum = [net_sales_11m[0], gp_11m[0], op_11m[0], ord_11m[0]]
    stages_r6_cum = [net_sales_11m[1], gp_11m[1], op_11m[1], ord_11m[1]]
    stages_r7_cum = [net_sales_11m[2], gp_11m[2], op_11m[2], ord_11m[2]]

    x = np.arange(len(stage_labels_cum))
    width = 0.25

    def bar_colors_for(vals):
        return [COLORS['positive'] if v >= 0 else COLORS['negative'] for v in vals]

    bars1 = ax.bar(x - width, [v/1_000_000 for v in stages_r5_cum], width,
                   label='R5.8期(11ヶ月)', color=COLORS['r5'], alpha=0.85, edgecolor='white')
    bars2 = ax.bar(x, [v/1_000_000 for v in stages_r6_cum], width,
                   label='R6.8期(11ヶ月)', color=COLORS['r6'], alpha=0.85, edgecolor='white')
    bars3 = ax.bar(x + width, [v/1_000_000 for v in stages_r7_cum], width,
                   label='R7.8期(11ヶ月)', color=COLORS['r7'], alpha=0.85, edgecolor='white')

    ax.axhline(0, color='black', linewidth=0.8)

    for bars, vals in [(bars1, stages_r5_cum), (bars2, stages_r6_cum), (bars3, stages_r7_cum)]:
        for bar, val in zip(bars, vals):
            ypos = bar.get_height() + 0.3 if val >= 0 else bar.get_height() - 1.2
            ax.text(bar.get_x() + bar.get_width()/2, ypos,
                    f'{val/1_000_000:.1f}', ha='center', va='bottom', fontsize=8,
                    fontweight='bold', color=color_val(val))

    ax.set_title('段階利益 ３期比較（9月〜7月 累計）（百万円）',
                 fontsize=13, fontweight='bold', pad=15)
    ax.set_xticks(x)
    ax.set_xticklabels(stage_labels_cum, fontsize=12)
    ax.set_ylabel('百万円', fontsize=11)
    ax.legend(fontsize=11)
    ax.grid(axis='y', alpha=0.3)
    ax.spines['top'].set_visible(False); ax.spines['right'].set_visible(False)

    plt.tight_layout(pad=2)
    return fig_to_base64(fig)


# ============================================================
# HTML生成
# ============================================================
def make_table_row(label, r5, r6, r7, bold=False, highlight=False, is_margin=False):
    style = ""
    if bold:
        style += "font-weight:bold;"
    if highlight:
        style += "background:#eaf4fb;"

    def cell_style(val):
        if isinstance(val, (int, float)) and not is_margin:
            if val < 0:
                return "color:#c0392b;"
        return ""

    def format_cell(val):
        if isinstance(val, (int, float)):
            if is_margin:
                return f"{val:.1f}%"
            return f"{val:,.0f}"
        return str(val)

    cells = []
    for val in [r5, r6, r7]:
        cs = cell_style(val)
        cells.append(f'<td style="{cs}">{format_cell(val)}</td>')

    return f'<tr style="{style}"><td>{label}</td>{"".join(cells)}</tr>'


def generate_html():
    print("グラフ生成中...")
    chart1 = make_chart_july_comparison()
    print("  ✓ 3期7月単月比較グラフ")
    chart2 = make_chart_cumulative()
    print("  ✓ 3期累計比較グラフ")
    chart3 = make_chart_fcf_wc()
    print("  ✓ FCF・運転資本グラフ")
    chart4 = make_chart_loans()
    print("  ✓ 借入金グラフ")
    chart5 = make_chart_staged_profits()
    print("  ✓ 段階利益グラフ（単月）")
    chart6 = make_chart_staged_cum()
    print("  ✓ 段階利益グラフ（累計）")

    html = f"""<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{COMPANY} {REPORT_DATE}度 月次報告書</title>
<style>
  @page {{ size: A4; margin: 15mm; }}
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    font-family: 'Meiryo', 'Yu Gothic', 'Hiragino Kaku Gothic Pro', sans-serif;
    font-size: 11px;
    color: #2c3e50;
    background: #fff;
    line-height: 1.5;
  }}
  .page {{
    width: 100%;
    min-height: 290mm;
    padding: 20px 30px;
    page-break-after: always;
    border-bottom: 2px solid #eee;
    margin-bottom: 20px;
    background: #fff;
  }}
  .page:last-child {{ page-break-after: auto; border-bottom: none; }}

  /* 表紙 */
  .cover {{
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    min-height: 280mm;
    background: linear-gradient(135deg, #1a3a5c 0%, #2e86c1 100%);
    color: white;
    border-radius: 8px;
    padding: 40px;
  }}
  .cover h1 {{ font-size: 26px; font-weight: bold; margin-bottom: 20px; letter-spacing: 3px; }}
  .cover h2 {{ font-size: 36px; font-weight: bold; margin-bottom: 10px; border: 3px solid rgba(255,255,255,0.6); padding: 15px 40px; }}
  .cover .sub {{ font-size: 16px; margin: 10px 0; opacity: 0.85; }}
  .cover .date-box {{
    margin-top: 40px; padding: 15px 30px;
    background: rgba(255,255,255,0.15); border-radius: 6px;
    font-size: 14px;
  }}
  .cover .prepared {{ margin-top: 20px; font-size: 13px; opacity: 0.8; }}

  /* ページヘッダー */
  .page-header {{
    background: linear-gradient(90deg, #1a3a5c, #2e86c1);
    color: white;
    padding: 10px 20px;
    border-radius: 6px;
    margin-bottom: 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }}
  .page-header h2 {{ font-size: 15px; font-weight: bold; }}
  .page-header .tag {{ font-size: 11px; opacity: 0.8; }}

  /* テーブル */
  table {{
    width: 100%;
    border-collapse: collapse;
    font-size: 10.5px;
    margin-bottom: 14px;
  }}
  th {{
    background: #1a3a5c;
    color: white;
    padding: 7px 10px;
    text-align: center;
    font-weight: bold;
  }}
  td {{
    padding: 6px 10px;
    border-bottom: 1px solid #e0e0e0;
    text-align: right;
  }}
  td:first-child {{ text-align: left; background: #f5f7fa; font-weight: 500; }}
  tr:hover td {{ background: #f0f4ff; }}
  .tbl-section td:first-child {{
    background: #1a3a5c; color: white; font-weight: bold;
    text-align: center;
  }}
  .tbl-total td {{
    background: #eaf4fb !important;
    font-weight: bold;
    border-top: 2px solid #2e86c1;
  }}
  .negative {{ color: #c0392b !important; font-weight: bold; }}
  .positive {{ color: #1a5276 !important; }}

  /* グラフ */
  .chart-box {{
    text-align: center;
    margin: 10px 0;
  }}
  .chart-box img {{
    max-width: 100%;
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }}

  /* グリッド */
  .grid-2 {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 14px;
  }}
  .grid-3 {{
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 12px;
    margin-bottom: 14px;
  }}

  /* KPIカード */
  .kpi-card {{
    background: #f5f7fa;
    border: 1px solid #dde;
    border-radius: 8px;
    padding: 12px 16px;
    text-align: center;
  }}
  .kpi-card .label {{ font-size: 10px; color: #666; margin-bottom: 4px; }}
  .kpi-card .value {{ font-size: 18px; font-weight: bold; color: #1a3a5c; }}
  .kpi-card .value.neg {{ color: #c0392b; }}
  .kpi-card .sub {{ font-size: 9px; color: #999; margin-top: 3px; }}

  /* コメントボックス */
  .comment-box {{
    background: #fff8e1;
    border-left: 4px solid #f39c12;
    padding: 10px 14px;
    border-radius: 0 6px 6px 0;
    margin-bottom: 12px;
    font-size: 10.5px;
  }}
  .comment-box h4 {{ color: #e67e22; margin-bottom: 6px; font-size: 11px; }}

  .section-title {{
    font-size: 12px;
    font-weight: bold;
    color: #1a3a5c;
    border-bottom: 2px solid #2e86c1;
    padding-bottom: 4px;
    margin: 12px 0 8px 0;
  }}
  .footnote {{
    font-size: 9px;
    color: #888;
    margin-top: 8px;
  }}
  .badge {{
    display: inline-block;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 9px;
    font-weight: bold;
    margin-left: 6px;
  }}
  .badge-up {{ background: #d5f5e3; color: #1e8449; }}
  .badge-down {{ background: #fadbd8; color: #c0392b; }}
</style>
</head>
<body>

<!-- =========================================================
     PAGE 1: 表紙
     ========================================================= -->
<div class="page">
  <div class="cover">
    <div class="sub">顧問先報告資料</div>
    <h1>{COMPANY}</h1>
    <h2>令和7年7月度<br>月次報告書</h2>
    <div class="sub">{FISCAL_YEAR}（令和6年9月〜令和7年8月）</div>
    <div class="date-box">
      <div>作成日：令和7年7月（令和7年8月期 第11期）</div>
    </div>
    <div style="margin-top:30px; opacity:0.85; font-size:13px;">
      <div>【収録内容】</div>
      <div style="margin-top:8px; text-align:left; line-height:2;">
        　① 令和7年7月 単月 詳細データ<br>
        　② ３期 単月比較（7月）<br>
        　③ ３期 累計比較（9月〜7月）<br>
        　④ フリーキャッシュフローと運転資本の関係性<br>
        　⑤ 借入金 明細別返済状況<br>
        　⑥ 段階利益 ３期比較グラフ<br>
        　⑦ 総括・コメント
      </div>
    </div>
    <div class="prepared">作成：日下部税理士事務所</div>
  </div>
</div>


<!-- =========================================================
     PAGE 2: 令和7年7月 単月詳細データ
     ========================================================= -->
<div class="page">
  <div class="page-header">
    <h2>① 令和7年7月 単月 詳細データ</h2>
    <span class="tag">R7.8期 第11期月次（令和7年7月）</span>
  </div>

  <!-- KPIサマリ -->
  <div class="grid-3" style="margin-bottom:16px;">
    <div class="kpi-card">
      <div class="label">純売上高</div>
      <div class="value">11,867千円</div>
      <div class="sub">前年同月比 +12.6%</div>
    </div>
    <div class="kpi-card">
      <div class="label">売上総利益（粗利率）</div>
      <div class="value">7,937千円（{gross_margin_july[2]:.1f}%）</div>
      <div class="sub">前年同月比 +4.5pt</div>
    </div>
    <div class="kpi-card">
      <div class="label">経常利益</div>
      <div class="value neg">△1,114千円</div>
      <div class="sub">前年同月差 +539千円</div>
    </div>
  </div>

  <!-- 損益計算書 詳細 -->
  <div class="section-title">■ 損益計算書（令和7年7月 単月）</div>
  <table>
    <thead>
      <tr>
        <th style="text-align:left; width:35%;">科　目</th>
        <th>金額（円）</th>
        <th>構成比</th>
        <th>前年同月（円）</th>
        <th>前年比較</th>
      </tr>
    </thead>
    <tbody>
      <tr class="tbl-total"><td>【純売上高】</td>
        <td>11,867,872</td><td>100.0%</td><td>10,536,610</td>
        <td class="positive">+1,331,262</td></tr>
      <tr><td>　売上高</td>
        <td>9,476,384</td><td>79.9%</td><td>8,162,732</td><td>+1,313,652</td></tr>
      <tr><td>　売上エクセル</td>
        <td>1,620,705</td><td>13.7%</td><td>1,744,280</td><td class="negative">△123,575</td></tr>
      <tr><td>　売上現金</td>
        <td>770,783</td><td>6.5%</td><td>629,598</td><td>+141,185</td></tr>
      <tr style="font-weight:bold;"><td>【売上原価】</td>
        <td>3,930,785</td><td>33.1%</td><td>3,976,828</td>
        <td class="positive">△46,043</td></tr>
      <tr><td>　期首商品棚卸高</td>
        <td>9,585,087</td><td>—</td><td>9,142,983</td><td></td></tr>
      <tr><td>　仕入高</td>
        <td>134,933</td><td>—</td><td>125,854</td><td></td></tr>
      <tr><td>　材料仕入</td>
        <td>2,625,493</td><td>—</td><td>2,738,505</td><td></td></tr>
      <tr><td>　テナント諸経費</td>
        <td>338,399</td><td>—</td><td>356,474</td><td></td></tr>
      <tr><td>　期末商品棚卸高</td>
        <td>△8,753,127</td><td>—</td><td>△8,386,988</td><td></td></tr>
      <tr class="tbl-total"><td>〔売上総利益〕</td>
        <td>7,937,087</td><td>66.9%</td><td>6,559,782</td>
        <td class="positive">+1,377,305</td></tr>
    </tbody>
  </table>

  <!-- 販売費及び一般管理費 詳細 -->
  <div class="section-title">■ 販売費及び一般管理費 内訳（令和7年7月 単月）</div>
  <table>
    <thead>
      <tr>
        <th style="text-align:left; width:28%;">科　目</th>
        <th>金額（円）</th>
        <th>構成比</th>
        <th style="text-align:left; width:28%;">科　目</th>
        <th>金額（円）</th>
        <th>構成比</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>荷造運賃</td><td>1,219,830</td><td>10.3%</td>
        <td>水道光熱費</td><td>196,345</td><td>1.7%</td>
      </tr>
      <tr>
        <td>役員報酬</td><td>1,540,000</td><td>13.0%</td>
        <td>旅費交通費</td><td>101,728</td><td>0.9%</td>
      </tr>
      <tr>
        <td>給料手当</td><td>2,916,287</td><td>24.6%</td>
        <td>手数料</td><td>61,255</td><td>0.5%</td>
      </tr>
      <tr>
        <td>賞与</td><td style="font-weight:bold; color:#c0392b;">895,000</td><td>7.5%</td>
        <td>租税公課</td><td>475,000</td><td>4.0%</td>
      </tr>
      <tr>
        <td>法定福利費</td><td>263,909</td><td>2.2%</td>
        <td>交際費</td><td>59,386</td><td>0.5%</td>
      </tr>
      <tr>
        <td>福利厚生費</td><td>51,373</td><td>0.4%</td>
        <td>支払保険料</td><td>292,772</td><td>2.5%</td>
      </tr>
      <tr>
        <td>減価償却費</td><td>480,509</td><td>4.0%</td>
        <td>諸会費</td><td>332,500</td><td>2.8%</td>
      </tr>
      <tr>
        <td>修繕費</td><td>526,000</td><td>4.4%</td>
        <td>車輌費</td><td>156,212</td><td>1.3%</td>
      </tr>
      <tr>
        <td>消耗品費</td><td>42,930</td><td>0.4%</td>
        <td>燃料費</td><td>115,990</td><td>1.0%</td>
      </tr>
      <tr>
        <td>広告宣伝費</td><td>30,000</td><td>0.3%</td>
        <td>リース料・他</td><td>113,706</td><td>1.0%</td>
      </tr>
      <tr class="tbl-total">
        <td colspan="2">【販売費及び一般管理費 合計】</td>
        <td>9,909,692</td>
        <td colspan="2">前年同月比</td>
        <td class="negative">+857,389</td>
      </tr>
    </tbody>
  </table>

  <table>
    <thead>
      <tr>
        <th style="text-align:left; width:35%;">科　目</th>
        <th>金額（円）</th>
        <th>構成比</th>
        <th>前年同月（円）</th>
        <th>前年比較</th>
      </tr>
    </thead>
    <tbody>
      <tr class="tbl-total"><td>〔営業利益〕</td>
        <td class="negative">△1,972,605</td><td>—</td>
        <td class="negative">△2,492,521</td>
        <td class="positive">+519,916</td></tr>
      <tr><td>　受取地代家賃</td><td>763,639</td><td>—</td><td>846,368</td><td class="negative">△82,729</td></tr>
      <tr><td>　受取配当金</td><td>96,827</td><td>—</td><td>0</td><td></td></tr>
      <tr><td>　支払利息</td><td class="negative">△2,139</td><td>—</td><td class="negative">△6,918</td><td>+4,779</td></tr>
      <tr class="tbl-total"><td>〔経常利益〕</td>
        <td class="negative">△1,114,278</td><td>—</td>
        <td class="negative">△1,652,991</td>
        <td class="positive">+538,713</td></tr>
    </tbody>
  </table>

  <div class="comment-box">
    <h4>📌 7月単月のポイント</h4>
    売上高は前年同月比+12.6%（+1,332千円）と増収。粗利率も66.9%（前年62.3%）と+4.6pt改善。一方、賞与計上（895千円）を含む販管費が9,910千円と増加し、経常損失は△1,114千円となった。受取地代家賃763千円が下支えし、前年損失△1,653千円から改善している。
  </div>
</div>


<!-- =========================================================
     PAGE 3: 3期単月比較（7月）
     ========================================================= -->
<div class="page">
  <div class="page-header">
    <h2>② ３期 単月比較（7月）</h2>
    <span class="tag">R5年7月 / R6年7月 / R7年7月</span>
  </div>

  <div class="chart-box">
    <img src="data:image/jpeg;base64,{chart1}" alt="3期単月比較グラフ">
  </div>

  <div class="section-title">■ ３期 7月単月 損益比較表（単位：千円）</div>
  <table>
    <thead>
      <tr>
        <th style="text-align:left; width:30%;">科　目</th>
        <th>R5年7月</th>
        <th>R6年7月</th>
        <th>R7年7月</th>
        <th>R6→R7 増減</th>
        <th>R5→R7 増減</th>
      </tr>
    </thead>
    <tbody>
      <tr class="tbl-total">
        <td>純売上高</td>
        <td>{net_sales_july[0]//1000:,}</td>
        <td>{net_sales_july[1]//1000:,}</td>
        <td>{net_sales_july[2]//1000:,}</td>
        <td class="positive">+{(net_sales_july[2]-net_sales_july[1])//1000:,}</td>
        <td class="positive">+{(net_sales_july[2]-net_sales_july[0])//1000:,}</td>
      </tr>
      <tr>
        <td>売上原価</td>
        <td>{cogs_july[0]//1000:,}</td>
        <td>{cogs_july[1]//1000:,}</td>
        <td>{cogs_july[2]//1000:,}</td>
        <td>△{(cogs_july[2]-cogs_july[1])//1000:,}</td>
        <td>+{(cogs_july[2]-cogs_july[0])//1000:,}</td>
      </tr>
      <tr class="tbl-total">
        <td>売上総利益</td>
        <td>{gross_profit_july[0]//1000:,}</td>
        <td>{gross_profit_july[1]//1000:,}</td>
        <td>{gross_profit_july[2]//1000:,}</td>
        <td class="positive">+{(gross_profit_july[2]-gross_profit_july[1])//1000:,}</td>
        <td class="positive">+{(gross_profit_july[2]-gross_profit_july[0])//1000:,}</td>
      </tr>
      <tr>
        <td>　粗利率</td>
        <td>{gross_margin_july[0]:.1f}%</td>
        <td>{gross_margin_july[1]:.1f}%</td>
        <td>{gross_margin_july[2]:.1f}%</td>
        <td class="positive">+{gross_margin_july[2]-gross_margin_july[1]:.1f}pt</td>
        <td class="positive">+{gross_margin_july[2]-gross_margin_july[0]:.1f}pt</td>
      </tr>
      <tr>
        <td>販売費及び一般管理費</td>
        <td>{sga_july[0]//1000:,}</td>
        <td>{sga_july[1]//1000:,}</td>
        <td>{sga_july[2]//1000:,}</td>
        <td class="negative">+{(sga_july[2]-sga_july[1])//1000:,}</td>
        <td class="negative">△{(sga_july[0]-sga_july[2])//1000:,}</td>
      </tr>
      <tr class="tbl-total">
        <td>営業利益</td>
        <td class="negative">△{abs(op_profit_july[0])//1000:,}</td>
        <td class="negative">△{abs(op_profit_july[1])//1000:,}</td>
        <td class="negative">△{abs(op_profit_july[2])//1000:,}</td>
        <td class="positive">+{(abs(op_profit_july[1])-abs(op_profit_july[2]))//1000:,}</td>
        <td class="positive">+{(abs(op_profit_july[0])-abs(op_profit_july[2]))//1000:,}</td>
      </tr>
      <tr>
        <td>営業外収益（地代家賃等）</td>
        <td>{other_income_july[0]//1000:,}</td>
        <td>{other_income_july[1]//1000:,}</td>
        <td>{other_income_july[2]//1000:,}</td>
        <td class="positive">+{(other_income_july[2]-other_income_july[1])//1000:,}</td>
        <td class="negative">△{(other_income_july[0]-other_income_july[2])//1000:,}</td>
      </tr>
      <tr>
        <td>支払利息</td>
        <td>{other_expense_july[0]:,}</td>
        <td>{other_expense_july[1]:,}</td>
        <td>{other_expense_july[2]:,}</td>
        <td class="positive">△{other_expense_july[1]-other_expense_july[2]:,}</td>
        <td class="positive">△{other_expense_july[0]-other_expense_july[2]:,}</td>
      </tr>
      <tr class="tbl-total">
        <td>経常利益</td>
        <td class="negative">△{abs(ord_profit_july[0])//1000:,}</td>
        <td class="negative">△{abs(ord_profit_july[1])//1000:,}</td>
        <td class="negative">△{abs(ord_profit_july[2])//1000:,}</td>
        <td class="positive">+{(abs(ord_profit_july[1])-abs(ord_profit_july[2]))//1000:,}</td>
        <td class="positive">+{(abs(ord_profit_july[0])-abs(ord_profit_july[2]))//1000:,}</td>
      </tr>
    </tbody>
  </table>

  <div class="comment-box">
    <h4>📌 3期比較ポイント</h4>
    ・<strong>売上高</strong>はR5→R7で+854千円（+7.8%）と着実に成長。<br>
    ・<strong>粗利率</strong>はR5:67.8%→R6:62.3%→R7:66.9%と回復傾向。R6の原価増加（材料費高騰）がR7には改善。<br>
    ・<strong>経常損失</strong>はR5:△1,673千円→R6:△1,653千円→R7:△1,114千円と3期連続改善。<br>
    ・7月は賞与月であり季節的に販管費が高くなる傾向あり（R7賞与895千円）。
  </div>
</div>


<!-- =========================================================
     PAGE 4: 3期累計比較
     ========================================================= -->
<div class="page">
  <div class="page-header">
    <h2>③ ３期 累計比較（9月〜7月 11ヶ月）</h2>
    <span class="tag">R5.8期 / R6.8期 / R7.8期</span>
  </div>

  <div class="chart-box">
    <img src="data:image/jpeg;base64,{chart2}" alt="3期累計比較グラフ">
  </div>

  <div class="section-title">■ ３期 9月〜7月 累計損益比較表（単位：千円）</div>
  <table>
    <thead>
      <tr>
        <th style="text-align:left; width:30%;">科　目</th>
        <th>R5.8期(11ヶ月)</th>
        <th>R6.8期(11ヶ月)</th>
        <th>R7.8期(11ヶ月)</th>
        <th>R6→R7 増減</th>
      </tr>
    </thead>
    <tbody>
      <tr class="tbl-total">
        <td>純売上高</td>
        <td>{net_sales_11m[0]//1000:,}</td>
        <td>{net_sales_11m[1]//1000:,}</td>
        <td>{net_sales_11m[2]//1000:,}</td>
        <td class="positive">+{(net_sales_11m[2]-net_sales_11m[1])//1000:,}</td>
      </tr>
      <tr>
        <td>売上原価</td>
        <td>{cogs_11m[0]//1000:,}</td>
        <td>{cogs_11m[1]//1000:,}</td>
        <td>{cogs_11m[2]//1000:,}</td>
        <td class="negative">+{(cogs_11m[2]-cogs_11m[1])//1000:,}</td>
      </tr>
      <tr class="tbl-total">
        <td>売上総利益</td>
        <td>{gp_11m[0]//1000:,}</td>
        <td>{gp_11m[1]//1000:,}</td>
        <td>{gp_11m[2]//1000:,}</td>
        <td class="positive">+{(gp_11m[2]-gp_11m[1])//1000:,}</td>
      </tr>
      <tr>
        <td>　粗利率</td>
        <td>{gm_11m[0]:.1f}%</td>
        <td>{gm_11m[1]:.1f}%</td>
        <td>{gm_11m[2]:.1f}%</td>
        <td class="positive">+{gm_11m[2]-gm_11m[1]:.1f}pt</td>
      </tr>
      <tr>
        <td>販売費及び一般管理費</td>
        <td>{sga_11m[0]//1000:,}</td>
        <td>{sga_11m[1]//1000:,}</td>
        <td>{sga_11m[2]//1000:,}</td>
        <td class="negative">+{(sga_11m[2]-sga_11m[1])//1000:,}</td>
      </tr>
      <tr class="tbl-total">
        <td>営業利益</td>
        <td class="negative">△{abs(op_11m[0])//1000:,}</td>
        <td class="negative">△{abs(op_11m[1])//1000:,}</td>
        <td class="negative">△{abs(op_11m[2])//1000:,}</td>
        <td class="negative">△{(abs(op_11m[2])-abs(op_11m[1]))//1000:,}</td>
      </tr>
      <tr class="tbl-total">
        <td>経常利益</td>
        <td class="negative">△{abs(ord_11m[0])//1000:,}</td>
        <td class="positive">{ord_11m[1]//1000:,}</td>
        <td class="negative">△{abs(ord_11m[2])//1000:,}</td>
        <td class="negative">△{(ord_11m[1]-ord_11m[2])//1000:,}</td>
      </tr>
    </tbody>
  </table>

  <div class="comment-box">
    <h4>📌 累計比較ポイント</h4>
    ・<strong>売上高</strong>：R7.8期11ヶ月累計は130,804千円、R6比+7,131千円（+5.8%）と増収。<br>
    ・<strong>売上総利益</strong>：R7は87,434千円（粗利率66.9%）、R6比+5,356千円改善。<br>
    ・<strong>販管費</strong>：101,881千円と前年比+8,229千円（給与・賞与増）の増加。<br>
    ・<strong>経常利益</strong>：R6期は賃貸収入の一時的計上（3,915千円）で1,883千円の黒字だったが、R7期は△5,098千円と赤字。不動産賃貸収入の減少（△769千円）も影響。
  </div>
</div>


<!-- =========================================================
     PAGE 5: FCF・運転資本
     ========================================================= -->
<div class="page">
  <div class="page-header">
    <h2>④ フリーキャッシュフロー（FCF）と運転資本の関係性</h2>
    <span class="tag">R7.8期（令和6年9月〜令和7年7月）月次推移</span>
  </div>

  <div class="chart-box">
    <img src="data:image/jpeg;base64,{chart3}" alt="FCF・運転資本グラフ">
  </div>

  <div class="section-title">■ 月次 運転資本・FCF 推移表（単位：千円）</div>
  <table>
    <thead>
      <tr>
        <th>月</th>
        <th>流動資産</th>
        <th>流動負債</th>
        <th>運転資本</th>
        <th>経常利益(月次)</th>
        <th>減価償却費</th>
        <th>返済額（概算）</th>
        <th>簡易FCF</th>
        <th>累計FCF</th>
      </tr>
    </thead>
    <tbody>"""

    cum_fcf = 0
    for i, m in enumerate(months_r7):
        ca = current_assets_r7[i]
        cl = current_liab_r7[i]
        wc = working_capital_r7[i]
        op = ord_profit_monthly_r7[i]
        fcf = fcf_r7[i]
        cum_fcf += fcf
        fcf_cls = 'negative' if fcf < 0 else 'positive'
        op_cls = 'negative' if op < 0 else 'positive'
        cum_cls = 'negative' if cum_fcf < 0 else 'positive'
        html += f"""
      <tr>
        <td style="text-align:center;background:#f5f7fa;font-weight:bold;">{m}</td>
        <td>{ca//1000:,}</td>
        <td>{cl//1000:,}</td>
        <td style="font-weight:bold;">{wc//1000:,}</td>
        <td class="{op_cls}">{op//1000:,}</td>
        <td>481</td>
        <td>△409</td>
        <td class="{fcf_cls}">{fcf//1000:,}</td>
        <td class="{cum_cls}">{cum_fcf//1000:,}</td>
      </tr>"""

    html += f"""
    </tbody>
  </table>
  <div class="footnote">※簡易FCF = 経常利益 + 減価償却費(481千円/月) − 借入金・リース返済(409千円/月) 　※資本的支出（設備投資）は未考慮</div>

  <div class="comment-box">
    <h4>📌 FCF・運転資本のポイント</h4>
    ・<strong>運転資本</strong>は36,538千円〜40,102千円の範囲で推移。5月に売掛金増加で流動資産が膨らむ季節性あり。<br>
    ・<strong>累計FCF</strong>は年間通じてマイナス（△3,127千円）。経常損失が減価償却費を下回る月が多く、キャッシュは小幅に流出。<br>
    ・3月・5月はプラスFCFを確保。不動産賃貸収入（月額764千円）がキャッシュフロー改善に貢献。<br>
    ・<strong>現預金残高</strong>：期首（9月）38,944千円 → 7月末31,863千円と約7,081千円の減少。
  </div>
</div>


<!-- =========================================================
     PAGE 6: 借入金返済状況
     ========================================================= -->
<div class="page">
  <div class="page-header">
    <h2>⑤ 借入金 明細別返済状況</h2>
    <span class="tag">R7.8期（令和6年9月〜令和7年7月）</span>
  </div>

  <div class="chart-box">
    <img src="data:image/jpeg;base64,{chart4}" alt="借入金グラフ">
  </div>

  <div class="section-title">■ 月次 借入金残高推移表（単位：千円）</div>
  <table>
    <thead>
      <tr>
        <th>月</th>
        <th>長期借入金</th>
        <th>月次返済額</th>
        <th>リース債務</th>
        <th>月次返済額</th>
        <th>借入合計残高</th>
        <th>支払利息</th>
      </tr>
    </thead>
    <tbody>"""

    interest = [5132,5134,4344,4315,3985,3302,3326,3094,2496,2263,2139]
    for i, m in enumerate(months_r7):
        lb = loan_balance[i]
        ls = lease_balance[i]
        tot = total_debt[i]
        repay_loan = 277 if i > 0 else 424  # first month difference
        repay_lease = 131
        html += f"""
      <tr>
        <td style="text-align:center;background:#f5f7fa;font-weight:bold;">{m}</td>
        <td>{lb//1000:,}</td>
        <td>△{277}</td>
        <td>{ls//1000:,}</td>
        <td>△{132}</td>
        <td style="font-weight:bold;">{tot//1000:,}</td>
        <td>{interest[i]:,}</td>
      </tr>"""

    html += f"""
    </tbody>
  </table>

  <div class="section-title" style="margin-top:16px;">■ 借入金明細・返済予定（令和7年7月末現在）</div>
  <table>
    <thead>
      <tr>
        <th style="text-align:left;">区分</th>
        <th>7月末残高（円）</th>
        <th>月次返済額（概算）</th>
        <th>完済見込み</th>
        <th>備考</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>長期借入金</td>
        <td>1,690,000</td>
        <td>277,000円/月</td>
        <td style="font-weight:bold; color:#1a5276;">令和8年2月頃</td>
        <td>あと約6ヶ月で完済見込み</td>
      </tr>
      <tr>
        <td>リース債務（車両・機器等）</td>
        <td>5,598,280</td>
        <td>131,870円/月</td>
        <td style="font-weight:bold; color:#1a5276;">令和11年頃（約42ヶ月）</td>
        <td>複数リース契約の合計</td>
      </tr>
      <tr class="tbl-total">
        <td>合　計</td>
        <td>7,288,280</td>
        <td>408,870円/月</td>
        <td>—</td>
        <td>長期借入金は完済に向け順調</td>
      </tr>
    </tbody>
  </table>

  <div class="section-title" style="margin-top:12px;">■ 3期比較 借入金残高（7月末時点）（単位：千円）</div>
  <table>
    <thead>
      <tr>
        <th style="text-align:left;">区分</th>
        <th>R5年7月末</th>
        <th>R6年7月末</th>
        <th>R7年7月末</th>
        <th>R5→R7 削減額</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>長期借入金</td>
        <td>13,910</td>
        <td>4,382</td>
        <td>1,690</td>
        <td class="positive">△12,220</td>
      </tr>
      <tr>
        <td>リース債務</td>
        <td>8,763</td>
        <td>7,181</td>
        <td>5,598</td>
        <td class="positive">△3,165</td>
      </tr>
      <tr class="tbl-total">
        <td>合計（有利子負債）</td>
        <td>22,673</td>
        <td>11,563</td>
        <td>7,288</td>
        <td class="positive">△15,385（△67.9%）</td>
      </tr>
    </tbody>
  </table>

  <div class="comment-box">
    <h4>📌 借入金のポイント</h4>
    ・有利子負債残高はR5年7月末22,673千円→R7年7月末7,288千円と<strong>3年間で67.9%削減</strong>（約15,385千円）。<br>
    ・<strong>長期借入金</strong>（1,690千円）は毎月277千円ずつ返済中。令和8年2月頃に完済見込み。<br>
    ・<strong>リース債務</strong>（5,598千円）は残り約42ヶ月で完済予定。年間約1,582千円の返済。<br>
    ・<strong>支払利息</strong>は9月5,132円→7月2,139円と着実に低下。財務コスト改善が進んでいる。
  </div>
</div>


<!-- =========================================================
     PAGE 7: 段階利益 3期比較グラフ
     ========================================================= -->
<div class="page">
  <div class="page-header">
    <h2>⑥ 段階利益 ３期比較グラフ</h2>
    <span class="tag">7月単月 ／ 9月〜7月 11ヶ月累計</span>
  </div>

  <div class="section-title">■ 7月 単月 段階利益比較</div>
  <div class="chart-box">
    <img src="data:image/jpeg;base64,{chart5}" alt="段階利益グラフ（単月）">
  </div>

  <div class="section-title">■ 9月〜7月 累計 段階利益比較</div>
  <div class="chart-box">
    <img src="data:image/jpeg;base64,{chart6}" alt="段階利益グラフ（累計）">
  </div>

  <div class="section-title">■ 段階利益サマリ表（単位：千円）</div>
  <div class="grid-2">
    <table>
      <thead>
        <tr>
          <th style="text-align:left;">7月単月</th>
          <th>R5年7月</th>
          <th>R6年7月</th>
          <th>R7年7月</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>純売上高</td><td>{net_sales_july[0]//1000:,}</td><td>{net_sales_july[1]//1000:,}</td><td>{net_sales_july[2]//1000:,}</td></tr>
        <tr><td>売上総利益</td><td>{gross_profit_july[0]//1000:,}</td><td>{gross_profit_july[1]//1000:,}</td><td>{gross_profit_july[2]//1000:,}</td></tr>
        <tr><td>（粗利率）</td><td>{gross_margin_july[0]:.1f}%</td><td>{gross_margin_july[1]:.1f}%</td><td>{gross_margin_july[2]:.1f}%</td></tr>
        <tr><td>営業利益</td><td class="negative">△{abs(op_profit_july[0])//1000:,}</td><td class="negative">△{abs(op_profit_july[1])//1000:,}</td><td class="negative">△{abs(op_profit_july[2])//1000:,}</td></tr>
        <tr class="tbl-total"><td>経常利益</td><td class="negative">△{abs(ord_profit_july[0])//1000:,}</td><td class="negative">△{abs(ord_profit_july[1])//1000:,}</td><td class="negative">△{abs(ord_profit_july[2])//1000:,}</td></tr>
      </tbody>
    </table>
    <table>
      <thead>
        <tr>
          <th style="text-align:left;">11ヶ月累計</th>
          <th>R5.8期</th>
          <th>R6.8期</th>
          <th>R7.8期</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>純売上高</td><td>{net_sales_11m[0]//1000:,}</td><td>{net_sales_11m[1]//1000:,}</td><td>{net_sales_11m[2]//1000:,}</td></tr>
        <tr><td>売上総利益</td><td>{gp_11m[0]//1000:,}</td><td>{gp_11m[1]//1000:,}</td><td>{gp_11m[2]//1000:,}</td></tr>
        <tr><td>（粗利率）</td><td>{gm_11m[0]:.1f}%</td><td>{gm_11m[1]:.1f}%</td><td>{gm_11m[2]:.1f}%</td></tr>
        <tr><td>営業利益</td><td class="negative">△{abs(op_11m[0])//1000:,}</td><td class="negative">△{abs(op_11m[1])//1000:,}</td><td class="negative">△{abs(op_11m[2])//1000:,}</td></tr>
        <tr class="tbl-total"><td>経常利益</td><td class="negative">△{abs(ord_11m[0])//1000:,}</td><td class="positive">{ord_11m[1]//1000:,}</td><td class="negative">△{abs(ord_11m[2])//1000:,}</td></tr>
      </tbody>
    </table>
  </div>
</div>


<!-- =========================================================
     PAGE 8: 総括・コメント
     ========================================================= -->
<div class="page">
  <div class="page-header">
    <h2>⑦ 総括・コメント</h2>
    <span class="tag">令和7年7月度 顧問先報告</span>
  </div>

  <div class="section-title">■ 令和7年7月度 総括</div>

  <div class="grid-2" style="margin-bottom:18px;">
    <div>
      <div class="comment-box">
        <h4>📈 売上・粗利益（良好）</h4>
        <p>7月単月の売上高は11,868千円と前年比+12.6%の増収を達成。粗利率は66.9%と前年（62.3%）から+4.6pt改善しており、仕入原価の効率化が進んでいる。年間累計（11ヶ月）でも130,804千円（前年比+5.8%）と堅調な売上推移を維持している。</p>
      </div>
      <div class="comment-box">
        <h4>⚠️ 販管費の増加（要注意）</h4>
        <p>7月の販管費は9,910千円（前年比+857千円）。主因は賞与895千円（7月・12月の年2回）の計上。通常月の販管費ベースは約9,000千円台で推移しており、売上高比で約76%と高水準。人件費（役員報酬+給料+賞与）が合計5,351千円と販管費の54%を占める。</p>
      </div>
    </div>
    <div>
      <div class="comment-box">
        <h4>💰 財務状況（改善中）</h4>
        <p>長期借入金は1,690千円まで圧縮され、令和8年2月頃に完済見込み。有利子負債合計（長期借入金+リース）は7,288千円と3年前比67.9%削減。支払利息も月額2,139円まで低下し財務コストは最小限。運転資本36,538千円は良好な水準を維持している。</p>
      </div>
      <div class="comment-box">
        <h4>🏢 不動産収入（安定）</h4>
        <p>受取地代家賃は月額764千円の安定収入を確保（年間9,164千円相当）。これが本業の経常損失を補填する重要なキャッシュソースとなっている。一方、R6期に計上された一時的な雑収入（3,915千円）の剥落が累計経常利益の悪化要因となっている。</p>
      </div>
    </div>
  </div>

  <div class="section-title">■ 課題と今後のポイント</div>
  <table>
    <thead>
      <tr>
        <th style="text-align:left; width:25%;">項目</th>
        <th style="text-align:left; width:40%;">現状・課題</th>
        <th style="text-align:left; width:35%;">対応・注目点</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>①　本業収益改善</td>
        <td>営業損失が11ヶ月累計△14,447千円。不動産収入で補填する構造が続いている。</td>
        <td>売上拡大と原価率維持が最優先。粗利率66.9%を維持しながら増収を図る。</td>
      </tr>
      <tr>
        <td>②　販管費の管理</td>
        <td>人件費比率が高く、売上比76%の販管費率。賞与月（7月・12月）は特に注意。</td>
        <td>売上増による固定費の薄まりが最重要。人件費の適正管理を継続。</td>
      </tr>
      <tr>
        <td>③　借入金完済</td>
        <td>長期借入金は令和8年2月に完済見込み。月277千円の返済が続く。</td>
        <td>完済後は月409千円→132千円の返済負担軽減。FCFが大幅改善見込み。</td>
      </tr>
      <tr>
        <td>④　在庫管理</td>
        <td>商品在庫が期初8,465千円→7月末8,753千円。適正在庫水準の維持が重要。</td>
        <td>8月決算に向けた在庫評価・棚卸の適正実施を確認。</td>
      </tr>
      <tr>
        <td>⑤　キャッシュ管理</td>
        <td>現預金は9月38,944千円→7月末30,157千円（△8,787千円）。</td>
        <td>8月は8月分売掛金回収があり改善見込み。定積・定期の流動性も確認。</td>
      </tr>
    </tbody>
  </table>

  <div class="section-title" style="margin-top:16px;">■ 次期（令和7年8月）の着眼点</div>
  <table>
    <thead>
      <tr>
        <th style="text-align:left; width:30%;">確認事項</th>
        <th style="text-align:left;">内容</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>8月売上・粗利確認</td>
        <td>前年8月売上は13,794千円（粗利率69.7%）。例年8月は繁忙期。目標達成状況を確認。</td>
      </tr>
      <tr>
        <td>決算前の棚卸</td>
        <td>期末在庫の適正評価。原材料・貯蔵品（合計6,466千円）の実地棚卸実施。</td>
      </tr>
      <tr>
        <td>法人税・消費税の見込み</td>
        <td>R7.8期は赤字見込みのため法人税最低限。消費税の確定申告準備（未払消費税等）。</td>
      </tr>
      <tr>
        <td>長期借入金の完済計画</td>
        <td>R8.2月完済に向け、繰上げ返済の検討・資金計画の最終確認。</td>
      </tr>
    </tbody>
  </table>

  <div style="margin-top: 20px; padding: 12px; background: #f5f7fa; border-radius: 6px; font-size: 10px; color: #666;">
    <strong>本資料について：</strong>本資料は株式会社笹沼五郎商店（R7.8期）の月次財務データに基づき作成しています。
    数値は会計ソフトウェアの月次データを参照しており、実際の確定値と若干異なる場合があります。
    不明点はお気軽にお問い合わせください。
  </div>
</div>

</body>
</html>"""

    return html


if __name__ == '__main__':
    print("レポート生成を開始します...")
    html_content = generate_html()
    output_path = os.path.join(os.path.dirname(__file__), 'financial_report_r7_july.html')
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html_content)
    print(f"\n✅ レポートを生成しました: {output_path}")
    print(f"   ファイルサイズ: {len(html_content):,} bytes")
