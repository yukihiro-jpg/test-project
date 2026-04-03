"""MLIT DPF MCP サーバーとの通信クライアント.

mlit-dpf-mcpの各ツールを呼び出し、相続税評価に必要なデータを取得する。
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Optional

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

logger = logging.getLogger(__name__)


class MLITMCPClient:
    """MLIT DPF MCP サーバークライアント."""

    def __init__(self, server_command: str = "python", server_args: Optional[list[str]] = None):
        self.server_params = StdioServerParameters(
            command=server_command,
            args=server_args or ["-m", "src.server"],
            env=None,  # .envから読み込み
        )
        self._session: Optional[ClientSession] = None

    async def __aenter__(self) -> MLITMCPClient:
        return self

    async def __aexit__(self, *args: Any) -> None:
        await self.close()

    async def close(self) -> None:
        self._session = None

    async def _call_tool(self, tool_name: str, arguments: dict[str, Any]) -> Any:
        """MCPツールを呼び出す."""
        async with stdio_client(self.server_params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                result = await session.call_tool(tool_name, arguments)
                return result

    # ------------------------------------------------------------------
    # 公示地価・基準地価の取得
    # ------------------------------------------------------------------
    async def search_official_land_prices(
        self, latitude: float, longitude: float, distance_m: int = 1000
    ) -> list[dict[str, Any]]:
        """指定座標周辺の公示地価・基準地価を検索."""
        result = await self._call_tool(
            "search_by_location_point_distance",
            {
                "latitude": latitude,
                "longitude": longitude,
                "distance": distance_m,
                "keyword": "地価公示",
                "count": 10,
            },
        )
        return self._parse_result(result)

    # ------------------------------------------------------------------
    # 不動産取引価格の取得
    # ------------------------------------------------------------------
    async def search_transaction_prices(
        self, latitude: float, longitude: float, distance_m: int = 500
    ) -> list[dict[str, Any]]:
        """指定座標周辺の不動産取引価格情報を検索."""
        result = await self._call_tool(
            "search_by_location_point_distance",
            {
                "latitude": latitude,
                "longitude": longitude,
                "distance": distance_m,
                "keyword": "不動産取引価格",
                "count": 20,
            },
        )
        return self._parse_result(result)

    # ------------------------------------------------------------------
    # 用途地域・都市計画情報の取得
    # ------------------------------------------------------------------
    async def search_zoning_info(
        self, latitude: float, longitude: float
    ) -> list[dict[str, Any]]:
        """指定座標の用途地域情報を検索."""
        result = await self._call_tool(
            "search_by_location_point_distance",
            {
                "latitude": latitude,
                "longitude": longitude,
                "distance": 100,
                "keyword": "用途地域",
                "count": 5,
            },
        )
        return self._parse_result(result)

    # ------------------------------------------------------------------
    # ハザード情報の取得
    # ------------------------------------------------------------------
    async def search_hazard_info(
        self, latitude: float, longitude: float
    ) -> list[dict[str, Any]]:
        """指定座標のハザード情報を検索."""
        result = await self._call_tool(
            "search_by_location_point_distance",
            {
                "latitude": latitude,
                "longitude": longitude,
                "distance": 500,
                "keyword": "ハザード",
                "count": 10,
            },
        )
        return self._parse_result(result)

    # ------------------------------------------------------------------
    # 都市計画区域の取得
    # ------------------------------------------------------------------
    async def search_urban_planning(
        self, latitude: float, longitude: float
    ) -> list[dict[str, Any]]:
        """指定座標の都市計画情報を検索."""
        result = await self._call_tool(
            "search_by_location_point_distance",
            {
                "latitude": latitude,
                "longitude": longitude,
                "distance": 100,
                "keyword": "都市計画",
                "count": 5,
            },
        )
        return self._parse_result(result)

    # ------------------------------------------------------------------
    # 住所→座標変換（ジオコーディング）
    # ------------------------------------------------------------------
    async def search_by_address(self, address: str) -> list[dict[str, Any]]:
        """住所・地番からデータを検索."""
        result = await self._call_tool(
            "search",
            {
                "keyword": address,
                "count": 5,
            },
        )
        return self._parse_result(result)

    # ------------------------------------------------------------------
    # メッシュデータ取得
    # ------------------------------------------------------------------
    async def get_mesh_data(self, mesh_code: str) -> list[dict[str, Any]]:
        """メッシュコードからデータを取得."""
        result = await self._call_tool(
            "get_mesh",
            {"mesh_code": mesh_code},
        )
        return self._parse_result(result)

    @staticmethod
    def _parse_result(result: Any) -> list[dict[str, Any]]:
        """MCPレスポンスをパース."""
        if result is None:
            return []
        if hasattr(result, "content"):
            parsed = []
            for content_item in result.content:
                if hasattr(content_item, "text"):
                    try:
                        data = json.loads(content_item.text)
                        if isinstance(data, list):
                            parsed.extend(data)
                        else:
                            parsed.append(data)
                    except json.JSONDecodeError:
                        parsed.append({"raw_text": content_item.text})
            return parsed
        return [result] if isinstance(result, dict) else list(result)
