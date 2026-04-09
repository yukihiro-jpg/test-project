"""相続税土地評価に必要なデータモデル定義."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


# =====================================================================
# 書類抽出: 謄本（全部事項証明書）
# =====================================================================
@dataclass
class OwnershipEntry:
    """甲区（所有権）の1エントリ."""

    registration_date: str = ""        # 受付日（例: 令和3年5月10日）
    cause: str = ""                    # 原因（例: 売買, 相続, 贈与）
    cause_date: str = ""               # 原因日付（例: 令和3年4月1日）
    owner_name: str = ""               # 所有者/共有者名
    share: str = ""                    # 持分（例: "2分の1", "3分の1", ""=単独所有）
    entry_type: str = ""               # 種別（所有権移転, 所有権保存, 持分移転 等）


@dataclass
class OtherRightEntry:
    """乙区（所有権以外の権利）の1エントリ."""

    registration_date: str = ""        # 受付日
    right_type: str = ""               # 権利種別（抵当権, 根抵当権, 地上権, 賃借権 等）
    cause: str = ""                    # 原因
    holder: str = ""                   # 権利者
    details: str = ""                  # 詳細（債権額, 利息 等）


@dataclass
class FloorArea:
    """階別床面積（建物）."""

    floor: str = ""                    # 階（例: "1階", "2階", "地下1階"）
    area_sqm: Optional[float] = None   # 床面積(㎡)


@dataclass
class TohonLand:
    """謄本（全部事項証明書）から抽出した土地情報."""

    location: str = ""                 # 所在
    chiban: str = ""                   # 地番
    chimoku_registry: str = ""         # 登記地目
    area_registry_sqm: Optional[float] = None  # 登記地積(㎡)
    ownership_history: list[OwnershipEntry] = field(default_factory=list)  # 甲区
    other_rights: list[OtherRightEntry] = field(default_factory=list)      # 乙区
    source_file: str = ""


@dataclass
class TohonBuilding:
    """謄本（全部事項証明書）から抽出した建物情報."""

    location: str = ""                 # 所在
    kaoku_bango: str = ""              # 家屋番号
    kind: str = ""                     # 種類（居宅, 店舗, 共同住宅 等）
    structure: str = ""                # 構造（木造瓦葺2階建 等）
    floor_areas: list[FloorArea] = field(default_factory=list)  # 階別床面積（登記）
    ownership_history: list[OwnershipEntry] = field(default_factory=list)
    other_rights: list[OtherRightEntry] = field(default_factory=list)
    source_file: str = ""


# =====================================================================
# 書類抽出: 固定資産評価証明（課税明細書）
# =====================================================================
@dataclass
class KoteiShisanLand:
    """固定資産評価証明/課税明細書から抽出した土地情報."""

    location: str = ""                 # 所在
    chiban: str = ""                   # 地番
    chimoku_registry: str = ""         # 登記地目
    chimoku_tax: str = ""              # 課税地目（現況地目）
    area_registry_sqm: Optional[float] = None  # 登記地積(㎡)
    area_tax_sqm: Optional[float] = None  # 課税地積(㎡)
    assessed_value: Optional[int] = None  # 固定資産税評価額(円)
    source_file: str = ""


@dataclass
class KoteiShisanBuilding:
    """固定資産評価証明/課税明細書から抽出した建物情報."""

    location: str = ""                 # 所在
    kaoku_bango: str = ""              # 家屋番号
    kind: str = ""                     # 種類
    structure: str = ""                # 構造
    area_tax_sqm: Optional[float] = None  # 課税床面積(㎡)
    assessed_value: Optional[int] = None  # 固定資産税評価額(円)
    construction_year: str = ""        # 建築年
    source_file: str = ""


# =====================================================================
# 書類抽出: 名寄帳
# =====================================================================
@dataclass
class NayosechoLand:
    """名寄帳から抽出した土地情報."""

    location: str = ""
    chiban: str = ""
    chimoku_tax: str = ""              # 課税地目
    area_tax_sqm: Optional[float] = None
    assessed_value: Optional[int] = None
    owner: str = ""                    # 所有者（納税義務者）
    share: str = ""                    # 持分
    source_file: str = ""


@dataclass
class NayosechoBuilding:
    """名寄帳から抽出した建物情報."""

    location: str = ""
    kaoku_bango: str = ""
    kind: str = ""
    structure: str = ""
    area_tax_sqm: Optional[float] = None
    assessed_value: Optional[int] = None
    owner: str = ""
    share: str = ""
    construction_year: str = ""
    source_file: str = ""


# =====================================================================
# 書類抽出: 農地台帳（農家基本台帳）
# =====================================================================
@dataclass
class NochiDaicho:
    """農地台帳から抽出した情報."""

    location: str = ""                 # 所在
    chiban: str = ""                   # 地番
    chimoku: str = ""                  # 地目（田/畑）
    area_sqm: Optional[float] = None   # 面積(㎡)
    farm_category: str = ""            # 農地区分（甲種/第1種/第2種/第3種 等）
    farmer_name: str = ""              # 耕作者氏名
    right_type: str = ""               # 権利種別（所有, 賃借権, 使用貸借, 耕作権 等）
    right_holder: str = ""             # 権利者
    source_file: str = ""


# =====================================================================
# API取得情報（変更なし）
# =====================================================================
@dataclass
class ZoningInfo:
    """用途地域・都市計画情報（不動産情報ライブラリAPI取得）."""

    zone_type: str = ""
    building_coverage_ratio: Optional[float] = None
    floor_area_ratio: Optional[float] = None
    urban_planning_area: str = ""


@dataclass
class RoadInfo:
    """前面道路情報."""

    road_width_m: Optional[float] = None
    road_direction: str = ""
    road_type: str = ""


@dataclass
class HazardInfo:
    """ハザード情報."""

    flood_risk: str = ""
    landslide_risk: str = ""
    tsunami_risk: str = ""
    storm_surge_risk: str = ""


@dataclass
class MultiplierInfo:
    """評価倍率情報（国税庁スクレイピング取得）."""

    is_rosenka_area: bool = True
    residential_multiplier: str = ""
    paddy_multiplier: str = ""
    field_multiplier: str = ""
    forest_multiplier: str = ""
    wasteland_multiplier: str = ""
    leasehold_ratio: str = ""
    area_name: str = ""
    town_name: str = ""
    notes: str = ""


# =====================================================================
# 倍率方式 評価結果
# =====================================================================
@dataclass
class ValuationResult:
    """倍率方式による相続税評価額の算出結果."""

    method: str = ""                   # 評価方式（倍率方式 / 路線価方式 / 宅地比準方式 等）
    chimoku_used: str = ""             # 評価に用いた地目（宅地/田/畑/山林/原野）
    multiplier_raw: str = ""           # 倍率表の生値（例: "1.1", "純18", "比準"）
    multiplier_value: Optional[float] = None  # 数値化した倍率（該当しなければNone）
    multiplier_prefix: str = ""        # プレフィックス（純/中/周/比準 等）
    assessed_value: Optional[int] = None    # 固定資産税評価額（円）
    evaluated_value: Optional[int] = None   # 相続税評価額（円, 持分考慮前）
    share_fraction: Optional[float] = None  # 持分
    final_value: Optional[int] = None       # 持分考慮後の評価額（円）
    town_name: str = ""                # 倍率表の町名
    area_name: str = ""                # 倍率表の適用地域名
    leasehold_ratio: str = ""          # 借地権割合
    formula: str = ""                  # 計算式の表示
    warnings: list[str] = field(default_factory=list)  # 評価上の注意点


# =====================================================================
# 書類間整合性チェック
# =====================================================================
@dataclass
class ConsistencyCheck:
    """書類間の整合性チェック結果（1項目分）."""

    field_name: str = ""               # 項目名（例: "登記地目", "地積"）
    tohon_value: str = ""              # 謄本の値
    other_value: str = ""              # 比較対象の値
    other_source: str = ""             # 比較対象の書類名
    is_match: bool = True              # 一致しているか
    message: str = ""                  # メッセージ


# =====================================================================
# 持分計算結果
# =====================================================================
@dataclass
class OwnershipResult:
    """基準日時点の持分算出結果."""

    target_name: str = ""              # 対象者名
    reference_date: str = ""           # 基準日
    current_share: str = ""            # 基準日時点の持分（例: "2分の1", "単独所有"）
    share_fraction: Optional[float] = None  # 持分の数値（例: 0.5）
    history_summary: list[str] = field(default_factory=list)  # 変遷の要約


# =====================================================================
# 統合: 不動産1筆の評価基礎情報
# =====================================================================
@dataclass
class PropertyEvaluation:
    """不動産評価 基礎情報一覧（1筆分）."""

    # 識別情報
    property_id: int = 0
    property_type: str = ""            # "土地" or "建物"
    address: str = ""                  # 所在地番

    # 謄本（全部事項証明書）抽出
    tohon_land: Optional[TohonLand] = None
    tohon_building: Optional[TohonBuilding] = None

    # 固定資産評価証明/課税明細書 抽出
    kotei_land: Optional[KoteiShisanLand] = None
    kotei_building: Optional[KoteiShisanBuilding] = None

    # 名寄帳 抽出
    nayosecho_land: Optional[NayosechoLand] = None
    nayosecho_building: Optional[NayosechoBuilding] = None

    # 農地台帳 抽出
    nochi_daicho: Optional[NochiDaicho] = None

    # 持分算出結果
    ownership: OwnershipResult = field(default_factory=OwnershipResult)

    # 座標
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    # API取得情報
    zoning: ZoningInfo = field(default_factory=ZoningInfo)
    road: RoadInfo = field(default_factory=RoadInfo)
    hazard: HazardInfo = field(default_factory=HazardInfo)

    # 国税庁スクレイピング
    multiplier: MultiplierInfo = field(default_factory=MultiplierInfo)

    # 倍率方式 評価結果
    valuation: Optional[ValuationResult] = None

    # 書類間整合性チェック
    consistency_checks: list[ConsistencyCheck] = field(default_factory=list)

    # メタ情報
    data_sources: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)

    # ---- 便利プロパティ ----
    @property
    def location(self) -> str:
        """所在（謄本優先）."""
        if self.tohon_land:
            return self.tohon_land.location
        if self.tohon_building:
            return self.tohon_building.location
        if self.kotei_land:
            return self.kotei_land.location
        if self.kotei_building:
            return self.kotei_building.location
        if self.nayosecho_land:
            return self.nayosecho_land.location
        if self.nochi_daicho:
            return self.nochi_daicho.location
        return ""

    @property
    def chiban(self) -> str:
        """地番（謄本優先）."""
        if self.tohon_land:
            return self.tohon_land.chiban
        if self.kotei_land:
            return self.kotei_land.chiban
        if self.nayosecho_land:
            return self.nayosecho_land.chiban
        if self.nochi_daicho:
            return self.nochi_daicho.chiban
        return ""

    @property
    def chimoku_registry(self) -> str:
        """登記地目（謄本から）."""
        if self.tohon_land:
            return self.tohon_land.chimoku_registry
        return ""

    @property
    def chimoku_tax(self) -> str:
        """課税地目（固定資産評価証明/名寄帳から）."""
        if self.kotei_land:
            return self.kotei_land.chimoku_tax
        if self.nayosecho_land:
            return self.nayosecho_land.chimoku_tax
        return ""

    @property
    def area_registry_sqm(self) -> Optional[float]:
        """登記地積."""
        if self.tohon_land:
            return self.tohon_land.area_registry_sqm
        return None

    @property
    def area_tax_sqm(self) -> Optional[float]:
        """課税地積."""
        if self.kotei_land:
            return self.kotei_land.area_tax_sqm
        if self.nayosecho_land:
            return self.nayosecho_land.area_tax_sqm
        return None

    @property
    def assessed_value(self) -> Optional[int]:
        """固定資産税評価額."""
        if self.kotei_land:
            return self.kotei_land.assessed_value
        if self.nayosecho_land:
            return self.nayosecho_land.assessed_value
        if self.kotei_building:
            return self.kotei_building.assessed_value
        if self.nayosecho_building:
            return self.nayosecho_building.assessed_value
        return None
