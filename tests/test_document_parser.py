"""document_parser のテスト."""

from fractions import Fraction

from src.models import OwnershipEntry, TohonLand
from src.services.document_parser import (
    _parse_share_fraction,
    _zen_to_han,
    calculate_ownership,
    detect_city_from_properties,
    detect_prefecture_from_properties,
    extract_address_parts,
    _parse_number,
    _parse_int,
)


def test_zen_to_han():
    assert _zen_to_han("１２３") == "123"
    assert _zen_to_han("２分の１") == "2分の1"
    assert _zen_to_han("３／４") == "3/4"


def test_parse_share_fraction():
    assert _parse_share_fraction("2分の1") == Fraction(1, 2)
    assert _parse_share_fraction("3分の2") == Fraction(2, 3)
    assert _parse_share_fraction("1/4") == Fraction(1, 4)
    assert _parse_share_fraction("") is None
    assert _parse_share_fraction("単独") is None


def test_extract_address_parts_tokyo_ku():
    result = extract_address_parts("東京都渋谷区神宮前一丁目1番地")
    assert result["prefecture"] == "東京都"
    assert result["city"] == "渋谷区"


def test_extract_address_parts_city():
    result = extract_address_parts("埼玉県さいたま市浦和区高砂三丁目")
    assert result["prefecture"] == "埼玉県"
    assert "さいたま市" in result["city"]


def test_extract_address_parts_no_prefecture():
    result = extract_address_parts("渋谷区神宮前")
    assert result["prefecture"] == ""


def test_detect_prefecture_from_properties():
    props = [
        TohonLand(location="東京都渋谷区神宮前", chiban="1-1"),
        TohonLand(location="", chiban="2-2"),
    ]
    assert detect_prefecture_from_properties(props) == "東京都"


def test_detect_prefecture_from_properties_empty():
    props = [TohonLand(location="渋谷区", chiban="1-1")]
    assert detect_prefecture_from_properties(props) == ""


def test_detect_city_from_properties():
    props = [TohonLand(location="東京都渋谷区神宮前", chiban="1-1")]
    assert detect_city_from_properties(props) == "渋谷区"


def test_calculate_ownership_single_owner():
    history = [
        OwnershipEntry(
            registration_date="令和1年5月1日",
            entry_type="所有権保存",
            owner_name="山田太郎",
            share="",
        ),
    ]
    result = calculate_ownership(history, "山田太郎", "令和5年1月1日")
    assert result.current_share == "単独所有"
    assert result.share_fraction == 1.0


def test_calculate_ownership_shared():
    history = [
        OwnershipEntry(
            registration_date="令和1年5月1日",
            entry_type="所有権保存",
            owner_name="山田太郎",
            share="2分の1",
        ),
        OwnershipEntry(
            registration_date="令和1年5月1日",
            entry_type="所有権保存",
            owner_name="山田花子",
            share="2分の1",
        ),
    ]
    result = calculate_ownership(history, "山田太郎", "令和5年1月1日")
    assert result.current_share == "2分の1"
    assert result.share_fraction == 0.5


def test_calculate_ownership_transfer():
    history = [
        OwnershipEntry(
            registration_date="平成20年1月1日",
            entry_type="所有権保存",
            owner_name="山田太郎",
            share="",
        ),
        OwnershipEntry(
            registration_date="令和3年4月1日",
            entry_type="所有権移転",
            cause="売買",
            owner_name="鈴木次郎",
            share="",
        ),
    ]
    result = calculate_ownership(history, "山田太郎", "令和5年1月1日")
    assert result.current_share == "所有権なし"
    assert result.share_fraction == 0.0


def test_calculate_ownership_empty():
    result = calculate_ownership([], "山田太郎", "令和5年1月1日")
    assert result.current_share == ""


def test_parse_number():
    assert _parse_number("1,234.56") == 1234.56
    assert _parse_number("100") == 100.0
    assert _parse_number("") is None


def test_parse_int():
    assert _parse_int("1,000,000") == 1000000
    assert _parse_int("500") == 500
    assert _parse_int("") is None
