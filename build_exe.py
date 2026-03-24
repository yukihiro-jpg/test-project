"""PyInstallerでデスクトップアプリ(.exe)をビルドするスクリプト

使い方:
    pip install pyinstaller
    python build_exe.py

ビルド後、dist/ フォルダに「月次報告書ツール」フォルダが生成されます。
このフォルダごと配布すれば、Pythonがなくても動作します。
"""

import subprocess
import sys
import os
import shutil


def build():
    project_dir = os.path.dirname(os.path.abspath(__file__))

    # PyInstallerがインストールされているか確認
    try:
        import PyInstaller
    except ImportError:
        print("PyInstallerをインストール中...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller"])

    print("=" * 50)
    print("  デスクトップアプリをビルド中...")
    print("=" * 50)

    # ビルドコマンド
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--name", "月次報告書ツール",
        "--onedir",
        "--console",  # コンソール表示（起動状況が見える）
        "--noconfirm",
        # アプリケーションコード一式を同梱
        "--add-data", f"app.py{os.pathsep}.",
        "--add-data", f"config.py{os.pathsep}.",
        "--add-data", f"ui{os.pathsep}ui",
        "--add-data", f"parsers{os.pathsep}parsers",
        "--add-data", f"analysis{os.pathsep}analysis",
        "--add-data", f"reports{os.pathsep}reports",
        "--add-data", f"utils{os.pathsep}utils",
        # フォントがあれば同梱
        *(["--add-data", f"fonts{os.pathsep}fonts"] if os.path.exists(os.path.join(project_dir, "fonts", "ipaexg.ttf")) else []),
        # 必要なパッケージを明示的にインクルード
        "--hidden-import", "streamlit",
        "--hidden-import", "pandas",
        "--hidden-import", "openpyxl",
        "--hidden-import", "reportlab",
        "--hidden-import", "xlsxwriter",
        "--hidden-import", "streamlit.runtime.scriptrunner",
        "--hidden-import", "streamlit.web.cli",
        # エントリポイント
        "launcher.py",
    ]

    subprocess.check_call(cmd, cwd=project_dir)

    # ビルド成果物の確認
    dist_dir = os.path.join(project_dir, "dist", "月次報告書ツール")
    if os.path.exists(dist_dir):
        print()
        print("=" * 50)
        print("  ビルド完了!")
        print(f"  出力先: {dist_dir}")
        print()
        print("  使い方:")
        print(f"    1. dist/月次報告書ツール/ フォルダを配布先にコピー")
        print(f"    2. 月次報告書ツール.exe をダブルクリック")
        print("=" * 50)
    else:
        print("ビルドに失敗した可能性があります。上記のログを確認してください。")


if __name__ == "__main__":
    build()
