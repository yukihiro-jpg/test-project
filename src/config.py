"""設定管理.

環境変数や.envファイルからMCPサーバー接続情報を読み込む。
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv


@dataclass
class AppConfig:
    """アプリケーション設定."""

    mlit_api_key: str = ""
    mlit_base_url: str = "https://www.mlit-data.jp/api/v1/"
    mcp_server_command: str = "python"
    mcp_server_args: list[str] = field(default_factory=lambda: ["-m", "src.server"])
    log_level: str = "WARNING"

    @classmethod
    def from_env(cls, env_file: str | Path | None = None) -> AppConfig:
        """環境変数から設定を読み込み."""
        if env_file:
            load_dotenv(env_file)
        else:
            load_dotenv()

        return cls(
            mlit_api_key=os.getenv("MLIT_API_KEY", ""),
            mlit_base_url=os.getenv(
                "MLIT_BASE_URL", "https://www.mlit-data.jp/api/v1/"
            ),
            mcp_server_command=os.getenv("MCP_SERVER_COMMAND", "python"),
            log_level=os.getenv("LOG_LEVEL", "WARNING"),
        )

    def validate(self) -> list[str]:
        """設定のバリデーション. エラーメッセージのリストを返す."""
        errors = []
        if not self.mlit_api_key:
            errors.append("MLIT_API_KEY が設定されていません。国交省データプラットフォームでAPIキーを取得してください。")
        return errors
