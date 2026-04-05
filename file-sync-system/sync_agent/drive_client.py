"""Google Drive API操作モジュール（共有ドライブ対応）"""
import io
import logging
import time
from pathlib import Path

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload, MediaIoBaseDownload
from googleapiclient.errors import HttpError

logger = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/drive"]
MAX_RETRIES = 5
RETRY_BASE_DELAY = 1


class DriveClient:
    def __init__(self, service_account_key_path, shared_drive_id=None):
        self._key_path = Path(service_account_key_path)
        self._shared_drive_id = shared_drive_id
        self._service = None
        self._folder_cache = {}

    def authenticate(self):
        creds = service_account.Credentials.from_service_account_file(
            str(self._key_path), scopes=SCOPES
        )
        self._service = build("drive", "v3", credentials=creds)
        logger.info("Google Drive API認証成功")
        if self._shared_drive_id:
            try:
                drive_info = self._retry_request(
                    self._service.drives().get(driveId=self._shared_drive_id)
                )
                logger.info(f"共有ドライブに接続: {drive_info.get('name', '不明')}")
            except HttpError as e:
                raise ConnectionError(f"共有ドライブにアクセスできません: {e}")

    @property
    def service(self):
        if self._service is None:
            self.authenticate()
        return self._service

    def _retry_request(self, request):
        for attempt in range(MAX_RETRIES):
            try:
                return request.execute()
            except HttpError as e:
                if e.resp.status in (429, 500, 502, 503) and attempt < MAX_RETRIES - 1:
                    delay = RETRY_BASE_DELAY * (2 ** attempt)
                    logger.warning(f"API エラー {e.resp.status}, {delay}秒後にリトライ")
                    time.sleep(delay)
                else:
                    raise

    def find_folder_by_name(self, name, parent_id=None):
        q = f"name = '{name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
        if parent_id:
            q += f" and '{parent_id}' in parents"
        params = {
            "q": q, "spaces": "drive", "fields": "files(id, name)",
            "pageSize": 10, "supportsAllDrives": True, "includeItemsFromAllDrives": True,
        }
        if self._shared_drive_id and not parent_id:
            params["corpora"] = "drive"
            params["driveId"] = self._shared_drive_id
        result = self._retry_request(self.service.files().list(**params))
        files = result.get("files", [])
        return files[0]["id"] if files else None

    def find_client_folder(self, root_folder_name, client_name):
        if self._shared_drive_id:
            root_id = self._shared_drive_id
        else:
            root_id = self.find_folder_by_name(root_folder_name)
            if not root_id:
                raise FileNotFoundError(f"'{root_folder_name}' フォルダが見つかりません。")
        client_id = self.find_folder_by_name(client_name, parent_id=root_id)
        if not client_id:
            raise FileNotFoundError(f"'{client_name}' フォルダが見つかりません。")
        upload_id = self.find_folder_by_name("顧問先からの受取物", parent_id=client_id)
        download_id = self.find_folder_by_name("顧問先への送付物", parent_id=client_id)
        if not upload_id or not download_id:
            raise FileNotFoundError(f"'{client_name}' 内にサブフォルダが見つかりません。")
        return upload_id, download_id, client_id

    def list_files(self, folder_id, recursive=True):
        return self._list_files_recursive(folder_id, "", recursive)

    def _list_files_recursive(self, folder_id, prefix, recursive):
        results = []
        page_token = None
        while True:
            response = self._retry_request(
                self.service.files().list(
                    q=f"'{folder_id}' in parents and trashed = false",
                    spaces="drive",
                    fields="nextPageToken, files(id, name, mimeType, md5Checksum, modifiedTime, size)",
                    pageToken=page_token, pageSize=100,
                    supportsAllDrives=True, includeItemsFromAllDrives=True,
                )
            )
            for f in response.get("files", []):
                rel_path = f"{prefix}{f['name']}" if prefix else f["name"]
                if f["mimeType"] == "application/vnd.google-apps.folder":
                    if recursive:
                        results.extend(self._list_files_recursive(f["id"], f"{rel_path}/", recursive))
                else:
                    results.append({
                        "id": f["id"], "name": f["name"], "mimeType": f["mimeType"],
                        "md5Checksum": f.get("md5Checksum", ""),
                        "modifiedTime": f["modifiedTime"],
                        "size": int(f.get("size", 0)), "path": rel_path,
                    })
            page_token = response.get("nextPageToken")
            if not page_token:
                break
        return results

    def list_subfolders(self, parent_id):
        response = self._retry_request(
            self.service.files().list(
                q=f"'{parent_id}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
                spaces="drive", fields="files(id, name)", pageSize=200,
                supportsAllDrives=True, includeItemsFromAllDrives=True,
                driveId=self._shared_drive_id if self._shared_drive_id else None,
                corpora="drive" if self._shared_drive_id else "user",
            )
        )
        return response.get("files", [])

    def create_folder(self, name, parent_id):
        metadata = {"name": name, "mimeType": "application/vnd.google-apps.folder", "parents": [parent_id]}
        folder = self._retry_request(
            self.service.files().create(body=metadata, fields="id", supportsAllDrives=True)
        )
        logger.info(f"フォルダ作成: {name}")
        return folder["id"]

    def ensure_folder_path(self, parent_id, path_parts):
        current_id = parent_id
        for part in path_parts:
            existing = self.find_folder_by_name(part, parent_id=current_id)
            current_id = existing if existing else self.create_folder(part, current_id)
        return current_id

    def upload_file(self, local_path, folder_id, remote_name=None):
        name = remote_name or local_path.name
        metadata = {"name": name, "parents": [folder_id]}
        file_size = local_path.stat().st_size
        media = MediaFileUpload(str(local_path), resumable=(file_size > 5 * 1024 * 1024))
        result = self._retry_request(
            self.service.files().create(
                body=metadata, media_body=media,
                fields="id, name, md5Checksum, modifiedTime, size",
                supportsAllDrives=True,
            )
        )
        logger.info(f"アップロード完了: {name} ({file_size:,} bytes)")
        return result

    def update_file(self, file_id, local_path):
        file_size = local_path.stat().st_size
        media = MediaFileUpload(str(local_path), resumable=(file_size > 5 * 1024 * 1024))
        result = self._retry_request(
            self.service.files().update(
                fileId=file_id, media_body=media,
                fields="id, name, md5Checksum, modifiedTime, size",
                supportsAllDrives=True,
            )
        )
        return result

    def download_file(self, file_id, local_path):
        local_path.parent.mkdir(parents=True, exist_ok=True)
        request = self.service.files().get_media(fileId=file_id, supportsAllDrives=True)
        with open(local_path, "wb") as f:
            downloader = MediaIoBaseDownload(f, request)
            done = False
            while not done:
                status, done = downloader.next_chunk()
        logger.info(f"ダウンロード完了: {local_path.name}")

    def upload_sync_log(self, log_data, client_folder_id):
        import json, tempfile
        from datetime import datetime
        logs_folder_id = self.find_folder_by_name("_sync_logs", parent_id=client_folder_id)
        if not logs_folder_id:
            logs_folder_id = self.create_folder("_sync_logs", client_folder_id)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        device = log_data.get("device_name", "unknown")
        filename = f"sync_log_{device}_{timestamp}.json"
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False, encoding="utf-8") as tmp:
            json.dump(log_data, tmp, ensure_ascii=False, indent=2)
            tmp_path = Path(tmp.name)
        try:
            self.upload_file(tmp_path, logs_folder_id, remote_name=filename)
        finally:
            tmp_path.unlink(missing_ok=True)
