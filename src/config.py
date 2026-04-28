"""アプリケーション設定."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()


@dataclass
class AppConfig:
    """設定."""

    # 不動産情報ライブラリAPI
    reinfolib_api_key: str = os.getenv("REINFOLIB_API_KEY", "")
    reinfolib_base_url: str = "https://www.reinfolib.mlit.go.jp/ex-api/external"

    # WAGRI（農業データ連携基盤）API
    wagri_client_id: str = os.getenv("WAGRI_CLIENT_ID", "")
    wagri_client_secret: str = os.getenv("WAGRI_CLIENT_SECRET", "")

    # アップロード先
    upload_dir: Path = Path(os.getenv("UPLOAD_DIR", "uploads"))


config = AppConfig()
