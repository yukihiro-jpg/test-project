"""座標→タイル座標変換ユーティリティ.

不動産情報ライブラリAPIはXYZタイル座標(z/x/y)で位置を指定する。
緯度経度からタイル座標に変換するための関数群。
"""

from __future__ import annotations

import math


def latlng_to_tile(lat: float, lng: float, zoom: int = 15) -> tuple[int, int, int]:
    """緯度経度をタイル座標(z, x, y)に変換.

    Args:
        lat: 緯度
        lng: 経度
        zoom: ズームレベル（デフォルト15、不動産情報ライブラリ推奨）

    Returns:
        (z, x, y) タイル座標
    """
    n = 2 ** zoom
    x = int((lng + 180.0) / 360.0 * n)
    lat_rad = math.radians(lat)
    y = int((1.0 - math.log(math.tan(lat_rad) + 1.0 / math.cos(lat_rad)) / math.pi) / 2.0 * n)
    return zoom, x, y
