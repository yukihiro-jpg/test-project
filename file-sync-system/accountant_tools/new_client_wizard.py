"""
新規顧問先登録ウィザード（インストーラー生成統合版）

動作:
1. 対話的に顧問先名を入力（複数可、空行で終了）
2. 「顧問先URL一覧」スプレッドシートに自動転記（重複は自動スキップ）
3. Driveに顧問先フォルダ＋サブフォルダ作成
4. クライアントID・撮影URL・QRコードURL生成
5. インストーラー（社長PC・スタッフPC両方）を出力先に生成
6. 既存インストーラーは sync_agent.ps1 の更新時刻を比較し、古ければ最新版に置き換え

使い方:
    python new_client_wizard.py --output-dir "<出力先パス>"
"""

import argparse
import logging
import os
import sys
import time
import urllib.parse
from datetime import datetime
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_DIR = SCRIPT_DIR.parent
sys.path.insert(0, str(REPO_DIR))

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from sync_agent.drive_client import DriveClient
from accountant_tools.add_client import (
    create_drive_folders,
    generate_client_config,
    package_installer,
)


# ============================================================
# 設定
# ============================================================

SHARED_DRIVE_ID = "0AHqphn15zs6yUk9PVA"
SPREADSHEET_NAME = "_書類スキャン管理"
SHEET_NAME = "顧問先URL一覧"
ROOT_FOLDER_NAME = "02_顧問先共有フォルダ"
DEFAULT_FRONTEND_URL = "https://yukihiro-jpg.github.io/test-project/frontend/"
SCOPES = [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/spreadsheets",
]


# ============================================================
# 補助関数
# ============================================================

def find_service_account_key():
    """service_account.json を複数候補から探す"""
    candidates = [
        REPO_DIR / "service_account.json",
        Path(os.environ.get("APPDATA", "")) / "KusakabeSyncAgent" / "service_account.json",
        Path.home() / "Desktop" / "会計AI" / "ファイル同期システム" / "service_account.json",
    ]
    for p in candidates:
        if p.exists():
            return p
    return None


def generate_client_id(index):
    """Apps Script と互換性のある clientId 生成: 'c' + base36(timestamp_ms) + index"""
    ts_ms = int(time.time() * 1000)

    def to_base36(num):
        chars = "0123456789abcdefghijklmnopqrstuvwxyz"
        if num == 0:
            return "0"
        out = []
        while num > 0:
            out.append(chars[num % 36])
            num //= 36
        return "".join(reversed(out))

    return f"c{to_base36(ts_ms)}{index}"


def extract_frontend_url_from_rows(rows):
    """既存のURL列から FRONTEND_URL を抽出"""
    for row in rows[1:]:
        if len(row) > 2 and row[2]:
            url = row[2]
            if "?client=" in url:
                return url.split("?client=")[0]
    return DEFAULT_FRONTEND_URL


def find_spreadsheet_id(drive_service, shared_drive_id, name):
    response = drive_service.files().list(
        q=f"name = '{name}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false",
        spaces="drive",
        fields="files(id, name)",
        supportsAllDrives=True,
        includeItemsFromAllDrives=True,
        corpora="drive",
        driveId=shared_drive_id,
    ).execute()
    files = response.get("files", [])
    if not files:
        raise RuntimeError(f"スプレッドシート '{name}' が共有ドライブに見つかりません")
    return files[0]["id"]


def read_client_url_rows(sheets_service, spreadsheet_id):
    result = sheets_service.spreadsheets().values().get(
        spreadsheetId=spreadsheet_id,
        range=f"{SHEET_NAME}!A1:E1000",
    ).execute()
    return result.get("values", [])


def append_client_row(sheets_service, spreadsheet_id, client_name, client_id, url, qr_url):
    now_str = datetime.now().strftime("%Y/%m/%d %H:%M")
    sheets_service.spreadsheets().values().append(
        spreadsheetId=spreadsheet_id,
        range=f"{SHEET_NAME}!A:E",
        valueInputOption="USER_ENTERED",
        body={"values": [[client_name, client_id, url, now_str, qr_url]]},
    ).execute()


# ============================================================
# インストーラー生成・更新判定
# ============================================================

def is_installer_outdated(installer_dir, source_dir):
    """sync_agent.ps1 の更新時刻を比較。なければ True（要生成）"""
    target = installer_dir / "sync_agent.ps1"
    source = source_dir / "sync_agent.ps1"
    if not target.exists():
        return True
    if not source.exists():
        return False
    # ソースが新しい場合のみ更新
    return source.stat().st_mtime > target.stat().st_mtime


def generate_or_update_installer(
    output_dir, client_name, device_name, device_type,
    shared_drive_id, sa_key_path, source_dir
):
    installer_dir = output_dir / f"installer_{client_name}_{device_name}"
    existed = installer_dir.exists()

    if existed and not is_installer_outdated(installer_dir, source_dir):
        return "skipped"

    config = generate_client_config(
        client_name=client_name,
        device_name=device_name,
        device_type=device_type,
        shared_drive_id=shared_drive_id,
    )
    package_installer(
        output_dir=output_dir,
        client_name=client_name,
        device_name=device_name,
        config=config,
        service_account_key_path=sa_key_path,
    )
    return "updated" if existed else "created"


