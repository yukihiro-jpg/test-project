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

# 国土数値情報 洪水浸水想定区域 浸水深ランクコード → 表示文字列
_FLOOD_DEPTH_RANK = {
    "1": "0.5m未満",
    "2": "0.5〜3.0m",
    "3": "3.0〜5.0m",
    "4": "5.0〜10.0m",
    "5": "10.0〜20.0m",
    "6": "20.0m以上",
}

# 国土数値情報 土砂災害警戒区域 区域区分コード
_DOSHASAIGAI_TYPE = {
    "1": "土砂災害警戒区域",
    "2": "土砂災害特別警戒区域",
}

# 国土数値情報 津波浸水想定 浸水深ランク
_TSUNAMI_DEPTH_RANK = {
    "1": "0.3m未満",
    "2": "0.3〜1.0m",
    "3": "1.0〜2.0m",
    "4": "2.0〜5.0m",
    "5": "5.0〜10.0m",
    "6": "10.0〜20.0m",
    "7": "20.0m以上",
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
                props = features[0].get("properties", {})
                # キー名と値の両方をログ出力（フィールドマッピング確認用）
                logger.info(
                    "API %s (z=%d,x=%d,y=%d): %d features, props=%s",
                    endpoint_code, z, x, y, len(features),
                    {k: v for k, v in props.items() if not k.startswith("_")},
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

        props = features[0].get("properties", {})
        # 公式プロパティ名の候補を順に試行
        info.zone_type = (
            props.get("use_district_ja")       # 実APIで確認された名称
            or props.get("用途地域")
            or props.get("YoutoName")
            or props.get("youto_chiiki")
            or ""
        )
        info.building_coverage_ratio = _to_float(
            props.get("building_coverage_ratio")
            or props.get("建ぺい率")
            or props.get("kenpei")
        )
        info.floor_area_ratio = _to_float(
            props.get("floor_area_ratio")
            or props.get("容積率")
            or props.get("youseki")
        )
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
        # XKT001 の実際のプロパティ名: area_classification_ja
        return (
            props.get("area_classification_ja")
            or props.get("区域区分")
            or props.get("AreaName")
            or ""
        )

    # ------------------------------------------------------------------
    # ハザード情報
    # ------------------------------------------------------------------
    async def get_hazard_info(self, lat: float, lng: float) -> HazardInfo:
        """各種ハザード情報を取得."""
        z, x, y = latlng_to_tile(lat, lng, zoom=15)

        info = HazardInfo()

        # 洪水 (XKT026: 国土数値情報 A31a)
        flood = await self._fetch_geojson(ENDPOINTS["flood"], z, x, y)
        if flood:
            info.flood_risk = _parse_flood(flood[0].get("properties", {}))

        # 土砂災害 (XKT029: 国土数値情報 A33)
        landslide = await self._fetch_geojson(ENDPOINTS["landslide"], z, x, y)
        if landslide:
            info.landslide_risk = _parse_landslide(landslide[0].get("properties", {}))

        # 津波 (XKT028: 国土数値情報 A39)
        tsunami = await self._fetch_geojson(ENDPOINTS["tsunami"], z, x, y)
        if tsunami:
            info.tsunami_risk = _parse_tsunami(tsunami[0].get("properties", {}))

        # 高潮 (XKT027: 国土数値情報 A40)
        surge = await self._fetch_geojson(ENDPOINTS["storm_surge"], z, x, y)
        if surge:
            info.storm_surge_risk = _parse_storm_surge(surge[0].get("properties", {}))

        return info

    # ------------------------------------------------------------------
    # 不動産取引事例（前面道路情報の参考取得）
    # ------------------------------------------------------------------
    async def get_road_info_from_transactions(
        self, lat: float, lng: float, area_code: str
    ) -> RoadInfo:
        """周辺の取引事例から前面道路情報を参考取得."""
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


# ======================================================================
# ハザード情報パース（国土数値情報コード体系）
# ======================================================================

def _find_prop(props: dict, *keys: str) -> str:
    """複数の候補キーから最初に見つかった値を返す."""
    for k in keys:
        v = props.get(k)
        if v is not None and str(v).strip():
            return str(v).strip()
    return ""


def _parse_flood(props: dict) -> str:
    """洪水浸水想定区域のプロパティから表示文字列を生成."""
    # 浸水深ランクを探す (A31a_201〜A31a_205 のいずれかに入っている)
    rank = _find_prop(props, "A31a_202", "A31a_201", "depth_rank", "浸水深ランク")
    if rank in _FLOOD_DEPTH_RANK:
        return f"浸水想定 {_FLOOD_DEPTH_RANK[rank]}"

    # ランクコードでなければ直接の浸水深値かもしれない
    depth = _find_prop(props, "A31a_201", "A31a_203", "浸水深", "depth")
    if depth:
        try:
            d = float(depth)
            if d > 0:
                return f"浸水想定 {d:.1f}m"
        except ValueError:
            pass
        return f"浸水想定区域内（{depth}）"

    # フィールドが全くマッチしない場合でもfeatureがあった=区域内
    return "浸水想定区域内"


def _parse_landslide(props: dict) -> str:
    """土砂災害警戒区域のプロパティから表示文字列を生成."""
    type_code = _find_prop(props, "A33_002", "区域区分", "type")
    if type_code in _DOSHASAIGAI_TYPE:
        return _DOSHASAIGAI_TYPE[type_code]

    name = _find_prop(props, "A33_001", "designation_ja", "区域名")
    if name:
        return name

    return "土砂災害警戒区域"


def _parse_tsunami(props: dict) -> str:
    """津波浸水想定のプロパティから表示文字列を生成."""
    rank = _find_prop(props, "A39_002", "A39_001", "depth_rank", "浸水深ランク")
    if rank in _TSUNAMI_DEPTH_RANK:
        return f"津波浸水想定 {_TSUNAMI_DEPTH_RANK[rank]}"

    depth = _find_prop(props, "A39_001", "A39_003", "浸水深", "depth")
    if depth:
        try:
            d = float(depth)
            if d > 0:
                return f"津波浸水想定 {d:.1f}m"
        except ValueError:
            pass
        return f"津波浸水想定区域内（{depth}）"

    return "津波浸水想定区域内"


def _parse_storm_surge(props: dict) -> str:
    """高潮浸水想定区域のプロパティから表示文字列を生成."""
    depth = _find_prop(props, "A40_002", "A40_001", "浸水深", "depth")
    if depth:
        try:
            d = float(depth)
            if d > 0:
                return f"高潮浸水想定 {d:.1f}m"
        except ValueError:
            pass
        return f"高潮浸水想定区域内（{depth}）"

    return "高潮浸水想定区域内"


def _to_float(value: Any) -> Optional[float]:
    """数値変換ヘルパー."""
    if value is None:
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None
