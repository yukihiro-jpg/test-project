"""相続税土地評価 基礎情報集約サービス.

MCPクライアントから取得したデータを解析し、
LandEvaluationBase（基礎情報一覧）に集約する。
"""

from __future__ import annotations

import asyncio
import logging
from datetime import date
from typing import Any, Optional

from .models import (
    HazardInfo,
    LandEvaluationBase,
    LandShape,
    OfficialLandPrice,
    TransactionRecord,
    UrbanPlanningArea,
    ZoneType,
)
from .mcp_client import MLITMCPClient

logger = logging.getLogger(__name__)


class LandEvaluator:
    """土地の相続税評価に必要な基礎情報を収集・集約する."""

    def __init__(self, mcp_client: MLITMCPClient):
        self.mcp = mcp_client

    async def evaluate(
        self,
        address: str,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
    ) -> LandEvaluationBase:
        """地番・住所から相続税評価の基礎情報を収集.

        Args:
            address: 住所または地番（例: "東京都渋谷区神宮前1-1-1"）
            latitude: 緯度（既知の場合）
            longitude: 経度（既知の場合）

        Returns:
            LandEvaluationBase: 相続税評価基礎情報一覧
        """
        result = LandEvaluationBase(
            input_address=address,
            retrieval_date=date.today().isoformat(),
        )

        # Step 1: 住所から座標を特定（未指定の場合）
        if latitude is None or longitude is None:
            coords = await self._resolve_coordinates(address)
            if coords:
                latitude, longitude = coords
                result.latitude = latitude
                result.longitude = longitude
                result.data_sources.append("住所検索")
            else:
                result.notes.append("座標の特定ができませんでした。手動で緯度経度を指定してください。")
                return result
        else:
            result.latitude = latitude
            result.longitude = longitude

        # Step 2: 各種データを並行取得
        (
            land_prices,
            transactions,
            zoning,
            hazard,
            urban_planning,
        ) = await asyncio.gather(
            self._fetch_land_prices(latitude, longitude),
            self._fetch_transactions(latitude, longitude),
            self._fetch_zoning(latitude, longitude),
            self._fetch_hazard(latitude, longitude),
            self._fetch_urban_planning(latitude, longitude),
            return_exceptions=True,
        )

        # Step 3: 各結果を基礎情報に集約
        if isinstance(land_prices, list):
            result.official_land_prices = land_prices
            result.data_sources.append("公示地価・基準地価")
        else:
            logger.warning("公示地価取得エラー: %s", land_prices)
            result.notes.append(f"公示地価の取得に失敗: {land_prices}")

        if isinstance(transactions, list):
            result.transaction_records = transactions
            self._extract_land_info_from_transactions(result, transactions)
            result.data_sources.append("不動産取引価格情報")
        else:
            logger.warning("取引価格取得エラー: %s", transactions)
            result.notes.append(f"取引価格情報の取得に失敗: {transactions}")

        if isinstance(zoning, dict):
            result.zone_type = zoning.get("zone_type", ZoneType.UNKNOWN)
            result.building_coverage_ratio = zoning.get("building_coverage_ratio")
            result.floor_area_ratio = zoning.get("floor_area_ratio")
            result.data_sources.append("用途地域情報")
        else:
            logger.warning("用途地域取得エラー: %s", zoning)

        if isinstance(hazard, HazardInfo):
            result.hazard_info = hazard
            result.data_sources.append("ハザード情報")
        else:
            logger.warning("ハザード情報取得エラー: %s", hazard)

        if isinstance(urban_planning, dict):
            result.urban_planning_area = urban_planning.get(
                "area_type", UrbanPlanningArea.UNKNOWN
            )
            result.data_sources.append("都市計画情報")
        else:
            logger.warning("都市計画情報取得エラー: %s", urban_planning)

        # Step 4: 住所情報の補完
        self._parse_address(result)

        return result

    async def _resolve_coordinates(
        self, address: str
    ) -> Optional[tuple[float, float]]:
        """住所から緯度経度を解決."""
        try:
            results = await self.mcp.search_by_address(address)
            for r in results:
                lat = r.get("latitude") or r.get("lat")
                lng = r.get("longitude") or r.get("lng") or r.get("lon")
                if lat and lng:
                    return float(lat), float(lng)
        except Exception as e:
            logger.error("座標解決エラー: %s", e)
        return None

    async def _fetch_land_prices(
        self, lat: float, lng: float
    ) -> list[OfficialLandPrice]:
        """公示地価・基準地価を取得しモデルに変換."""
        raw = await self.mcp.search_official_land_prices(lat, lng)
        prices = []
        for item in raw:
            try:
                price = OfficialLandPrice(
                    year=int(item.get("year", 0)),
                    price_per_sqm=int(item.get("price", 0)),
                    location_name=item.get("location", ""),
                    distance_m=item.get("distance"),
                )
                prices.append(price)
            except (ValueError, TypeError) as e:
                logger.debug("地価データパースエラー: %s", e)
        return prices

    async def _fetch_transactions(
        self, lat: float, lng: float
    ) -> list[TransactionRecord]:
        """不動産取引価格情報を取得しモデルに変換."""
        raw = await self.mcp.search_transaction_prices(lat, lng)
        records = []
        for item in raw:
            try:
                record = TransactionRecord(
                    transaction_date=item.get("date", ""),
                    price_per_sqm=item.get("price_per_sqm"),
                    total_price=item.get("total_price"),
                    land_area_sqm=item.get("area"),
                    zone_type=item.get("zone_type"),
                    land_shape=item.get("land_shape"),
                    front_road_width_m=item.get("road_width"),
                    front_road_direction=item.get("road_direction"),
                    nearest_station=item.get("station"),
                    station_distance_min=item.get("station_distance"),
                )
                records.append(record)
            except (ValueError, TypeError) as e:
                logger.debug("取引データパースエラー: %s", e)
        return records

    async def _fetch_zoning(
        self, lat: float, lng: float
    ) -> dict[str, Any]:
        """用途地域情報を取得."""
        raw = await self.mcp.search_zoning_info(lat, lng)
        if not raw:
            return {}
        item = raw[0] if raw else {}
        return {
            "zone_type": self._map_zone_type(item.get("zone_type", "")),
            "building_coverage_ratio": item.get("building_coverage_ratio"),
            "floor_area_ratio": item.get("floor_area_ratio"),
        }

    async def _fetch_hazard(self, lat: float, lng: float) -> HazardInfo:
        """ハザード情報を取得."""
        raw = await self.mcp.search_hazard_info(lat, lng)
        info = HazardInfo()
        for item in raw:
            title = item.get("title", "").lower()
            if "洪水" in title or "flood" in title:
                info.flood_risk_level = item.get("risk_level")
                info.flood_depth_m = item.get("depth")
            elif "土砂" in title or "landslide" in title:
                info.landslide_risk = True
            elif "津波" in title or "tsunami" in title:
                info.tsunami_risk_level = item.get("risk_level")
        return info

    async def _fetch_urban_planning(
        self, lat: float, lng: float
    ) -> dict[str, Any]:
        """都市計画情報を取得."""
        raw = await self.mcp.search_urban_planning(lat, lng)
        if not raw:
            return {}
        item = raw[0] if raw else {}
        return {
            "area_type": self._map_urban_planning_area(item.get("area_type", "")),
        }

    def _extract_land_info_from_transactions(
        self, result: LandEvaluationBase, transactions: list[TransactionRecord]
    ) -> None:
        """取引データから土地情報を補完."""
        for tx in transactions:
            if tx.nearest_station and not result.nearest_station:
                result.nearest_station = tx.nearest_station
                result.station_distance_min = tx.station_distance_min
            if tx.front_road_width_m and not result.front_road_width_m:
                result.front_road_width_m = tx.front_road_width_m
                result.front_road_direction = tx.front_road_direction
            if tx.land_shape and result.land_shape == LandShape.UNKNOWN:
                result.land_shape = self._map_land_shape(tx.land_shape)

    @staticmethod
    def _parse_address(result: LandEvaluationBase) -> None:
        """住所文字列から都道府県・市区町村を抽出."""
        address = result.input_address
        prefectures = [
            "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
            "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
            "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
            "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
            "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
            "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
            "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
        ]
        for pref in prefectures:
            if address.startswith(pref):
                result.prefecture = pref
                remaining = address[len(pref):]
                # 市区町村を抽出（市・区・町・村で終わる最短マッチ）
                for suffix in ["市", "区", "町", "村"]:
                    idx = remaining.find(suffix)
                    if idx >= 0:
                        result.municipality = remaining[: idx + 1]
                        break
                break

    @staticmethod
    def _map_zone_type(zone_str: str) -> ZoneType:
        """文字列を用途地域Enumにマッピング."""
        # 完全一致を優先
        for zt in ZoneType:
            if zt.value == zone_str:
                return zt
        # 長い値から部分一致（「商業地域」が「近隣商業地域」に誤マッチしないよう）
        sorted_types = sorted(ZoneType, key=lambda z: len(z.value), reverse=True)
        for zt in sorted_types:
            if zt == ZoneType.UNKNOWN:
                continue
            if zt.value in zone_str or zone_str in zt.value:
                return zt
        return ZoneType.UNKNOWN

    @staticmethod
    def _map_land_shape(shape_str: str) -> LandShape:
        """文字列を土地形状Enumにマッピング."""
        mapping = [
            ("不整形", LandShape.IRREGULAR),
            ("旗竿", LandShape.FLAG_SHAPED),
            ("台形", LandShape.TRAPEZOIDAL),
            ("整形", LandShape.RECTANGULAR),
        ]
        for key, value in mapping:
            if key in shape_str:
                return value
        return LandShape.UNKNOWN

    @staticmethod
    def _map_urban_planning_area(area_str: str) -> UrbanPlanningArea:
        """文字列を都市計画区域Enumにマッピング."""
        for upa in UrbanPlanningArea:
            if upa.value in area_str or area_str in upa.value:
                return upa
        return UrbanPlanningArea.UNKNOWN
