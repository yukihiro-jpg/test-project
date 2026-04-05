"""
PDF報告書生成モジュール
fpdf2を使用。日本語フォント（NotoSansJP）が必要。
"""
import io
import os
import tempfile
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
    compute_kpi_summary,
    compute_breakeven,
    compute_sga_breakdown,
)
from src.loan_analyzer import get_loan_summary
from config import format_currency


def _get_font_path() -> str | None:
    """NotoSansJPフォントのパスを取得"""
    base = os.path.dirname(os.path.dirname(__file__))
    font_path = os.path.join(base, "fonts", "NotoSansJP-Regular.ttf")
    if os.path.exists(font_path):
        return font_path
    return None


class ReportPDF(FPDF):
    def __init__(self, client_name: str, font_path: str | None = None):
        super().__init__()
        self.client_name = client_name
        self.font_path = font_path

        if font_path:
            self.add_font("NotoSansJP", "", font_path, uni=True)
            self.default_font = "NotoSansJP"
        else:
            self.default_font = "Helvetica"

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
        self.cell(0, 10, f"Page {self.page_no()}/{{nb}}", align="C")

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

        # ラベル行
        self.set_text_color(100, 100, 100)
        for item in items:
            self.cell(col_width, 6, item, align="C")
        self.ln()

        # 値行
        self.set_text_color(30, 58, 95)
        self.set_font(self.default_font, size=12)
        for item in items:
            val = kpi_data[item]["value"]
            self.cell(col_width, 8, format_currency(val), align="C")
        self.ln()

        # 増減行
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

    def add_table(self, headers: list, rows: list, col_widths: list = None):
        if col_widths is None:
            col_widths = [190 / len(headers)] * len(headers)

        # ヘッダー
        self.set_fill_color(30, 58, 95)
        self.set_text_color(255, 255, 255)
        self.set_font(self.default_font, size=8)
        for i, header in enumerate(headers):
            self.cell(col_widths[i], 7, header, border=1, fill=True, align="C")
        self.ln()

        # データ行
        self.set_text_color(0, 0, 0)
        self.set_font(self.default_font, size=8)
        for row_idx, row in enumerate(rows):
            if row_idx % 2 == 1:
                self.set_fill_color(240, 242, 246)
                fill = True
            else:
                self.set_fill_color(255, 255, 255)
                fill = True

            for i, cell in enumerate(row):
                align = "L" if i == 0 else "R"
                self.cell(col_widths[i], 6, str(cell), border=1, fill=fill, align=align)
            self.ln()


def generate_pdf(
    fiscal_years: dict,
    period_pls: dict,
    df: pd.DataFrame,
    client_name: str,
    fiscal_year_end_month: int,
) -> io.BytesIO:
    """
    PDF報告書を生成する。

    Returns:
        BytesIO buffer containing the PDF
    """
    if not HAS_FPDF:
        raise ImportError("fpdf2がインストールされていません。pip install fpdf2 を実行してください。")

    font_path = _get_font_path()
    pdf = ReportPDF(client_name, font_path)
    pdf.alias_nb_pages()

    periods = list(period_pls.keys())
    current_period = periods[0] if periods else ""
    current_pl = period_pls.get(current_period, pd.DataFrame())
    previous_pl = period_pls.get(periods[1], pd.DataFrame()) if len(periods) > 1 else None

    # 表紙
    pdf.add_title_page(current_period)

    # Page 2: KPIサマリー + 月次P/L
    pdf.add_page()
    pdf.add_section_title("経営サマリー")

    if not current_pl.empty:
        kpi = compute_kpi_summary(current_pl, previous_pl)
        pdf.add_kpi_row(kpi)

        pdf.ln(4)
        pdf.add_section_title("月次損益計算書")

        headers = ["年月", "売上高", "売上原価", "売上総利益", "販管費", "営業利益", "経常利益", "当期純利益"]
        col_widths = [22, 24, 24, 24, 24, 24, 24, 24]
        rows = []
        for _, row in current_pl.iterrows():
            rows.append([
                str(row["year_month"]),
                f"{row['売上高']:,.0f}",
                f"{row['売上原価']:,.0f}",
                f"{row['売上総利益']:,.0f}",
                f"{row['販売費及び一般管理費']:,.0f}",
                f"{row['営業利益']:,.0f}",
                f"{row['経常利益']:,.0f}",
                f"{row['当期純利益']:,.0f}",
            ])
        pdf.add_table(headers, rows, col_widths)

    # Page 3: 3期比較
    if len(period_pls) >= 2:
        pdf.add_page()
        pdf.add_section_title("3期比較")

        comparison = compute_three_period_comparison(period_pls)
        comp_cols = list(comparison.columns)
        col_count = len(comp_cols)
        col_widths = [30] + [int(160 / (col_count - 1))] * (col_count - 1)

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

    # Page 4: 借入金
    loan_summary = get_loan_summary(df)
    if loan_summary["current_balance"] > 0:
        pdf.add_page()
        pdf.add_section_title("借入金状況")

        pdf.set_font(pdf.default_font, size=10)
        pdf.set_text_color(0, 0, 0)
        info_items = [
            ("借入金残高", format_currency(loan_summary["current_balance"])),
            ("うち長期借入金", format_currency(loan_summary["long_term_balance"])),
            ("うち短期借入金", format_currency(loan_summary["short_term_balance"])),
            ("月平均返済額", format_currency(loan_summary["avg_monthly_repayment"])),
            ("推定実効金利", f"{loan_summary['estimated_rate']:.2f}%"),
            ("累計支払利息", format_currency(loan_summary["total_interest_ytd"])),
        ]
        for label, value in info_items:
            pdf.cell(60, 7, label, align="L")
            pdf.cell(60, 7, value, align="R")
            pdf.ln()

    # Page 5: 損益分岐点
    if not current_pl.empty:
        pdf.add_page()
        pdf.add_section_title("損益分岐点分析")

        current_df = fiscal_years[current_period]
        be = compute_breakeven(current_pl, current_df)

        pdf.set_font(pdf.default_font, size=10)
        be_items = [
            ("売上高", f"{be['売上高']:,.0f}円"),
            ("変動費", f"{be['変動費']:,.0f}円"),
            ("固定費", f"{be['固定費']:,.0f}円"),
            ("限界利益", f"{be['限界利益']:,.0f}円"),
            ("限界利益率", f"{be['限界利益率']:.1f}%"),
            ("損益分岐点売上高", f"{be['損益分岐点売上高']:,.0f}円"),
            ("安全余裕率", f"{be['安全余裕率']:.1f}%"),
        ]
        for label, value in be_items:
            pdf.cell(60, 7, label, align="L")
            pdf.cell(60, 7, value, align="R")
            pdf.ln()

    # 出力
    buffer = io.BytesIO()
    buffer.write(pdf.output())
    buffer.seek(0)
    return buffer
