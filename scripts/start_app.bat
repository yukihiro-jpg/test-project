@echo off
chcp 65001 >nul
title 相続税土地評価アプリ

rem スクリプトの親ディレクトリ（プロジェクトルート）へ移動
cd /d "%~dp0\.."

echo.
echo ====================================================
echo  相続税土地評価アプリ
echo ====================================================
echo.

rem ---- 最新版を取得 ----
echo [更新] 最新版を取得しています...
git checkout claude/inheritance-tax-evaluation-5xSvl >nul 2>&1
git pull origin claude/inheritance-tax-evaluation-5xSvl
if errorlevel 1 (
    echo [警告] 更新の取得に失敗しました。前回のバージョンで起動します。
)
echo.

rem ---- 仮想環境 ----
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
    rem 依存パッケージを最新に更新（変更があった場合のみ）
    pip install -e . -q
)

echo.
echo ====================================================
echo  起動中... 3秒後にブラウザが開きます
echo  http://127.0.0.1:8000
echo  終了するには このウィンドウを閉じてください
echo ====================================================
echo.

rem 3秒後にブラウザを開く（別プロセスで遅延実行）
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://127.0.0.1:8000"

rem uvicorn 起動（フォアグラウンド、ソース変更を自動リロード）
uvicorn src.app:app --host 127.0.0.1 --port 8000 --reload

pause
