"""設定管理モジュール"""
import json
import os
from pathlib import Path


# %APPDATA%\KusakabeSyncAgent に設定・状態ファイルを格納
APP_DATA_DIR = Path(os.environ.get("APPDATA", "")) / "KusakabeSyncAgent"


class SyncConfig:
    """同期エージェントの設定を管理するクラス"""

    def __init__(self, config_path: str | None = None):
        if config_path:
            self._config_path = Path(config_path)
        else:
            self._config_path = APP_DATA_DIR / "config.json"
        self._data = {}
        self.load()

    def load(self):
        """config.json を読み込み"""
        self._data = {}
        if self._config_path.exists():
            with open(self._config_path, "r", encoding="utf-8") as f:
                self._data = json.load(f)
        self._validate()

    def _validate(self):
        """必須フィールドの存在チェック"""
        required = ["client_name", "service_account_key_path", "sync_pairs"]
        missing = [k for k in required if k not in self._data]
        if missing:
            raise ValueError(
                f"config.json に必須項目がありません: {', '.join(missing)}\n"
                f"設定ファイルパス: {self._config_path}"
            )

    @property
    def client_name(self) -> str:
        return self._data["client_name"]

    @property
    def device_name(self) -> str:
        return self._data.get("device_name", "default")

    @property
    def local_folder(self) -> Path:
        raw = self._data.get(
            "local_folder",
            str(Path.home() / "Desktop" / "日下部税理士事務所"),
        )
        return Path(os.path.expandvars(raw))

    @property
    def service_account_key_path(self) -> Path:
        raw = self._data["service_account_key_path"]
        p = Path(raw)
        if not p.is_absolute():
            p = APP_DATA_DIR / p
        return p

    @property
    def shared_drive_id(self) -> str | None:
        return self._data.get("shared_drive_id")

    @property
    def gdrive_root_folder_name(self) -> str:
        return self._data.get("gdrive_root_folder_name", "02_顧問先共有フォルダ")

    @property
    def sync_pairs(self) -> list[dict]:
        return self._data.get("sync_pairs", [])

    @property
    def max_file_size_bytes(self) -> int:
        return self._data.get("max_file_size_mb", 100) * 1024 * 1024

    @property
    def allowed_extensions(self) -> list[str]:
        return self._data.get("allowed_extensions", [
            ".pdf", ".csv", ".xlsx", ".xls",
            ".doc", ".docx", ".jpg", ".jpeg", ".png",
            ".txt", ".zip",
        ])

    @property
    def log_level(self) -> str:
        return self._data.get("log_level", "INFO")

    @property
    def manifest_path(self) -> Path:
        return APP_DATA_DIR / "sync_manifest.json"

    @property
    def log_path(self) -> Path:
        return APP_DATA_DIR / "sync.log"

    @property
    def upload_log_path(self) -> Path:
        return APP_DATA_DIR / "upload_log.json"

    def is_file_allowed(self, filename: str) -> bool:
        ext = Path(filename).suffix.lower()
        return ext in self.allowed_extensions

    def ensure_local_folders(self):
        self.local_folder.mkdir(parents=True, exist_ok=True)
        for pair in self.sync_pairs:
            folder = self.local_folder / pair["local_folder"]
            folder.mkdir(parents=True, exist_ok=True)
        APP_DATA_DIR.mkdir(parents=True, exist_ok=True)
