@echo off
chcp 65001 >nul
title 営業成績ダッシュボード

echo ========================================
echo   営業成績ダッシュボード を起動中...
echo ========================================
echo.

cd /d "%~dp0"

REM 初回のみ：必要なライブラリをインストール
pip show streamlit >nul 2>&1
if errorlevel 1 (
    echo 初回セットアップ中...必要なライブラリをインストールしています
    pip install -r requirements.txt
    echo.
)

echo ブラウザが自動で開きます。少しお待ちください...
echo 終了するには、このウィンドウを閉じてください。
echo.

streamlit run app.py --server.port 8501
pause
