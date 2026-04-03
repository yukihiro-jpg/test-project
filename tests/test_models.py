"""モデルの基本テスト."""

from src.models import (
    HazardInfo,
    MultiplierInfo,
    PropertyEvaluation,
    UploadedProperty,
    ZoningInfo,
)


def test_property_evaluation_defaults():
    ev = PropertyEvaluation()
    assert ev.property_id == 0
    assert ev.zoning.zone_type == ""
    assert ev.hazard.flood_risk == ""
    assert ev.multiplier.is_rosenka_area is True


def test_uploaded_property():
    prop = UploadedProperty(
        location="渋谷区神宮前",
        chiban="1-1",
        chimoku="宅地",
        land_area_sqm=200.5,
        fixed_asset_value=50000000,
    )
    assert prop.land_area_sqm == 200.5
    assert prop.fixed_asset_value == 50000000


def test_multiplier_info_rosenka():
    info = MultiplierInfo(is_rosenka_area=True, residential_multiplier="路線")
    assert info.is_rosenka_area is True


def test_multiplier_info_bairitsu():
    info = MultiplierInfo(is_rosenka_area=False, residential_multiplier="1.1")
    assert info.is_rosenka_area is False
