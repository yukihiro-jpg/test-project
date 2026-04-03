"""相続税土地評価に必要なデータモデル定義."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class UploadedProperty:
    """アップロード書類から抽出した不動産情報."""

    # 謄本・評価証明書等から抽出
    location: str = ""          # 所在
    chiban: str = ""            # 地番
    chimoku: str = ""           # 地目（登記簿上）
    land_area_sqm: Optional[float] = None  # 地積(㎡)
    owner: str = ""             # 所有者
    fixed_asset_value: Optional[int] = None  # 固定資産税評価額(円)
    chimoku_kazeicho: str = ""  # 地目（課税明細上）
    source_file: str = ""       # 抽出元ファイル名


@dataclass
class ZoningInfo:
    """用途地域・都市計画情報（不動産情報ライブラリAPI取得）."""

    zone_type: str = ""                       # 用途地域（例: 商業地域）
    building_coverage_ratio: Optional[float] = None  # 建ぺい率(%)
    floor_area_ratio: Optional[float] = None         # 容積率(%)
    urban_planning_area: str = ""             # 都市計画区域区分


@dataclass
class RoadInfo:
    """前面道路情報."""

    road_width_m: Optional[float] = None     # 幅員(m)
    road_direction: str = ""                 # 方位（東・西・南・北）
    road_type: str = ""                      # 種類（国道・市道等）


@dataclass
class HazardInfo:
    """ハザード情報（不動産情報ライブラリ/ハザードマップポータル取得）."""

    flood_risk: str = ""           # 洪水浸水想定（例: 0.5m未満, 3m以上）
    landslide_risk: str = ""       # 土砂災害警戒区域（警戒/特別警戒/なし）
    tsunami_risk: str = ""         # 津波浸水想定
    storm_surge_risk: str = ""     # 高潮浸水想定


@dataclass
class MultiplierInfo:
    """評価倍率情報（国税庁スクレイピング取得）."""

    is_rosenka_area: bool = True   # True=路線価地域, False=倍率地域
    residential_multiplier: str = ""  # 宅地の倍率（数値 or "路線"）
    paddy_multiplier: str = ""     # 田の倍率
    field_multiplier: str = ""     # 畑の倍率
    forest_multiplier: str = ""    # 山林の倍率
    wasteland_multiplier: str = ""  # 原野の倍率
    leasehold_ratio: str = ""      # 借地権割合 (A~G)
    area_name: str = ""            # 適用地域名
    town_name: str = ""            # 町名


@dataclass
class PropertyEvaluation:
    """不動産評価 基礎情報一覧（1筆分）."""

    # 識別情報
    property_id: int = 0
    address: str = ""              # 所在地番

    # アップロード書類から抽出
    uploaded: UploadedProperty = field(default_factory=UploadedProperty)

    # 座標
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    # API取得情報
    zoning: ZoningInfo = field(default_factory=ZoningInfo)
    road: RoadInfo = field(default_factory=RoadInfo)
    hazard: HazardInfo = field(default_factory=HazardInfo)

    # 国税庁スクレイピング
    multiplier: MultiplierInfo = field(default_factory=MultiplierInfo)

    # メタ情報
    data_sources: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)
