"""モデルの基本テスト."""

from src.models import (
    HazardInfo,
    LandEvaluationBase,
    LandShape,
    OfficialLandPrice,
    TransactionRecord,
    ZoneType,
)


def test_land_evaluation_base_defaults():
    base = LandEvaluationBase(input_address="東京都渋谷区神宮前1-1-1")
    assert base.input_address == "東京都渋谷区神宮前1-1-1"
    assert base.zone_type == ZoneType.UNKNOWN
    assert base.land_shape == LandShape.UNKNOWN
    assert base.official_land_prices == []
    assert base.transaction_records == []


def test_official_land_price():
    price = OfficialLandPrice(
        year=2025,
        price_per_sqm=500000,
        location_name="渋谷-1",
    )
    assert price.price_per_sqm == 500000


def test_hazard_info_defaults():
    info = HazardInfo()
    assert info.flood_risk_level is None
    assert info.landslide_risk is None
