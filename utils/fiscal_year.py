"""会計年度ユーティリティ"""

from datetime import date


def get_fiscal_year_months(fiscal_year_start_month: int, current_month: int, current_year: int):
    """会計年度の月リストを返す"""
    months = []
    year = current_year if current_month >= fiscal_year_start_month else current_year - 1
    for i in range(12):
        m = fiscal_year_start_month + i
        y = year
        if m > 12:
            m -= 12
            y += 1
        months.append((y, m))
    return months


def get_elapsed_months(fiscal_year_start_month: int, current_month: int):
    """期首から当月までの経過月数を返す"""
    if current_month >= fiscal_year_start_month:
        return current_month - fiscal_year_start_month + 1
    else:
        return (12 - fiscal_year_start_month) + current_month + 1


def get_remaining_months(fiscal_year_start_month: int, current_month: int):
    """当月から期末までの残月数を返す"""
    return 12 - get_elapsed_months(fiscal_year_start_month, current_month)


def month_label(year: int, month: int) -> str:
    """月の表示ラベル"""
    return f"{year}/{month:02d}"
