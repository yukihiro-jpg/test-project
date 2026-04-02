"""
Google共有ドライブ連携モジュール

Google共有ドライブのフォルダを監視し、新しいファイルが追加されたら
自動的に仕訳CSV生成を実行する。

使い方:
  # フォルダ監視モード（自動実行）
  python -m modules.gdrive_sync --watch

  # 手動トリガー（1回だけ実行）
  python -m modules.gdrive_sync --run 山田商事

  # 全顧問先を一括処理
  python -m modules.gdrive_sync --run-all

前提条件:
  Google共有ドライブがローカルにマウントされていること
  （Google Drive for Desktop、rclone mount、等）
  config.py の 顧問先フォルダ が共有ドライブ上のパスを指していること
"""
import os
import sys
import time
import json
from datetime import datetime


def _ファイル変更検出(顧問先パス):
    """
    当月資料フォルダに前回チェック以降に追加されたファイルがあるか検出

    戻り値:
        list: 新規ファイルパスのリスト
    """
    資料フォルダ = os.path.join(顧問先パス, "当月資料")
    if not os.path.isdir(資料フォルダ):
        return []

    # 前回チェック時刻を読み込み
    状態ファイル = os.path.join(顧問先パス, ".last_check.json")
    前回時刻 = 0
    if os.path.isfile(状態ファイル):
        with open(状態ファイル, "r", encoding="utf-8") as f:
            状態 = json.load(f)
            前回時刻 = 状態.get("last_check", 0)

    # 新規ファイルを検出
    新規ファイル = []
    for ファイル名 in os.listdir(資料フォルダ):
        ファイルパス = os.path.join(資料フォルダ, ファイル名)
        if os.path.isfile(ファイルパス):
            更新時刻 = os.path.getmtime(ファイルパス)
            if 更新時刻 > 前回時刻:
                新規ファイル.append(ファイルパス)

    return 新規ファイル


def _チェック時刻更新(顧問先パス):
    """前回チェック時刻を現在時刻に更新"""
    状態ファイル = os.path.join(顧問先パス, ".last_check.json")
    with open(状態ファイル, "w", encoding="utf-8") as f:
        json.dump({"last_check": time.time()}, f)


def 顧問先自動処理(顧問先パス):
    """
    顧問先フォルダを処理する（main.py の顧問先処理を呼び出す）

    戻り値:
        bool: 処理が実行されたかどうか
    """
    新規 = _ファイル変更検出(顧問先パス)
    if not 新規:
        return False

    顧問先名 = os.path.basename(顧問先パス)
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {顧問先名}: 新規ファイル{len(新規)}件を検出")
    for f in 新規:
        print(f"  + {os.path.basename(f)}")

    # main.pyの処理関数を呼び出し
    # ここではsys.pathを調整してインポート
    ツールルート = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if ツールルート not in sys.path:
        sys.path.insert(0, ツールルート)

    from main import 顧問先処理
    顧問先処理(顧問先パス)

    _チェック時刻更新(顧問先パス)
    return True


def フォルダ監視(顧問先フォルダ, 間隔秒=60):
    """
    全顧問先フォルダを定期的に監視し、変更があれば自動処理する

    引数:
        顧問先フォルダ: clients/ フォルダのパス
        間隔秒: チェック間隔（デフォルト60秒）
    """
    print(f"フォルダ監視を開始します（間隔: {間隔秒}秒）")
    print(f"監視対象: {顧問先フォルダ}")
    print("Ctrl+C で停止")
    print()

    while True:
        try:
            if not os.path.isdir(顧問先フォルダ):
                time.sleep(間隔秒)
                continue

            for 名前 in os.listdir(顧問先フォルダ):
                if 名前.startswith("_"):
                    continue
                顧問先パス = os.path.join(顧問先フォルダ, 名前)
                if not os.path.isdir(顧問先パス):
                    continue
                try:
                    顧問先自動処理(顧問先パス)
                except Exception as e:
                    print(f"[エラー] {名前}: {e}")

            time.sleep(間隔秒)

        except KeyboardInterrupt:
            print("\nフォルダ監視を停止しました。")
            break


def main():
    """コマンドラインエントリポイント"""
    import argparse

    # kaikei_toolディレクトリをパスに追加
    ツールルート = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if ツールルート not in sys.path:
        sys.path.insert(0, ツールルート)

    from config import 顧問先フォルダ as デフォルトフォルダ

    parser = argparse.ArgumentParser(description="Google共有ドライブ連携")
    parser.add_argument("--watch", action="store_true", help="フォルダ監視モード")
    parser.add_argument("--run", metavar="顧問先名", help="指定した顧問先を手動処理")
    parser.add_argument("--run-all", action="store_true", help="全顧問先を一括処理")
    parser.add_argument("--interval", type=int, default=60, help="監視間隔（秒、デフォルト60）")
    args = parser.parse_args()

    if args.watch:
        フォルダ監視(デフォルトフォルダ, args.interval)
    elif args.run:
        顧問先パス = os.path.join(デフォルトフォルダ, args.run)
        if not os.path.isdir(顧問先パス):
            print(f"エラー: 顧問先フォルダが見つかりません: {顧問先パス}")
            sys.exit(1)
        from main import 顧問先処理
        顧問先処理(顧問先パス)
    elif args.run_all:
        if not os.path.isdir(デフォルトフォルダ):
            print("顧問先フォルダがありません。")
            sys.exit(1)
        for 名前 in sorted(os.listdir(デフォルトフォルダ)):
            if 名前.startswith("_"):
                continue
            顧問先パス = os.path.join(デフォルトフォルダ, 名前)
            if os.path.isdir(顧問先パス):
                try:
                    from main import 顧問先処理
                    顧問先処理(顧問先パス)
                except Exception as e:
                    print(f"[エラー] {名前}: {e}")
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
