"""WAGRI（農業データ連携基盤）APIクライアント.

統合農地データ取得API v3 を使用して、農業振興地域区分を取得する。
https://wagri.naro.go.jp/
"""

from __future__ import annotations

import logging
import time
from typing import Any, Optional

import httpx

from ..config import config

logger = logging.getLogger(__name__)

TOKEN_URL = "https://api.wagri.net/Token"
FIELDINFO_URL = (
    "https://api.wagri.net/API/Individual/NARO/AgriculturalMap3/fieldinfo"
)
SEARCH_BY_DISTANCE_URL = (
    "https://api.wagri.net/API/Public/AgriculturalLand/SearchByDistance"
)


class WagriClient:
    """WAGRI APIクライアント."""

    def __init__(
        self,
        client_id: str = "",
        client_secret: str = "",
    ):
        self.client_id = client_id or config.wagri_client_id
        self.client_secret = client_secret or config.wagri_client_secret
        self._access_token: str = ""
        self._token_expires_at: float = 0
        self._client: Optional[httpx.AsyncClient] = None

    @property
    def is_configured(self) -> bool:
        """API認証情報が設定されているか."""
        return bool(self.client_id and self.client_secret)

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=30.0)
        return self._client

    async def close(self) -> None:
        if self._client:
            await self._client.aclose()
            self._client = None

    async def _ensure_token(self) -> str:
        """アクセストークンを取得（期限切れなら再取得）."""
        if self._access_token and time.time() < self._token_expires_at:
            return self._access_token

        client = await self._get_client()
        try:
            resp = await client.post(
                TOKEN_URL,
                data={
                    "grant_type": "client_credentials",
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            self._access_token = data["access_token"]
            # expires_in は秒数。余裕を持って60秒前に期限切れとする
            self._token_expires_at = time.time() + data.get("expires_in", 3600) - 60
            logger.info("WAGRI トークン取得成功")
            return self._access_token
        except Exception as e:
            logger.warning("WAGRI トークン取得失敗: %s", e)
            self._access_token = ""
            raise

    async def _auth_headers(self) -> dict[str, str]:
        token = await self._ensure_token()
        return {"X-Authorization": token}

    # ------------------------------------------------------------------
    # 農振区分取得（座標距離検索）
    # ------------------------------------------------------------------
    async def get_agri_zone_by_distance(
        self, lat: float, lng: float, distance_m: int = 50,
    ) -> str:
        """座標から近傍の農地ピン情報を検索し、農振区分を返す.

        Args:
            lat: 緯度
            lng: 経度
            distance_m: 検索半径（メートル）

        Returns:
            農振区分文字列（例: "農業振興地域内・農用地区域内"）、該当なしは空文字
        """
        if not self.is_configured:
            return ""

        try:
            headers = await self._auth_headers()
            client = await self._get_client()
            resp = await client.get(
                SEARCH_BY_DISTANCE_URL,
                headers=headers,
                params={
                    "Latitude": str(lat),
                    "Longitude": str(lng),
                    "Distance": str(distance_m),
                },
            )
            resp.raise_for_status()
            data = resp.json()
            results = data if isinstance(data, list) else data.get("results", data.get("features", []))
            logger.info(
                "WAGRI SearchByDistance (%.6f,%.6f,d=%dm): %d件",
                lat, lng, distance_m, len(results) if isinstance(results, list) else 0,
            )
            if results and isinstance(results, list) and len(results) > 0:
                item = results[0]
                props = item.get("properties", item) if isinstance(item, dict) else {}
                zone = (
                    props.get("PN_AgriVibrationMethodClass_1")
                    or props.get("AgriculturalVibrationMethodClassification")
                    or props.get("農振地域区分")
                    or props.get("agri_zone")
                    or ""
                )
                if zone:
                    logger.info("WAGRI 農振区分: %s", zone)
                    return zone
                # フィールド名が不明な場合はログに全キーを出力
                logger.info("WAGRI 農地ピン props: %s", list(props.keys())[:20])
        except httpx.HTTPStatusError as e:
            logger.warning("WAGRI SearchByDistance HTTP %d: %s", e.response.status_code, e)
        except Exception as e:
            logger.warning("WAGRI SearchByDistance 失敗: %s", e)
        return ""

    # ------------------------------------------------------------------
    # 農振区分取得（市区町村コード＋座標マッチング）
    # ------------------------------------------------------------------
    async def get_agri_zone_by_city(
        self, city_code: str, lat: float, lng: float,
    ) -> str:
        """市区町村コードで農地データを取得し、座標から最寄りの農振区分を返す.

        統合農地データ取得API v3 を使用。データ量が大きいため
        SearchByDistance が使えない場合のフォールバック。
        """
        if not self.is_configured or not city_code:
            return ""

        try:
            headers = await self._auth_headers()
            client = await self._get_client()
            resp = await client.get(
                FIELDINFO_URL,
                headers=headers,
                params={"LocalGovernmentCd": city_code},
            )
            resp.raise_for_status()
            data = resp.json()
            features = data.get("features", [])
            logger.info("WAGRI fieldinfo (%s): %d features", city_code, len(features))

            if not features:
                return ""

            # 座標から最も近いフィーチャーを探す
            best_zone = ""
            best_dist = float("inf")
            for feat in features:
                props = feat.get("properties", {})
                flat = props.get("Latitude") or props.get("lat")
                flng = props.get("Longitude") or props.get("lng")
                if flat is None or flng is None:
                    continue
                d = (float(flat) - lat) ** 2 + (float(flng) - lng) ** 2
                if d < best_dist:
                    best_dist = d
                    best_zone = (
                        props.get("PN_AgriVibrationMethodClass_1")
                        or props.get("AgriculturalVibrationMethodClassification")
                        or props.get("農振地域区分")
                        or ""
                    )
            if best_zone:
                logger.info("WAGRI 農振区分(fieldinfo): %s", best_zone)
            return best_zone
        except httpx.HTTPStatusError as e:
            logger.warning("WAGRI fieldinfo HTTP %d: %s", e.response.status_code, e)
        except Exception as e:
            logger.warning("WAGRI fieldinfo 失敗: %s", e)
        return ""
