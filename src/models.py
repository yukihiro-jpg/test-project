"""相続税土地評価に必要なデータモデル定義."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class ZoneType(str, Enum):
    """用途地域区分."""

    RESIDENTIAL_1 = "第一種低層住居専用地域"
    RESIDENTIAL_2 = "第二種低層住居専用地域"
    RESIDENTIAL_MID_1 = "第一種中高層住居専用地域"
    RESIDENTIAL_MID_2 = "第二種中高層住居専用地域"
    RESIDENTIAL_GENERAL_1 = "第一種住居地域"
    RESIDENTIAL_GENERAL_2 = "第二種住居地域"
    SEMI_RESIDENTIAL = "準住居地域"
    COMMERCIAL_NEIGHBORHOOD = "近隣商業地域"
    COMMERCIAL = "商業地域"
    SEMI_INDUSTRIAL = "準工業地域"
    INDUSTRIAL = "工業地域"
    INDUSTRIAL_EXCLUSIVE = "工業専用地域"
    URBANIZATION_CONTROL = "市街化調整区域"
    UNDESIGNATED = "無指定"
    UNKNOWN = "不明"


class LandShape(str, Enum):
    """土地形状."""

    RECTANGULAR = "整形"
    IRREGULAR = "不整形"
    FLAG_SHAPED = "旗竿地"
    TRIANGULAR = "三角形"
    TRAPEZOIDAL = "台形"
    UNKNOWN = "不明"


class UrbanPlanningArea(str, Enum):
    """都市計画区域区分."""

    URBANIZATION_PROMOTION = "市街化区域"
    URBANIZATION_CONTROL = "市街化調整区域"
    NON_DIVIDED = "非線引き区域"
    OUTSIDE = "都市計画区域外"
    UNKNOWN = "不明"


@dataclass
class OfficialLandPrice:
    """公示地価・基準地価."""

    year: int
    price_per_sqm: int  # 円/㎡
    location_name: str
    distance_m: Optional[float] = None  # 対象地からの距離(m)


@dataclass
class TransactionRecord:
    """不動産取引価格情報."""

    transaction_date: str
    price_per_sqm: Optional[int] = None  # 円/㎡
    total_price: Optional[int] = None  # 総額
    land_area_sqm: Optional[float] = None
    zone_type: Optional[str] = None
    land_shape: Optional[str] = None
    front_road_width_m: Optional[float] = None
    front_road_direction: Optional[str] = None
    nearest_station: Optional[str] = None
    station_distance_min: Optional[int] = None


@dataclass
class HazardInfo:
    """ハザード情報."""

    flood_risk_level: Optional[str] = None  # 洪水リスクレベル
    flood_depth_m: Optional[float] = None  # 想定浸水深(m)
    landslide_risk: Optional[bool] = None  # 土砂災害リスク
    tsunami_risk_level: Optional[str] = None  # 津波リスクレベル


@dataclass
class LandEvaluationBase:
    """相続税評価 基礎情報一覧.

    地番を入力として、MCP連携で取得した情報を集約する。
    """

    # --- 基本情報 ---
    input_address: str  # 入力住所・地番
    prefecture: str = ""
    municipality: str = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    # --- 用途地域・都市計画 ---
    zone_type: ZoneType = ZoneType.UNKNOWN
    urban_planning_area: UrbanPlanningArea = UrbanPlanningArea.UNKNOWN
    building_coverage_ratio: Optional[float] = None  # 建ぺい率(%)
    floor_area_ratio: Optional[float] = None  # 容積率(%)

    # --- 土地情報 ---
    land_area_sqm: Optional[float] = None  # 地積(㎡)
    land_shape: LandShape = LandShape.UNKNOWN
    front_road_width_m: Optional[float] = None  # 前面道路幅員(m)
    front_road_direction: Optional[str] = None  # 前面道路方位

    # --- 価格情報 ---
    official_land_prices: list[OfficialLandPrice] = field(default_factory=list)
    transaction_records: list[TransactionRecord] = field(default_factory=list)

    # --- 交通情報 ---
    nearest_station: Optional[str] = None
    station_distance_min: Optional[int] = None  # 最寄駅距離(分)

    # --- ハザード情報 ---
    hazard_info: HazardInfo = field(default_factory=HazardInfo)

    # --- メタ情報 ---
    data_sources: list[str] = field(default_factory=list)
    retrieval_date: str = ""
    notes: list[str] = field(default_factory=list)
