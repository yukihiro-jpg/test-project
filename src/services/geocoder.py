"""住所→座標変換（ジオコーディング）.

国土地理院の無料ジオコーディングAPIを使用。
"""

from __future__ import annotations

import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

GSI_GEOCODE_URL = "https://msearch.gsi.go.jp/address-search/AddressSearch"


async def geocode(address: str) -> Optional[tuple[float, float]]:
    """住所から緯度経度を取得.

    Args:
        address: 住所文字列（例: "東京都渋谷区神宮前1-1"）

    Returns:
        (latitude, longitude) or None
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(GSI_GEOCODE_URL, params={"q": address})
            resp.raise_for_status()
            results = resp.json()
            if results and len(results) > 0:
                # GeoJSON形式: [lng, lat]
                coords = results[0]["geometry"]["coordinates"]
                return coords[1], coords[0]  # lat, lng
    except Exception as e:
        logger.warning("ジオコーディング失敗 (%s): %s", address, e)
    return None
