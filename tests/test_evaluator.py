"""評価ロジックのテスト."""

from src.evaluator import LandEvaluator
from src.models import LandEvaluationBase, LandShape, ZoneType


def test_parse_address():
    result = LandEvaluationBase(input_address="東京都渋谷区神宮前1-1-1")
    LandEvaluator._parse_address(result)
    assert result.prefecture == "東京都"
    assert result.municipality == "渋谷区"


def test_parse_address_city():
    result = LandEvaluationBase(input_address="大阪府大阪市北区梅田1-1")
    LandEvaluator._parse_address(result)
    assert result.prefecture == "大阪府"
    assert result.municipality == "大阪市"


def test_map_zone_type():
    assert LandEvaluator._map_zone_type("商業地域") == ZoneType.COMMERCIAL
    assert LandEvaluator._map_zone_type("不明な値") == ZoneType.UNKNOWN


def test_map_land_shape():
    assert LandEvaluator._map_land_shape("不整形") == LandShape.IRREGULAR
    assert LandEvaluator._map_land_shape("整形") == LandShape.RECTANGULAR
    assert LandEvaluator._map_land_shape("???") == LandShape.UNKNOWN
