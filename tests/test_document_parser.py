"""document_parser のテスト."""

from src.services.document_parser import (
    extract_address_parts,
    detect_prefecture_from_properties,
    detect_city_from_properties,
    _parse_number,
    _parse_int,
)
from src.models import UploadedProperty


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
    assert result["city"] == ""


def test_extract_address_parts_gun():
    result = extract_address_parts("長野県北安曇郡白馬村大字北城")
    assert result["prefecture"] == "長野県"
    assert "白馬村" in result["city"] or "北安曇郡" in result["city"]


def test_detect_prefecture_from_properties():
    props = [
        UploadedProperty(location="東京都渋谷区神宮前", chiban="1-1"),
        UploadedProperty(location="", chiban="2-2"),
    ]
    assert detect_prefecture_from_properties(props) == "東京都"


def test_detect_prefecture_from_properties_empty():
    props = [UploadedProperty(location="渋谷区", chiban="1-1")]
    assert detect_prefecture_from_properties(props) == ""


def test_detect_city_from_properties():
    props = [
        UploadedProperty(location="東京都渋谷区神宮前", chiban="1-1"),
    ]
    assert detect_city_from_properties(props) == "渋谷区"


def test_detect_city_from_properties_empty():
    props = [UploadedProperty(location="どこか", chiban="")]
    assert detect_city_from_properties(props) == ""


def test_parse_number():
    assert _parse_number("1,234.56") == 1234.56
    assert _parse_number("100") == 100.0
    assert _parse_number("") is None
    assert _parse_number("abc") is None


def test_parse_int():
    assert _parse_int("1,000,000") == 1000000
    assert _parse_int("500") == 500
    assert _parse_int("") is None
    assert _parse_int("abc") is None
