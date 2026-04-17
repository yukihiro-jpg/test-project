"""
スプレッドシートから未インストーラーの顧問先を検出して
一括でインストーラーを生成するツール

使い方:
    python accountant_tools/sync_installers.py

動作:
    1. Google Spreadsheet「_書類スキャン管理」の「顧問先URL一覧」を読む
    2. 各顧問先について installers/installer_顧問先名_社長PC/ が存在するか確認
    3. 存在しない顧問先のインストーラーを自動生成（社長PC用とスタッフPC用の両方）
"""
import argparse
import json
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sync_agent.drive_client import DriveClient
from accountant_tools.add_client import (
    create_drive_folders,
    generate_client_config,
    package_installer,
)

logger = logging.getLogger(__name__)


def read_clients_from_sheet(drive, shared_drive_id):
    """
    共有ドライブ内の「_書類スキャン管理」スプレッドシートから
    「顧問先URL一覧」シートを読み、顧問先名のリストを返す
    """
    from googleapiclient.discovery import build

    # まず _書類スキャン管理 のファイルIDを取得
    service = drive.service
    response = service.files().list(
        q="name = '_書類スキャン管理' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false",
        spaces="drive",
        fields="files(id, name)",
        supportsAllDrives=True,
        includeItemsFromAllDrives=True,
        corpora="drive",
        driveId=shared_drive_id,
    ).execute()

    files = response.get("files", [])
    if not files:
        print("エラー: _書類スキャン管理 スプレッドシートが見つかりません。")
        return []

    sheet_id = files[0]["id"]
    print(f"スプレッドシート発見: {sheet_id}")

    # Sheets APIで読み込み
    creds = drive._service._http.credentials
    sheets_service = build("sheets", "v4", credentials=creds)
    result = sheets_service.spreadsheets().values().get(
        spreadsheetId=sheet_id,
        range="顧問先URL一覧!A2:A1000",
    ).execute()

    values = result.get("values", [])
    clients = [row[0].strip() for row in values if row and row[0].strip()]
    return clients


def installer_exists(output_dir, client_name, device_name):
    """インストーラーフォルダが既に存在するか確認"""
    pkg_name = f"installer_{client_name}_{device_name}"
    return (output_dir / pkg_name).exists()


def main():
    parser = argparse.ArgumentParser(description="未インストーラー顧問先の一括生成")
    parser.add_argument(
        "--shared-drive-id", "-s",
        default="0AHqphn15zs6yUk9PVA",
        help="共有ドライブID",
    )
    parser.add_argument(
        "--service-account-key", "-k",
        default=str(Path(__file__).resolve().parent.parent / "service_account.json"),
    )
    parser.add_argument(
        "--output", "-o",
        default=str(Path(__file__).resolve().parent.parent / "installers"),
    )
    parser.add_argument(
        "--device", "-d", default="社長PC",
        help="デバイス名（社長PC / スタッフPC）",
    )
    parser.add_argument(
        "--type", "-t", default="boss",
        choices=["boss", "staff", "simple"],
        help="デバイスタイプ",
    )
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

    sa_key_path = Path(args.service_account_key)
    if not sa_key_path.exists():
        print(f"エラー: サービスアカウント鍵ファイルが見つかりません: {sa_key_path}")
        sys.exit(1)

    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Drive認証
    drive = DriveClient(sa_key_path, shared_drive_id=args.shared_drive_id)
    drive.authenticate()

    # スプレッドシートから顧問先リスト取得
    clients = read_clients_from_sheet(drive, args.shared_drive_id)
    print(f"\n顧問先URL一覧から{len(clients)}件の顧問先を検出")

    # 未インストーラーを検出
    missing = [c for c in clients if not installer_exists(output_dir, c, args.device)]

    if not missing:
        print("全ての顧問先にインストーラーが存在します。新規作成はありません。")
        return

    print(f"\n未インストーラーの顧問先: {len(missing)}件")
    for c in missing:
        print(f"  - {c}")

    print("\n=== インストーラー生成開始 ===")
    for client_name in missing:
        print(f"\n▼ {client_name}")

        # Driveフォルダは既に存在するが、なければ作成される（二重作成にはならない）
        create_drive_folders(
            drive,
            "02_顧問先共有フォルダ",
            client_name,
            shared_drive_id=args.shared_drive_id,
        )

        # 設定ファイル生成
        config = generate_client_config(
            client_name=client_name,
            device_name=args.device,
            device_type=args.type,
            shared_drive_id=args.shared_drive_id,
        )

        # インストーラーパッケージ作成
        package_installer(
            output_dir=output_dir,
            client_name=client_name,
            device_name=args.device,
            config=config,
            service_account_key_path=sa_key_path,
        )

    print(f"\n=== 完了: {len(missing)}件のインストーラーを生成しました ===")


if __name__ == "__main__":
    main()
