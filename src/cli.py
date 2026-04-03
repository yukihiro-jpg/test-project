"""CLI エントリーポイント."""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys

from .evaluator import LandEvaluator
from .mcp_client import MLITMCPClient
from .report import print_report_rich, render_report


def main() -> None:
    parser = argparse.ArgumentParser(
        description="相続税土地評価 基礎情報収集ツール（MLIT DPF MCP連携）",
    )
    parser.add_argument(
        "address",
        help="評価対象の住所・地番（例: '東京都渋谷区神宮前1-1-1'）",
    )
    parser.add_argument(
        "--lat",
        type=float,
        default=None,
        help="緯度（既知の場合）",
    )
    parser.add_argument(
        "--lng",
        type=float,
        default=None,
        help="経度（既知の場合）",
    )
    parser.add_argument(
        "--mcp-command",
        default="python",
        help="MCPサーバー起動コマンド（デフォルト: python）",
    )
    parser.add_argument(
        "--mcp-args",
        nargs="*",
        default=["-m", "src.server"],
        help="MCPサーバー引数",
    )
    parser.add_argument(
        "--output",
        choices=["text", "rich"],
        default="rich",
        help="出力形式（デフォルト: rich）",
    )
    parser.add_argument(
        "--log-level",
        default="WARNING",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        help="ログレベル",
    )

    args = parser.parse_args()
    logging.basicConfig(level=getattr(logging, args.log_level))

    asyncio.run(_run(args))


async def _run(args: argparse.Namespace) -> None:
    client = MLITMCPClient(
        server_command=args.mcp_command,
        server_args=args.mcp_args,
    )
    evaluator = LandEvaluator(client)

    print(f"対象地の基礎情報を取得中: {args.address}")
    print("MLIT DPF MCPサーバーに接続しています...")
    print()

    result = await evaluator.evaluate(
        address=args.address,
        latitude=args.lat,
        longitude=args.lng,
    )

    if args.output == "rich":
        print_report_rich(result)
    else:
        print(render_report(result))


if __name__ == "__main__":
    main()
