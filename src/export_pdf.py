"""
PDF報告書生成モジュール
fpdf2を使用。日本語フォント（NotoSansJP）が必要。
画面上の全タブ内容と同一のデータをPDFに出力する。
"""
import io
import os
from datetime import date

import pandas as pd

try:
    from fpdf import FPDF
    HAS_FPDF = True
except ImportError:
    HAS_FPDF = False

from src.metrics import (
    compute_annual_pl,
    compute_three_period_comparison,
    compute_margins,
    compute_cumulative_pl,
    compute_kpi_summary,
    compute_breakeven,
    compute_sga_breakdown,
    compute_yoy_monthly,
    compute_budget_comparison,
)
from src.cash_flow import compute_monthly_cashflow
from src.loan_analyzer import (
    get_loan_summary,
    compute_loan_balance,
    compute_interest_summary,
    simulate_payoff,
)
from config import format_currency, format_percentage


def _get_font_path() -> str:
    """NotoSansJPフォントのパスを取得。なければ自動ダウンロード"""
    base = os.path.dirname(os.path.dirname(__file__))
    font_dir = os.path.join(base, "fonts")
    font_path = os.path.join(font_dir, "NotoSansJP-Regular.ttf")

    if os.path.exists(font_path):
        return font_path

    import urllib.request
    os.makedirs(font_dir, exist_ok=True)
    url = "https://github.com/google/fonts/raw/main/ofl/notosansjp/NotoSansJP%5Bwght%5D.ttf"
    try:
        urllib.request.urlretrieve(url, font_path)
        return font_path
    except Exception:
        raise RuntimeError(
            "日本語フォントのダウンロードに失敗しました。\n"
            "手動で fonts/NotoSansJP-Regular.ttf を配置してください。"
        )


def _format_ym(period) -> str:
    """year_monthを '2025年4月' 形式に変換"""
    s = str(period)
    if "-" in s:
        parts = s.split("-")
        return f"{parts[0]}年{int(parts[1])}月"
    return s


