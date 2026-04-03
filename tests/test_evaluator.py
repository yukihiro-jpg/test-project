"""サービス層のテスト."""

from src.services.tile_utils import latlng_to_tile
from src.services.nta_scraper import MultiplierRow, lookup_multiplier, _clean_text


def test_latlng_to_tile_tokyo():
    """東京駅付近のタイル座標変換."""
    z, x, y = latlng_to_tile(35.6812, 139.7671, zoom=15)
    assert z == 15
    assert 29000 < x < 30000
    assert 12000 < y < 14000


def test_latlng_to_tile_osaka():
    """大阪駅付近のタイル座標変換."""
    z, x, y = latlng_to_tile(34.7025, 135.4959, zoom=15)
    assert z == 15
    assert x > 0
    assert y > 0


def test_lookup_multiplier_found():
    rows = [
        MultiplierRow("神宮前一丁目", "全域", "D", "路線", "純 28", "純 24", "純 30", ""),
        MultiplierRow("神宮前二丁目", "全域", "D", "1.1", "純 28", "純 24", "純 30", ""),
    ]
    info = lookup_multiplier(rows, "神宮前一丁目")
    assert info.is_rosenka_area is True
    assert info.residential_multiplier == "路線"
    assert info.leasehold_ratio == "D"


def test_lookup_multiplier_bairitsu():
    rows = [
        MultiplierRow("大字下田", "全域", "C", "1.1", "純 20", "純 18", "純 12", "純 8"),
    ]
    info = lookup_multiplier(rows, "大字下田")
    assert info.is_rosenka_area is False
    assert info.residential_multiplier == "1.1"


def test_lookup_multiplier_not_found():
    rows = [
        MultiplierRow("神宮前一丁目", "全域", "D", "路線", "", "", "", ""),
    ]
    info = lookup_multiplier(rows, "存在しない町名")
    assert info.town_name == ""


def test_clean_text():
    assert _clean_text("  hello  world  ") == "hello world"
    assert _clean_text("\n\t test \n") == "test"
