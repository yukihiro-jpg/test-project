"""新規顧問先登録ツール（税理士が実行）"""
import argparse
import json
import logging
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sync_agent.drive_client import DriveClient

logger = logging.getLogger(__name__)

INSTALLER_TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "client_installer"


def create_drive_folders(drive, root_folder_name, client_name, shared_drive_id=None):
    """Driveに顧問先フォルダとサブフォルダを作成"""
    if shared_drive_id:
        root_id = shared_drive_id
    else:
        root_id = drive.find_folder_by_name(root_folder_name)
        if not root_id:
            print(f"エラー: '{root_folder_name}' フォルダが見つかりません。")
            sys.exit(1)

    existing = drive.find_folder_by_name(client_name, parent_id=root_id)
    if existing:
        print(f"'{client_name}' フォルダは既に存在します。")
        client_id = existing
    else:
        client_id = drive.create_folder(client_name, root_id)
        print(f"顧問先フォルダを作成: {client_name}")

    # ファイル同期用サブフォルダ作成
    for subfolder in [
        "顧問先からの受取物（社長用）", "顧問先への送付物（社長用）",
        "顧問先からの受取物（スタッフ用）", "顧問先への送付物（スタッフ用）",
        "_sync_logs",
    ]:
        existing_sub = drive.find_folder_by_name(subfolder, parent_id=client_id)
        if not existing_sub:
            drive.create_folder(subfolder, client_id)
            print(f"  サブフォルダ作成: {subfolder}")
        else:
            print(f"  サブフォルダ既存: {subfolder}")

    # スマホ撮影フォルダを作成（スマホスキャンシステムと共通）
    scan_folder_id = drive.find_folder_by_name("スマホ撮影", parent_id=client_id)
    if not scan_folder_id:
        scan_folder_id = drive.create_folder("スマホ撮影", client_id)
        print(f"  サブフォルダ作成: スマホ撮影")
    else:
        print(f"  サブフォルダ既存: スマホ撮影")

    for scan_sub in ["未整理", "処理済み"]:
        existing_scan_sub = drive.find_folder_by_name(scan_sub, parent_id=scan_folder_id)
        if not existing_scan_sub:
            drive.create_folder(scan_sub, scan_folder_id)
            print(f"    サブフォルダ作成: スマホ撮影/{scan_sub}")
        else:
            print(f"    サブフォルダ既存: スマホ撮影/{scan_sub}")

    return client_id


def generate_client_config(client_name, device_name, device_type, shared_drive_id=None):
    # 数字プレフィックス（例: "608_"）を除去して会社名だけ取得
    import re
    display_name = re.sub(r'^\d+_', '', client_name)

    if device_type == "boss":
        sync_pairs = [
            {"local_folder": f"{display_name}→税理士", "drive_folder": "顧問先からの受取物（社長用）", "direction": "upload"},
            {"local_folder": f"税理士→{display_name}", "drive_folder": "顧問先への送付物（社長用）", "direction": "download"},
            {"local_folder": f"{display_name}→税理士（スタッフ用）", "drive_folder": "顧問先からの受取物（スタッフ用）", "direction": "download"},
            {"local_folder": f"税理士→{display_name}（スタッフ用）", "drive_folder": "顧問先への送付物（スタッフ用）", "direction": "download"},
        ]
    elif device_type == "staff":
        sync_pairs = [
            {"local_folder": f"{display_name}→税理士（スタッフ用）", "drive_folder": "顧問先からの受取物（スタッフ用）", "direction": "upload"},
            {"local_folder": f"税理士→{display_name}（スタッフ用）", "drive_folder": "顧問先への送付物（スタッフ用）", "direction": "download"},
        ]
    else:
        sync_pairs = [
            {"local_folder": f"{display_name}→税理士", "drive_folder": "顧問先からの受取物", "direction": "upload"},
            {"local_folder": f"税理士→{display_name}", "drive_folder": "顧問先への送付物", "direction": "download"},
        ]

    return {
        "client_name": client_name,
        "device_name": device_name,
        "service_account_key_path": "service_account.json",
        "local_folder": "%USERPROFILE%\\Desktop\\日下部税理士事務所",
        "shared_drive_id": shared_drive_id,
        "gdrive_root_folder_name": "02_顧問先共有フォルダ",
        "sync_pairs": sync_pairs,
        "max_file_size_mb": 100,
        "allowed_extensions": [
            ".pdf", ".csv", ".xlsx", ".xls",
            ".doc", ".docx", ".jpg", ".jpeg", ".png",
            ".txt", ".zip",
        ],
        "log_level": "INFO",
    }


def package_installer(output_dir, client_name, device_name, config, service_account_key_path):
    pkg_name = f"installer_{client_name}_{device_name}"
    pkg_dir = output_dir / pkg_name
    pkg_dir.mkdir(parents=True, exist_ok=True)

    exe_file = Path(__file__).resolve().parent.parent / "dist" / "sync_agent.exe"
    if exe_file.exists():
        shutil.copy2(exe_file, pkg_dir / "sync_agent.exe")
    else:
        print(f"エラー: sync_agent.exe が見つかりません: {exe_file}")
        sys.exit(1)

    config_path = pkg_dir / "config.json"
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(config, f, ensure_ascii=False, indent=2)

    if service_account_key_path.exists():
        shutil.copy2(service_account_key_path, pkg_dir / "service_account.json")
    else:
        print(f"警告: サービスアカウント鍵ファイルが見つかりません")

    for bat_name in ["install.bat", "uninstall.bat"]:
        bat_file = INSTALLER_TEMPLATE_DIR / bat_name
        if bat_file.exists():
            shutil.copy2(bat_file, pkg_dir / bat_name)

    print(f"\nインストーラパッケージを作成しました: {pkg_dir}")
    return pkg_dir


def main():
    parser = argparse.ArgumentParser(description="新規顧問先登録")
    parser.add_argument("client_name", help="顧問先名")
    parser.add_argument("--device", "-d", default="社長PC")
    parser.add_argument("--type", "-t", default="boss", choices=["boss", "staff", "simple"])
    parser.add_argument("--service-account-key", "-k",
        default=str(Path(__file__).resolve().parent.parent / "service_account.json"))
    parser.add_argument("--output", "-o",
        default=str(Path(__file__).resolve().parent.parent / "installers"))
    parser.add_argument("--shared-drive-id", "-s")
    parser.add_argument("--skip-drive", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    sa_key_path = Path(args.service_account_key)

    if not args.shared_drive_id and not args.skip_drive:
        print("エラー: --shared-drive-id を指定してください。")
        sys.exit(1)

    if not args.skip_drive:
        if not sa_key_path.exists():
            print(f"エラー: サービスアカウント鍵ファイルが見つかりません: {sa_key_path}")
            sys.exit(1)
        drive = DriveClient(sa_key_path, shared_drive_id=args.shared_drive_id)
        drive.authenticate()
        create_drive_folders(drive, "02_顧問先共有フォルダ", args.client_name, shared_drive_id=args.shared_drive_id)

    config = generate_client_config(
        client_name=args.client_name, device_name=args.device,
        device_type=args.type, shared_drive_id=args.shared_drive_id,
    )
    package_installer(
        output_dir=Path(args.output), client_name=args.client_name,
        device_name=args.device, config=config, service_account_key_path=sa_key_path,
    )


if __name__ == "__main__":
    main()
