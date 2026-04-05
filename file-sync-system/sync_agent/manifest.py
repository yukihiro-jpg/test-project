"""同期状態管理モジュール（マニフェスト）"""
import hashlib
import json
import logging
import tempfile
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger(__name__)


class SyncManifest:
    def __init__(self, manifest_path):
        self._path = manifest_path
        self._data = {"schema_version": 1, "last_sync_utc": None, "files": {}}
        self.load()

    def load(self):
        if self._path.exists():
            try:
                with open(self._path, "r", encoding="utf-8") as f:
                    self._data = json.load(f)
            except (json.JSONDecodeError, IOError) as e:
                logger.warning(f"マニフェスト読み込みエラー: {e}")
                self._data = {"schema_version": 1, "last_sync_utc": None, "files": {}}

    def save(self):
        self._data["last_sync_utc"] = datetime.now(timezone.utc).isoformat()
        self._path.parent.mkdir(parents=True, exist_ok=True)
        tmp_fd, tmp_path = tempfile.mkstemp(dir=str(self._path.parent), suffix=".tmp")
        try:
            with open(tmp_fd, "w", encoding="utf-8") as f:
                json.dump(self._data, f, ensure_ascii=False, indent=2)
            Path(tmp_path).replace(self._path)
        except Exception:
            Path(tmp_path).unlink(missing_ok=True)
            raise

    def get_file_state(self, rel_path):
        return self._data["files"].get(rel_path)

    def update_file_state(self, rel_path, state):
        state["last_synced_utc"] = datetime.now(timezone.utc).isoformat()
        self._data["files"][rel_path] = state

    def remove_file_state(self, rel_path):
        self._data["files"].pop(rel_path, None)

    def mark_deleted(self, rel_path, side):
        state = self._data["files"].get(rel_path)
        if state:
            state[f"{side}_deleted"] = True
            state["deleted_at"] = datetime.now(timezone.utc).isoformat()

    def all_files(self):
        return dict(self._data["files"])

    @staticmethod
    def compute_md5(file_path):
        h = hashlib.md5()
        with open(file_path, "rb") as f:
            while True:
                chunk = f.read(8192)
                if not chunk:
                    break
                h.update(chunk)
        return h.hexdigest()

    @staticmethod
    def get_local_mtime(file_path):
        mtime = file_path.stat().st_mtime
        return datetime.fromtimestamp(mtime).isoformat()
