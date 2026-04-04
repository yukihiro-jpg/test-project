"""デスクトップアプリ エントリーポイント

pywebviewを使用してネイティブウィンドウでFastAPIアプリを表示する。
pywebviewが利用できない環境（サーバー等）ではブラウザモードで起動する。
"""

from __future__ import annotations

import sys
import threading
import time

import uvicorn


def start_server(host: str = "127.0.0.1", port: int = 8756) -> None:
    """FastAPIサーバーをバックグラウンドで起動"""
    from yokin_chosa.app import app
    uvicorn.run(app, host=host, port=port, log_level="warning")


def main() -> None:
    host = "127.0.0.1"
    port = 8756
    url = f"http://{host}:{port}"

    # サーバーをバックグラウンドスレッドで起動
    server_thread = threading.Thread(
        target=start_server, args=(host, port), daemon=True
    )
    server_thread.start()

    # サーバー起動待ち
    time.sleep(1)

    # pywebviewでネイティブウィンドウを表示（利用可能な場合）
    try:
        import webview
        webview.create_window(
            "預金調査ツール",
            url,
            width=1400,
            height=900,
            min_size=(800, 600),
        )
        webview.start()
    except ImportError:
        # pywebviewが無い場合はブラウザで開く
        import webbrowser
        print(f"預金調査ツールを起動しました: {url}")
        print("ブラウザが自動で開きます。終了するにはCtrl+Cを押してください。")
        webbrowser.open(url)
        try:
            server_thread.join()
        except KeyboardInterrupt:
            print("\n終了します。")
            sys.exit(0)


if __name__ == "__main__":
    main()
