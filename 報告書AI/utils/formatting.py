"""数値・表示フォーマットユーティリティ"""

from config import DISPLAY_UNIT


def format_yen(amount, unit=DISPLAY_UNIT):
    """金額を千円単位でフォーマット（負数は▲表示）"""
    if amount is None:
        return "-"
    value = amount / unit if unit != 1 else amount
    value = round(value)
    if value < 0:
        return f"▲{abs(value):,.0f}"
    return f"{value:,.0f}"


def format_yen_raw(amount, unit=DISPLAY_UNIT):
    """金額を千円単位で数値として返す"""
    if amount is None:
        return 0
    return round(amount / unit) if unit != 1 else round(amount)


def format_percent(value):
    """パーセント表示"""
    if value is None:
        return "-"
    return f"{value:.1f}%"


def format_change(current, previous):
    """増減額と増減率を返す"""
    if previous is None or current is None:
        return None, None
    change = current - previous
    if previous == 0:
        rate = None
    else:
        rate = (change / abs(previous)) * 100
    return change, rate


def safe_div(a, b):
    """ゼロ除算安全な割り算"""
    if b is None or b == 0:
        return None
    return a / b
