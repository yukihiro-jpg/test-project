@echo off
chcp 65001 >nul
title 相続税土地評価アプリ

rem スクリプトの親ディレクトリ（プロジェクトルート）へ移動
cd /d "%~dp0\.."

rem 仮想環境が無ければ作成
if not exist ".venv\Scripts\activate.bat" (
    echo [初回起動] 仮想環境を作成しています...
    python -m venv .venv
    if errorlevel 1 (
        echo.
        echo [ERROR] Python が見つかりません。Python 3.10 以降をインストールしてください。
        pause
        exit /b 1
    )
    call .venv\Scripts\activate.bat
    echo [初回起動] 依存パッケージをインストールしています...
    python -m pip install --upgrade pip
    pip install -e .
) else (
    call .venv\Scripts\activate.bat
)

echo.
echo ====================================================
echo  相続税土地評価アプリ を起動しています...
echo  3秒後にブラウザで http://127.0.0.1:8000 を開きます
echo  終了するには このウィンドウを閉じてください
echo ====================================================
echo.

rem 3秒後にブラウザを開く（別プロセスで遅延実行）
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://127.0.0.1:8000"

rem uvicorn 起動（フォアグラウンド、ソース変更を自動リロード）
uvicorn src.app:app --host 127.0.0.1 --port 8000 --reload

pause
