"""モデルの基本テスト."""

from src.models import (
    FloorArea,
    HazardInfo,
    KoteiShisanLand,
    MultiplierInfo,
    NochiDaicho,
    OwnershipEntry,
    OwnershipResult,
    PropertyEvaluation,
    TohonBuilding,
    TohonLand,
    ZoningInfo,
)


def test_property_evaluation_defaults():
    ev = PropertyEvaluation()
    assert ev.property_id == 0
    assert ev.zoning.zone_type == ""
    assert ev.hazard.flood_risk == ""
    assert ev.multiplier.is_rosenka_area is None


def test_tohon_land():
    land = TohonLand(
        location="渋谷区神宮前",
        chiban="1-1",
        chimoku_registry="宅地",
        area_registry_sqm=200.5,
    )
    assert land.area_registry_sqm == 200.5
    assert land.chimoku_registry == "宅地"


def test_tohon_building_with_floors():
    bld = TohonBuilding(
        kaoku_bango="1番1",
        structure="木造瓦葺2階建",
        floor_areas=[
            FloorArea(floor="1階", area_sqm=80.5),
            FloorArea(floor="2階", area_sqm=60.0),
        ],
    )
    assert len(bld.floor_areas) == 2
    assert bld.floor_areas[0].area_sqm == 80.5


def test_kotei_land():
    land = KoteiShisanLand(
        location="水戸市赤塚",
        chiban="100-1",
        chimoku_tax="宅地",
        area_tax_sqm=200.0,
        assessed_value=50000000,
    )
    assert land.assessed_value == 50000000


def test_nochi_daicho():
    nochi = NochiDaicho(
        location="水戸市飯富町",
        chiban="200",
        chimoku="田",
        farm_category="第1種農地",
        farmer_name="鈴木花子",
        right_type="賃借権",
    )
    assert nochi.farm_category == "第1種農地"
    assert nochi.right_type == "賃借権"


def test_multiplier_info_rosenka():
    info = MultiplierInfo(is_rosenka_area=True, residential_multiplier="路線")
    assert info.is_rosenka_area is True


def test_multiplier_info_bairitsu():
    info = MultiplierInfo(is_rosenka_area=False, residential_multiplier="1.1")
    assert info.is_rosenka_area is False


def test_property_evaluation_convenience_properties():
    ev = PropertyEvaluation(
        tohon_land=TohonLand(location="水戸市", chiban="1-1", chimoku_registry="宅地", area_registry_sqm=100.0),
        kotei_land=KoteiShisanLand(chimoku_tax="雑種地", area_tax_sqm=105.0, assessed_value=30000000),
    )
    assert ev.location == "水戸市"
    assert ev.chiban == "1-1"
    assert ev.chimoku_registry == "宅地"
    assert ev.chimoku_tax == "雑種地"
    assert ev.area_registry_sqm == 100.0
    assert ev.area_tax_sqm == 105.0
    assert ev.assessed_value == 30000000