class ReportPDF(FPDF):
    def __init__(self, client_name: str, font_path: str = None):
        super().__init__()
        self.client_name = client_name

        if font_path is None:
            font_path = _get_font_path()

        self.add_font("NotoSansJP", "", font_path, uni=True)
        self.default_font = "NotoSansJP"

    def header(self):
        self.set_font(self.default_font, size=8)
        self.set_text_color(100, 100, 100)
        self.cell(0, 6, f"{self.client_name} - 営業成績報告書", align="L", new_x="LMARGIN", new_y="NEXT")
        self.line(10, 12, 200, 12)
        self.ln(4)

    def footer(self):
        self.set_y(-15)
        self.set_font(self.default_font, size=8)
        self.set_text_color(150, 150, 150)
        self.cell(0, 10, f"{self.page_no()} / {{nb}} ページ", align="C")

    def add_title_page(self, period_label: str):
        self.add_page()
        self.ln(60)
        self.set_font(self.default_font, size=24)
        self.set_text_color(30, 58, 95)
        self.cell(0, 15, "営業成績報告書", align="C", new_x="LMARGIN", new_y="NEXT")
        self.ln(10)
        self.set_font(self.default_font, size=16)
        self.cell(0, 12, self.client_name, align="C", new_x="LMARGIN", new_y="NEXT")
        self.ln(8)
        self.set_font(self.default_font, size=12)
        self.set_text_color(80, 80, 80)
        self.cell(0, 10, f"対象期間: {period_label}", align="C", new_x="LMARGIN", new_y="NEXT")
        self.ln(4)
        self.cell(0, 10, f"作成日: {date.today().strftime('%Y年%m月%d日')}", align="C", new_x="LMARGIN", new_y="NEXT")

    def add_section_title(self, title: str):
        self.set_font(self.default_font, size=14)
        self.set_text_color(30, 58, 95)
        self.cell(0, 10, title, new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(30, 58, 95)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(4)

    def add_kpi_row(self, kpi_data: dict):
        self.set_font(self.default_font, size=10)
        items = ["売上高", "売上総利益", "営業利益", "当期純利益"]
        col_width = 45

        self.set_text_color(100, 100, 100)
        for item in items:
            self.cell(col_width, 6, item, align="C")
        self.ln()

        self.set_text_color(30, 58, 95)
        self.set_font(self.default_font, size=12)
        for item in items:
            val = kpi_data[item]["value"]
            self.cell(col_width, 8, format_currency(val), align="C")
        self.ln()

        self.set_font(self.default_font, size=9)
        for item in items:
            delta = kpi_data[item]["delta"]
            pct = kpi_data[item]["delta_pct"]
            if delta >= 0:
                self.set_text_color(39, 174, 96)
                text = f"+{format_currency(delta)} ({pct:+.1f}%)"
            else:
                self.set_text_color(231, 76, 60)
                text = f"{format_currency(delta)} ({pct:+.1f}%)"
            self.cell(col_width, 6, text, align="C")
        self.ln(8)
        self.set_text_color(0, 0, 0)

    def add_key_value(self, label: str, value: str):
        """ラベル: 値 の1行表示"""
        self.set_font(self.default_font, size=10)
        self.set_text_color(0, 0, 0)
        self.cell(70, 7, label, align="L")
        self.cell(70, 7, value, align="R")
        self.ln()

    def add_table(self, headers: list, rows: list, col_widths: list = None, font_size: int = 8):
        if col_widths is None:
            col_widths = [190 / len(headers)] * len(headers)

        # ヘッダー
        self.set_fill_color(30, 58, 95)
        self.set_text_color(255, 255, 255)
        self.set_font(self.default_font, size=font_size)
        for i, header in enumerate(headers):
            self.cell(col_widths[i], 7, header, border=1, fill=True, align="C")
        self.ln()

        # データ行
        self.set_text_color(0, 0, 0)
        self.set_font(self.default_font, size=font_size)
        for row_idx, row in enumerate(rows):
            if row_idx % 2 == 1:
                self.set_fill_color(240, 242, 246)
            else:
                self.set_fill_color(255, 255, 255)

            for i, cell in enumerate(row):
                align = "L" if i == 0 else "R"
                self.cell(col_widths[i], 6, str(cell), border=1, fill=True, align=align)
            self.ln()


def generate_pdf(
    fiscal_years: dict,
    period_pls: dict,
    df: pd.DataFrame,
    client_name: str,
    fiscal_year_end_month: int,
) -> io.BytesIO:
    """画面の全タブ内容と同一のPDF報告書を生成する"""
    if not HAS_FPDF:
        raise ImportError("fpdf2がインストールされていません。pip install fpdf2 を実行してください。")

    pdf = ReportPDF(client_name)
    pdf.alias_nb_pages()

    periods = list(period_pls.keys())
    current_period = periods[0] if periods else ""
    current_pl = period_pls.get(current_period, pd.DataFrame())
    previous_period = periods[1] if len(periods) > 1 else None
    previous_pl = period_pls.get(previous_period, pd.DataFrame()) if previous_period else None
    current_df = fiscal_years.get(current_period, pd.DataFrame())

    # ============================================================
    # 表紙
    # ============================================================
    pdf.add_title_page(current_period)

    # ============================================================
    # 1. 経営サマリー（KPIカード）
    # ============================================================
    pdf.add_page()
    pdf.add_section_title("経営サマリー")

    if not current_pl.empty:
        kpi = compute_kpi_summary(current_pl, previous_pl)
        pdf.add_kpi_row(kpi)

    # ============================================================
    # 2. 当期月次推移（タブ1と同一）
    # ============================================================
    pdf.ln(2)
    pdf.add_section_title("当期月次損益計算書")

    if not current_pl.empty:
        headers = ["年月", "売上高", "売上原価", "売上総利益", "販管費", "営業利益", "経常利益", "当期純利益"]
        col_widths = [22, 24, 24, 24, 24, 24, 24, 24]
        rows = []
        for _, row in current_pl.iterrows():
            rows.append([
                _format_ym(row["year_month"]),
                f"{row['売上高']:,.0f}",
                f"{row['売上原価']:,.0f}",
                f"{row['売上総利益']:,.0f}",
                f"{row['販売費及び一般管理費']:,.0f}",
                f"{row['営業利益']:,.0f}",
                f"{row['経常利益']:,.0f}",
                f"{row['当期純利益']:,.0f}",
            ])
        # 合計行
        annual = compute_annual_pl(current_pl)
        rows.append([
            "合計",
            f"{annual['売上高']:,.0f}",
            f"{annual['売上原価']:,.0f}",
            f"{annual['売上総利益']:,.0f}",
            f"{annual['販売費及び一般管理費']:,.0f}",
            f"{annual['営業利益']:,.0f}",
            f"{annual['経常利益']:,.0f}",
            f"{annual['当期純利益']:,.0f}",
        ])
        pdf.add_table(headers, rows, col_widths, font_size=7)

    # ============================================================
    # 3. 3期比較（タブ2と同一）
    # ============================================================
    if len(period_pls) >= 2:
        pdf.add_page()
        pdf.add_section_title("3期比較")

        comparison = compute_three_period_comparison(period_pls)
        comp_cols = list(comparison.columns)
        col_count = len(comp_cols)
        col_widths = [35] + [int(155 / (col_count - 1))] * (col_count - 1)

        rows = []
        for _, row in comparison.iterrows():
            formatted_row = [row["科目"]]
            for col in comp_cols[1:]:
                val = row[col]
                if "率" in col or "%" in col:
                    formatted_row.append(f"{val:+.1f}%")
                else:
                    formatted_row.append(f"{val:,.0f}")
            rows.append(formatted_row)

        pdf.add_table(comp_cols, rows, col_widths)

    # ============================================================
    # 4. 前年対比（タブ3と同一）
    # ============================================================
    if not current_pl.empty and previous_pl is not None and not previous_pl.empty:
        pdf.add_page()
        pdf.add_section_title("前年対比（売上高）")

        yoy = compute_yoy_monthly(current_pl, previous_pl)
        headers = ["年月", "当期売上高", "前期売上高", "増減額", "増減率(%)"]
        col_widths = [28, 38, 38, 38, 28]
        rows = []
        for _, row in yoy.iterrows():
            rows.append([
                _format_ym(row["year_month"]),
                f"{row['売上高_当期']:,.0f}",
                f"{row['売上高_前期']:,.0f}",
                f"{row['売上高_増減']:,.0f}",
                f"{row['売上高_増減率(%)']:+.1f}%",
            ])
        pdf.add_table(headers, rows, col_widths)

        # 利益の前年対比も
        pdf.ln(4)
        pdf.add_section_title("前年対比（営業利益）")
        headers2 = ["年月", "当期営業利益", "前期営業利益", "増減額", "増減率(%)"]
        rows2 = []
        for _, row in yoy.iterrows():
            rows2.append([
                _format_ym(row["year_month"]),
                f"{row['営業利益_当期']:,.0f}",
                f"{row['営業利益_前期']:,.0f}",
                f"{row['営業利益_増減']:,.0f}",
                f"{row['営業利益_増減率(%)']:+.1f}%",
            ])
        pdf.add_table(headers2, rows2, col_widths)

    # ============================================================
    # 5. 利益率・費用構成（タブ4と同一）
    # ============================================================
    if not current_pl.empty:
        pdf.add_page()
        pdf.add_section_title("利益率推移")

        margins = compute_margins(current_pl)
        headers = ["年月", "売上総利益率", "営業利益率", "経常利益率", "当期純利益率"]
        col_widths = [30, 40, 40, 40, 40]
        rows = []
        for _, row in margins.iterrows():
            rows.append([
                _format_ym(row["year_month"]),
                f"{row['売上総利益率']:.1f}%",
                f"{row['営業利益率']:.1f}%",
                f"{row['経常利益率']:.1f}%",
                f"{row['当期純利益率']:.1f}%",
            ])
        pdf.add_table(headers, rows, col_widths)

        # 販管費内訳
        pdf.ln(4)
        pdf.add_section_title("販管費内訳")

        sga = compute_sga_breakdown(current_df)
        if not sga.empty:
            total_sga = sga["金額"].sum()
            headers = ["勘定科目", "金額", "構成比"]
            col_widths = [70, 60, 60]
            rows = []
            for _, row in sga.iterrows():
                pct = row["金額"] / total_sga * 100 if total_sga else 0
                rows.append([
                    row["勘定科目"],
                    f"{row['金額']:,.0f}",
                    f"{pct:.1f}%",
                ])
            rows.append(["合計", f"{total_sga:,.0f}", "100.0%"])
            pdf.add_table(headers, rows, col_widths)

    # ============================================================
    # 6. キャッシュフロー（タブ5と同一）
    # ============================================================
    if not current_df.empty:
        cf = compute_monthly_cashflow(current_df)
        if not cf.empty:
            pdf.add_page()
            pdf.add_section_title("キャッシュフロー")

            # サマリー
            pdf.add_key_value("営業CF累計", f"{cf['営業CF'].sum():,.0f}円")
            pdf.add_key_value("投資CF累計", f"{cf['投資CF'].sum():,.0f}円")
            pdf.add_key_value("財務CF累計", f"{cf['財務CF'].sum():,.0f}円")
            pdf.add_key_value("現金残高", f"{cf['現金残高累計'].iloc[-1]:,.0f}円")
            pdf.ln(4)

            headers = ["年月", "営業CF", "投資CF", "財務CF", "CF合計", "現金残高"]
            col_widths = [28, 32, 32, 32, 32, 34]
            rows = []
            for _, row in cf.iterrows():
                rows.append([
                    _format_ym(row["year_month"]),
                    f"{row['営業CF']:,.0f}",
                    f"{row['投資CF']:,.0f}",
                    f"{row['財務CF']:,.0f}",
                    f"{row['CF合計']:,.0f}",
                    f"{row['現金残高累計']:,.0f}",
                ])
            pdf.add_table(headers, rows, col_widths)

    # ============================================================
    # 7. 借入金返済（タブ6と同一）
    # ============================================================
    loan_summary = get_loan_summary(df)
    if loan_summary["current_balance"] > 0:
        pdf.add_page()
        pdf.add_section_title("借入金状況")

        pdf.add_key_value("借入金残高", format_currency(loan_summary["current_balance"]))
        pdf.add_key_value("うち長期借入金", format_currency(loan_summary["long_term_balance"]))
        pdf.add_key_value("うち短期借入金", format_currency(loan_summary["short_term_balance"]))
        pdf.add_key_value("月平均返済額", format_currency(loan_summary["avg_monthly_repayment"]))
        pdf.add_key_value("推定実効金利", f"{loan_summary['estimated_rate']:.2f}%")
        pdf.add_key_value("累計支払利息", format_currency(loan_summary["total_interest_ytd"]))
        pdf.ln(4)

        # 返済実績テーブル
        loan_balance = compute_loan_balance(df)
        if not loan_balance.empty:
            pdf.add_section_title("借入金残高推移")
            headers = ["年月", "長期借入金", "短期借入金", "合計残高", "返済額", "新規借入額"]
            col_widths = [28, 32, 32, 32, 32, 34]
            rows = []
            for _, row in loan_balance.iterrows():
                rows.append([
                    _format_ym(row["year_month"]),
                    f"{row['長期借入金_残高']:,.0f}",
                    f"{row['短期借入金_残高']:,.0f}",
                    f"{row['合計残高']:,.0f}",
                    f"{row['返済額']:,.0f}",
                    f"{row['新規借入額']:,.0f}",
                ])
            pdf.add_table(headers, rows, col_widths, font_size=7)

        # 完済シミュレーション
        pdf.ln(4)
        pdf.add_section_title("完済シミュレーション")
        sim = simulate_payoff(
            current_balance=loan_summary["current_balance"],
            monthly_repayment=loan_summary["avg_monthly_repayment"],
            annual_rate=loan_summary["estimated_rate"],
        )
        if not sim.empty:
            months_to_payoff = len(sim)
            years = months_to_payoff // 12
            remainder = months_to_payoff % 12
            pdf.add_key_value("完済までの期間（通常返済）", f"{years}年{remainder}ヶ月")
            pdf.add_key_value("総返済額", f"{sim['返済額'].sum():,.0f}円")
            pdf.add_key_value("総利息額", f"{sim['利息'].sum():,.0f}円")

    # ============================================================
    # 8. 損益分岐点分析（タブ7と同一）
    # ============================================================
    if not current_pl.empty:
        pdf.add_page()
        pdf.add_section_title("損益分岐点分析")

        be = compute_breakeven(current_pl, current_df)

        pdf.add_key_value("売上高", f"{be['売上高']:,.0f}円")
        pdf.add_key_value("変動費", f"{be['変動費']:,.0f}円")
        pdf.add_key_value("限界利益", f"{be['限界利益']:,.0f}円")
        pdf.add_key_value("固定費", f"{be['固定費']:,.0f}円")
        pdf.ln(2)
        pdf.add_key_value("変動費率", f"{be['変動費率']:.1f}%")
        pdf.add_key_value("限界利益率", f"{be['限界利益率']:.1f}%")
        pdf.add_key_value("損益分岐点売上高", f"{be['損益分岐点売上高']:,.0f}円")
        pdf.add_key_value("安全余裕率", f"{be['安全余裕率']:.1f}%")

        pdf.ln(6)
        pdf.set_font(pdf.default_font, size=9)
        pdf.set_text_color(80, 80, 80)
        pdf.multi_cell(0, 5,
            "【解説】\n"
            "・損益分岐点売上高: これ以上売れば黒字になる売上高の水準\n"
            "・安全余裕率: 現在の売上高が損益分岐点をどれだけ上回っているか（高いほど安全）\n"
            "・限界利益率: 売上1円あたりの固定費回収能力\n"
            "・変動費率: 売上に比例して増える費用の割合"
        )

    # 出力
    buffer = io.BytesIO()
    buffer.write(pdf.output())
    buffer.seek(0)
    return buffer
