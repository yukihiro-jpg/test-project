"""PDF解析のテスト（日付・金額パース）"""

from datetime import date

from yokin_chosa.parsers.pdf_parser import parse_amount, parse_japanese_date


def test_parse_western_date():
    assert parse_japanese_date("2024/04/01") == date(2024, 4, 1)
    assert parse_japanese_date("2024-04-01") == date(2024, 4, 1)
    assert parse_japanese_date("2024.4.1") == date(2024, 4, 1)


def test_parse_japanese_era_date():
    assert parse_japanese_date("令和6年4月1日") == date(2024, 4, 1)
    assert parse_japanese_date("令和 6年4月1日") == date(2024, 4, 1)
    assert parse_japanese_date("平成31年4月1日") == date(2019, 4, 1)
    assert parse_japanese_date("R6.4.1") == date(2024, 4, 1)
    assert parse_japanese_date("H31.4.1") == date(2019, 4, 1)


def test_parse_two_digit_year():
    assert parse_japanese_date("24/04/01") == date(2024, 4, 1)


def test_parse_invalid_date():
    assert parse_japanese_date("") is None
    assert parse_japanese_date("テスト") is None


def test_parse_amount_basic():
    assert parse_amount("1000000") == 1_000_000
    assert parse_amount("1,000,000") == 1_000_000
    assert parse_amount("500000") == 500_000


def test_parse_amount_fullwidth():
    assert parse_amount("１，０００，０００") == 1_000_000
    assert parse_amount("５００，０００") == 500_000


def test_parse_amount_with_symbols():
    assert parse_amount("¥1,000,000") == 1_000_000
    assert parse_amount("￥500,000") == 500_000
    assert parse_amount("1,000,000円") == 1_000_000


def test_parse_amount_negative():
    assert parse_amount("△1,000,000") == -1_000_000
    assert parse_amount("▲500,000") == -500_000


def test_parse_amount_empty():
    assert parse_amount("") is None
    assert parse_amount(None) is None
    assert parse_amount("  ") is None
    assert parse_amount("*") is None