# ============================================================
# メイン
# ============================================================

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", required=True, help="インストーラー出力先")
    parser.add_argument("--service-account-key", default=None)
    parser.add_argument("--shared-drive-id", default=SHARED_DRIVE_ID)
    args = parser.parse_args()

    logging.basicConfig(level=logging.WARNING, format="%(asctime)s [%(levelname)s] %(message)s")

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    sa_key_path = Path(args.service_account_key) if args.service_account_key else find_service_account_key()
    if not sa_key_path or not sa_key_path.exists():
        print("エラー: service_account.json が見つかりません。")
        print("候補:")
        print(f"  - {REPO_DIR}/service_account.json")
        print(f"  - {os.environ.get('APPDATA', '')}/KusakabeSyncAgent/service_account.json")
        sys.exit(1)

    source_dir = REPO_DIR / "client_installer"

    # ヘッダー
    print("=" * 60)
    print("  新規顧問先登録ウィザード")
    print("=" * 60)
    print()
    print("顧問先名を入力してください（番号_会社名 形式）")
    print("例: 701_株式会社サンプル")
    print()
    print("複数の場合は1行ずつ。空行（Enterのみ）で入力終了。")
    print("（既存インストーラーの更新チェックだけの場合は最初から空Enter）")
    print()

    new_client_names = []
    while True:
        try:
            line = input("> ").strip()
        except EOFError:
            break
        if not line:
            break
        new_client_names.append(line)

    # 認証
    print()
    print("Google Driveに接続中...")

    try:
        creds = service_account.Credentials.from_service_account_file(
            str(sa_key_path), scopes=SCOPES,
        )
        drive_service = build("drive", "v3", credentials=creds)
        sheets_service = build("sheets", "v4", credentials=creds)
    except Exception as e:
        print(f"エラー: 認証に失敗しました: {e}")
        sys.exit(1)

    drive = DriveClient(sa_key_path, shared_drive_id=args.shared_drive_id)
    drive.authenticate()

    # スプレッドシート読み込み
    try:
        ss_id = find_spreadsheet_id(drive_service, args.shared_drive_id, SPREADSHEET_NAME)
        rows = read_client_url_rows(sheets_service, ss_id)
    except HttpError as e:
        print(f"エラー: スプレッドシートにアクセスできません: {e}")
        print(f"対処: スプレッドシート '{SPREADSHEET_NAME}' をサービスアカウント")
        print(f"      ({creds.service_account_email}) に共有設定してください。")
        sys.exit(1)
    except Exception as e:
        print(f"エラー: スプレッドシート読み込み失敗: {e}")
        sys.exit(1)

    existing_names = {row[0].strip() for row in rows[1:] if row and row[0]}
    frontend_url = extract_frontend_url_from_rows(rows)

    print(f"既存顧問先: {len(existing_names)}件")
    print()

    # 新規顧問先の処理
    registered_count = 0
    duplicate_count = 0

    for i, client_name in enumerate(new_client_names):
        if client_name in existing_names:
            print(f"⚠ '{client_name}' は既に登録済み（スキップ）")
            duplicate_count += 1
            continue

        print(f"--- {client_name} を新規登録 ---")

        client_id = generate_client_id(len(rows) + i + 1)
        url = (
            f"{frontend_url}?client={urllib.parse.quote(client_id)}"
            f"&name={urllib.parse.quote(client_name)}"
        )
        qr_url = (
            f"https://quickchart.io/qr?text={urllib.parse.quote(url)}"
            f"&size=300&margin=2"
        )

        try:
            print("  Driveフォルダ作成中...")
            create_drive_folders(
                drive, ROOT_FOLDER_NAME, client_name,
                shared_drive_id=args.shared_drive_id,
            )

            print("  スプレッドシート登録中...")
            append_client_row(sheets_service, ss_id, client_name, client_id, url, qr_url)
            existing_names.add(client_name)

            print(f"  ✓ 登録完了")
            print(f"  URL: {url}")
            registered_count += 1
        except Exception as e:
            print(f"  ✗ エラー: {e}")
            print(f"  (この顧問先の処理を中止して次へ進みます)")
        print()

    # インストーラー生成・更新
    print("=" * 60)
    print("  インストーラー生成・更新チェック")
    print("=" * 60)
    print()

    # 最新のスプレッドシート再読み込み
    rows = read_client_url_rows(sheets_service, ss_id)
    all_clients = [row[0].strip() for row in rows[1:] if row and row[0]]

    created_count = 0
    updated_count = 0
    skipped_count = 0

    for client_name in all_clients:
        for device_type, device_name in [("boss", "社長PC"), ("staff", "スタッフPC")]:
            label = f"installer_{client_name}_{device_name}"
            try:
                result = generate_or_update_installer(
                    output_dir=output_dir,
                    client_name=client_name,
                    device_name=device_name,
                    device_type=device_type,
                    shared_drive_id=args.shared_drive_id,
                    sa_key_path=sa_key_path,
                    source_dir=source_dir,
                )
                if result == "created":
                    print(f"  + {label}: 新規生成")
                    created_count += 1
                elif result == "updated":
                    print(f"  ↻ {label}: 最新版に更新")
                    updated_count += 1
                else:
                    skipped_count += 1
            except Exception as e:
                print(f"  ✗ {label}: エラー: {e}")

    print()
    print("=" * 60)
    print("  完了")
    print("=" * 60)
    print()
    print(f"  新規顧問先登録: {registered_count} 件")
    if duplicate_count > 0:
        print(f"  既登録のためスキップ: {duplicate_count} 件")
    print(f"  インストーラー新規生成: {created_count} 件")
    print(f"  インストーラー更新: {updated_count} 件")
    print(f"  インストーラー最新（変更なし）: {skipped_count} 件")
    print()
    print(f"  出力先: {output_dir}")
    print()


if __name__ == "__main__":
    main()
