"""デスクトップランチャー - ダブルクリックでアプリを起動"""

import subprocess
import sys
import os
import webbrowser
import time
import socket


def get_project_dir():
    """プロジェクトディレクトリを取得（exe化対応）"""
    if getattr(sys, "frozen", False):
        # PyInstallerでビルドされた場合
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))


def find_free_port(start=8501, end=8599):
    """空きポートを探す"""
    for port in range(start, end):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("localhost", port))
                return port
            except OSError:
                continue
    return start


def find_streamlit():
    """Streamlitの実行パスを探す"""
    # 1. 同じPython環境のstreamlit
    python_dir = os.path.dirname(sys.executable)
    candidates = [
        os.path.join(python_dir, "streamlit"),
        os.path.join(python_dir, "streamlit.exe"),
        os.path.join(python_dir, "Scripts", "streamlit.exe"),  # Windows venv
        os.path.join(python_dir, "Scripts", "streamlit"),
    ]
    for path in candidates:
        if os.path.exists(path):
            return path

    # 2. PATHから探す
    import shutil
    streamlit_path = shutil.which("streamlit")
    if streamlit_path:
        return streamlit_path

    return None


def check_dependencies():
    """必要なパッケージがインストールされているか確認"""
    missing = []
    for package in ["streamlit", "pandas", "openpyxl", "reportlab", "xlsxwriter"]:
        try:
            __import__(package)
        except ImportError:
            missing.append(package)
    return missing


def install_dependencies(project_dir):
    """依存パッケージをインストール"""
    req_file = os.path.join(project_dir, "requirements.txt")
    if os.path.exists(req_file):
        print("必要なパッケージをインストール中...")
        subprocess.check_call([
            sys.executable, "-m", "pip", "install", "-r", req_file, "--quiet"
        ])
        print("インストール完了")
    else:
        print("requirements.txt が見つかりません")


def main():
    project_dir = get_project_dir()
    app_path = os.path.join(project_dir, "app.py")

    print("=" * 50)
    print("  月次経営報告書作成ツール")
    print("=" * 50)
    print()

    # app.py の存在確認
    if not os.path.exists(app_path):
        print(f"エラー: app.py が見つかりません")
        print(f"確認パス: {app_path}")
        input("\nEnterキーで終了...")
        sys.exit(1)

    # 依存パッケージの確認
    missing = check_dependencies()
    if missing:
        print(f"不足パッケージ: {', '.join(missing)}")
        print("自動インストールを実行します...")
        try:
            install_dependencies(project_dir)
        except Exception as e:
            print(f"インストールに失敗しました: {e}")
            print("手動で以下を実行してください:")
            print(f"  pip install -r {os.path.join(project_dir, 'requirements.txt')}")
            input("\nEnterキーで終了...")
            sys.exit(1)

    # Streamlitを探す
    streamlit_cmd = find_streamlit()

    # 空きポートを探す
    port = find_free_port()
    url = f"http://localhost:{port}"

    print(f"アプリを起動中...")
    print(f"URL: {url}")
    print()
    print("終了するにはこのウィンドウを閉じてください")
    print("-" * 50)

    # Streamlitを起動
    try:
        if streamlit_cmd:
            cmd = [
                streamlit_cmd, "run", app_path,
                "--server.port", str(port),
                "--server.headless", "true",
                "--browser.gatherUsageStats", "false",
                "--server.address", "localhost",
            ]
        else:
            # streamlitコマンドが見つからない場合、python -m streamlit で起動
            cmd = [
                sys.executable, "-m", "streamlit", "run", app_path,
                "--server.port", str(port),
                "--server.headless", "true",
                "--browser.gatherUsageStats", "false",
                "--server.address", "localhost",
            ]

        # サーバー起動
        process = subprocess.Popen(
            cmd,
            cwd=project_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )

        # サーバーの起動を待ってからブラウザを開く
        opened = False
        for line in iter(process.stdout.readline, ""):
            print(line, end="")
            if not opened and ("You can now view" in line or "Local URL" in line or "Network URL" in line):
                webbrowser.open(url)
                opened = True

        # 一定時間経ってもメッセージが出ない場合のフォールバック
        if not opened:
            time.sleep(3)
            webbrowser.open(url)

        process.wait()

    except KeyboardInterrupt:
        print("\nアプリを停止中...")
        process.terminate()
        process.wait()
    except FileNotFoundError:
        print("エラー: Streamlitが見つかりません")
        print("以下のコマンドでインストールしてください:")
        print("  pip install streamlit")
        input("\nEnterキーで終了...")
        sys.exit(1)


if __name__ == "__main__":
    main()
