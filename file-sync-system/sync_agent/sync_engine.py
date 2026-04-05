"""双方向同期エンジン（sync_pairs対応）"""
import logging
from datetime import datetime, timezone
from pathlib import Path

from .config import SyncConfig
from .drive_client import DriveClient
from .manifest import SyncManifest

logger = logging.getLogger(__name__)


class SyncEngine:
    def __init__(self, config):
        self.config = config
        self.drive = DriveClient(config.service_account_key_path, shared_drive_id=config.shared_drive_id)
        self.manifest = SyncManifest(config.manifest_path)
        self.operations_log = []

    def run(self):
        logger.info(f"=== 同期開始: {self.config.client_name} ({self.config.device_name}) ===")
        self.operations_log = []
        try:
            self.config.ensure_local_folders()
            self.drive.authenticate()
            client_folder_id = self._find_client_folder_id()
            for pair in self.config.sync_pairs:
                local_dir = self.config.local_folder / pair["local_folder"]
                drive_folder_name = pair["drive_folder"]
                direction = pair["direction"]
                drive_folder_id = self.drive.find_folder_by_name(drive_folder_name, parent_id=client_folder_id)
                if not drive_folder_id:
                    drive_folder_id = self.drive.create_folder(drive_folder_name, client_folder_id)
                manifest_prefix = f"{direction}/{pair['local_folder']}"
                if direction == "upload":
                    self._sync_upload(local_dir, drive_folder_id, manifest_prefix)
                elif direction == "download":
                    self._sync_download(local_dir, drive_folder_id, manifest_prefix)
            self.manifest.save()
            if self.operations_log:
                self._upload_sync_log(client_folder_id)
            summary = self._make_summary()
            logger.info(f"=== 同期完了: UP {summary['uploaded']}件, DL {summary['downloaded']}件 ===")
            return summary
        except Exception as e:
            logger.error(f"同期エラー: {e}", exc_info=True)
            self._write_error_file(str(e))
            return {"error": str(e), "uploaded": 0, "downloaded": 0}

    def _find_client_folder_id(self):
        if self.drive._shared_drive_id:
            root_id = self.drive._shared_drive_id
        else:
            root_id = self.drive.find_folder_by_name(self.config.gdrive_root_folder_name)
            if not root_id:
                raise FileNotFoundError(f"'{self.config.gdrive_root_folder_name}' フォルダが見つかりません。")
        client_id = self.drive.find_folder_by_name(self.config.client_name, parent_id=root_id)
        if not client_id:
            raise FileNotFoundError(f"'{self.config.client_name}' フォルダが見つかりません。")
        logger.info(f"顧問先フォルダを特定: {self.config.client_name}")
        return client_id

    def _sync_upload(self, local_dir, drive_folder_id, manifest_prefix):
        if not local_dir.exists():
            return
        local_files = {}
        for p in local_dir.rglob("*"):
            if p.is_file() and self.config.is_file_allowed(p.name):
                if p.stat().st_size <= self.config.max_file_size_bytes:
                    rel = p.relative_to(local_dir).as_posix()
                    local_files[rel] = p
        drive_files = self.drive.list_files(drive_folder_id, recursive=True)
        drive_map = {f["path"]: f for f in drive_files}
        for rel, local_path in local_files.items():
            manifest_key = f"{manifest_prefix}/{rel}"
            state = self.manifest.get_file_state(manifest_key)
            local_md5 = SyncManifest.compute_md5(local_path)
            if rel not in drive_map and state is None:
                self._do_upload(local_path, rel, drive_folder_id, manifest_key, local_md5)
            elif rel in drive_map and state is not None:
                if local_md5 != state.get("local_md5"):
                    self._do_update_upload(local_path, rel, drive_map[rel]["id"], manifest_key, local_md5)
            elif rel in drive_map and state is None:
                if local_md5 != drive_map[rel].get("md5Checksum", ""):
                    self._do_upload(local_path, rel, drive_folder_id, manifest_key, local_md5)
                else:
                    self.manifest.update_file_state(manifest_key, {
                        "local_md5": local_md5, "gdrive_id": drive_map[rel]["id"],
                        "gdrive_md5": drive_map[rel].get("md5Checksum", ""), "origin": "local",
                    })

    def _sync_download(self, local_dir, drive_folder_id, manifest_prefix):
        drive_files = self.drive.list_files(drive_folder_id, recursive=True)
        drive_map = {f["path"]: f for f in drive_files}
        local_files = {}
        if local_dir.exists():
            for p in local_dir.rglob("*"):
                if p.is_file():
                    rel = p.relative_to(local_dir).as_posix()
                    local_files[rel] = p
        for rel, drive_file in drive_map.items():
            if not self.config.is_file_allowed(drive_file["name"]):
                continue
            manifest_key = f"{manifest_prefix}/{rel}"
            state = self.manifest.get_file_state(manifest_key)
            local_path = local_dir / rel
            if rel not in local_files and state is None:
                self._do_download(drive_file, local_path, rel, manifest_key)
            elif rel in local_files and state is not None:
                drive_md5 = drive_file.get("md5Checksum", "")
                if drive_md5 and drive_md5 != state.get("gdrive_md5"):
                    self._do_download(drive_file, local_path, rel, manifest_key)
            elif rel in local_files and state is None:
                local_md5 = SyncManifest.compute_md5(local_path)
                drive_md5 = drive_file.get("md5Checksum", "")
                if local_md5 != drive_md5:
                    self._do_download(drive_file, local_path, rel, manifest_key)
                else:
                    self.manifest.update_file_state(manifest_key, {
                        "local_md5": local_md5, "gdrive_id": drive_file["id"],
                        "gdrive_md5": drive_md5, "origin": "remote",
                    })

    def _do_upload(self, local_path, rel, folder_id, manifest_key, local_md5):
        parts = rel.split("/")
        target_folder_id = folder_id
        if len(parts) > 1:
            target_folder_id = self.drive.ensure_folder_path(folder_id, parts[:-1])
        result = self.drive.upload_file(local_path, target_folder_id)
        self.manifest.update_file_state(manifest_key, {
            "local_md5": local_md5, "local_mtime": SyncManifest.get_local_mtime(local_path),
            "local_size": local_path.stat().st_size, "gdrive_id": result["id"],
            "gdrive_md5": result.get("md5Checksum", ""), "origin": "local",
        })
        self._log_operation("upload", rel, local_path.stat().st_size)

    def _do_update_upload(self, local_path, rel, file_id, manifest_key, local_md5):
        result = self.drive.update_file(file_id, local_path)
        self.manifest.update_file_state(manifest_key, {
            "local_md5": local_md5, "local_mtime": SyncManifest.get_local_mtime(local_path),
            "local_size": local_path.stat().st_size, "gdrive_id": result["id"],
            "gdrive_md5": result.get("md5Checksum", ""), "origin": "local",
        })
        self._log_operation("update_upload", rel, local_path.stat().st_size)

    def _do_download(self, drive_file, local_path, rel, manifest_key):
        self.drive.download_file(drive_file["id"], local_path)
        local_md5 = SyncManifest.compute_md5(local_path)
        self.manifest.update_file_state(manifest_key, {
            "local_md5": local_md5, "local_mtime": SyncManifest.get_local_mtime(local_path),
            "local_size": int(drive_file.get("size", 0)), "gdrive_id": drive_file["id"],
            "gdrive_md5": drive_file.get("md5Checksum", ""), "origin": "remote",
        })
        self._log_operation("download", rel, int(drive_file.get("size", 0)))

    def _log_operation(self, op_type, rel_path, size):
        self.operations_log.append({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "client_name": self.config.client_name,
            "device_name": self.config.device_name,
            "operation": op_type, "file_path": rel_path, "size_bytes": size,
        })
        logger.info(f"[{op_type}] {rel_path} ({size:,} bytes)")

    def _upload_sync_log(self, client_folder_id):
        try:
            self.drive.upload_sync_log({
                "client_name": self.config.client_name,
                "device_name": self.config.device_name,
                "sync_time": datetime.now(timezone.utc).isoformat(),
                "operations": self.operations_log,
            }, client_folder_id)
        except Exception as e:
            logger.warning(f"同期ログのアップロードに失敗: {e}")

    def _make_summary(self):
        uploaded = sum(1 for op in self.operations_log if op["operation"] in ("upload", "update_upload"))
        downloaded = sum(1 for op in self.operations_log if op["operation"] == "download")
        return {"uploaded": uploaded, "downloaded": downloaded, "total_operations": len(self.operations_log)}

    def _write_error_file(self, error_msg):
        error_file = self.config.local_folder / "同期エラー.txt"
        try:
            now = datetime.now().strftime("%Y/%m/%d %H:%M:%S")
            error_file.write_text(
                f"ファイル同期でエラーが発生しました。\n日時: {now}\nエラー内容: {error_msg}\n\n"
                f"この問題が続く場合は、日下部税理士事務所までご連絡ください。\n",
                encoding="utf-8",
            )
        except Exception:
            pass
