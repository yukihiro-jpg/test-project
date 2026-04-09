"""不動産情報ライブラリAPI クライアント.

用途地域、建ぺい率・容積率、都市計画区域、ハザード情報を取得する。
https://www.reinfolib.mlit.go.jp/help/apiManual/
"""

from __future__ import annotations

import logging
from typing import Any, Optional

import httpx

from ..config import config
from ..models import HazardInfo, RoadInfo, ZoningInfo
from .tile_utils import latlng_to_tile

logger = logging.getLogger(__name__)

# 不動産情報ライブラリAPIのエンドポイント
ENDPOINTS = {
    "zoning": "XKT002",           # 都市計画決定GISデータ（用途地域）
    "urban_area": "XKT001",       # 都市計画決定GISデータ（都市計画区域/区域区分）
    "flood": "XKT026",            # 洪水浸水想定区域（想定最大規模）
    "landslide": "XKT029",        # 土砂災害警戒区域
    "tsunami": "XKT028",          # 津波浸水想定
    "storm_surge": "XKT027",      # 高潮浸水想定区域
    "transaction": "XIT001",      # 不動産取引価格情報
}


class ReinfolibClient:
    """不動産情報ライブラリAPIクライアント."""

    def __init__(self, api_key: str = ""):
        self.api_key = api_key or config.reinfolib_api_key
        self.base_url = config.reinfolib_base_url
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                timeout=15.0,
                headers={"Ocp-Apim-Subscription-Key": self.api_key},
            )
        return self._client

    async def close(self) -> None:
        if self._client:
            await self._client.aclose()
            self._client = None

    async def _fetch_geojson(
        self, endpoint_code: str, z: int, x: int, y: int
    ) -> list[dict[str, Any]]:
        """タイル座標指定でGeoJSONデータを取得."""
        url = f"{self.base_url}/{endpoint_code}?z={z}&x={x}&y={y}&response_format=geojson"
        client = await self._get_client()
        try:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
            features = data.get("features", [])
            if features:
                logger.info(
                    "API %s (z=%d,x=%d,y=%d): %d features, props=%s",
                    endpoint_code, z, x, y, len(features),
                    list(features[0].get("properties", {}).keys()),
                )
            else:
                logger.info("API %s (z=%d,x=%d,y=%d): 0 features", endpoint_code, z, x, y)
            return features
        except httpx.HTTPStatusError as e:
            logger.warning("API %s エラー (HTTP %d): %s", endpoint_code, e.response.status_code, e)
            return []
        except Exception as e:
            logger.warning("API %s 取得失敗: %s", endpoint_code, e)
            return []

    # ------------------------------------------------------------------
    # 用途地域
    # ------------------------------------------------------------------
    async def get_zoning(self, lat: float, lng: float) -> ZoningInfo:
        """用途地域・建ぺい率・容積率を取得."""
        z, x, y = latlng_to_tile(lat, lng, zoom=15)
        features = await self._fetch_geojson(ENDPOINTS["zoning"], z, x, y)

        info = ZoningInfo()
        if not features:
            return info

        # 対象座標に最も近いフィーチャーを使用（簡易的に先頭を採用）
        props = features[0].get("properties", {})
        info.zone_type = props.get("用途地域", props.get("YoutoName", ""))
        info.building_coverage_ratio = _to_float(props.get("建ぺい率", props.get("kenpei")))
        info.floor_area_ratio = _to_float(props.get("容積率", props.get("youseki")))
        return info

    # ------------------------------------------------------------------
    # 都市計画区域
    # ------------------------------------------------------------------
    async def get_urban_planning_area(self, lat: float, lng: float) -> str:
        """都市計画区域区分（市街化区域/調整区域等）を取得."""
        z, x, y = latlng_to_tile(lat, lng, zoom=15)
        features = await self._fetch_geojson(ENDPOINTS["urban_area"], z, x, y)

        if not features:
            return ""
        props = features[0].get("properties", {})
        return props.get("区域区分", props.get("AreaName", ""))

    # ------------------------------------------------------------------
    # ハザード情報
    # ------------------------------------------------------------------
    async def get_hazard_info(self, lat: float, lng: float) -> HazardInfo:
        """各種ハザード情報を取得."""
        z, x, y = latlng_to_tile(lat, lng, zoom=15)

        info = HazardInfo()

        # 洪水
        flood = await self._fetch_geojson(ENDPOINTS["flood"], z, x, y)
        if flood:
            props = flood[0].get("properties", {})
            depth = props.get("浸水深", props.get("depth", ""))
            info.flood_risk = str(depth) if depth else "浸水想定区域内"

        # 土砂災害
        landslide = await self._fetch_geojson(ENDPOINTS["landslide"], z, x, y)
        if landslide:
            props = landslide[0].get("properties", {})
            info.landslide_risk = props.get("区域区分", props.get("type", "警戒区域"))

        # 津波
        tsunami = await self._fetch_geojson(ENDPOINTS["tsunami"], z, x, y)
        if tsunami:
            props = tsunami[0].get("properties", {})
            depth = props.get("浸水深", props.get("depth", ""))
            info.tsunami_risk = str(depth) if depth else "浸水想定区域内"

        # 高潮
        surge = await self._fetch_geojson(ENDPOINTS["storm_surge"], z, x, y)
        if surge:
            props = surge[0].get("properties", {})
            depth = props.get("浸水深", props.get("depth", ""))
            info.storm_surge_risk = str(depth) if depth else "浸水想定区域内"

        return info

    # ------------------------------------------------------------------
    # 不動産取引事例（前面道路情報の参考取得）
    # ------------------------------------------------------------------
    async def get_road_info_from_transactions(
        self, lat: float, lng: float, area_code: str
    ) -> RoadInfo:
        """周辺の取引事例から前面道路情報を参考取得.

        XIT001の取引データには前面道路の幅員・方位が含まれる。
        """
        url = (
            f"{self.base_url}/{ENDPOINTS['transaction']}"
            f"?year=20234&area={area_code}&response_format=geojson"
        )
        client = await self._get_client()
        info = RoadInfo()
        try:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
            features = data.get("features", [])
            if features:
                props = features[0].get("properties", {})
                info.road_width_m = _to_float(props.get("FrontRoadBreadth"))
                info.road_direction = props.get("FrontRoadDirection", "")
                info.road_type = props.get("FrontRoadKind", "")
        except Exception as e:
            logger.warning("取引情報取得失敗: %s", e)
        return info


def _to_float(value: Any) -> Optional[float]:
    """数値変換ヘルパー."""
    if value is None:
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None
