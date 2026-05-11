@echo off
chcp 65001 >nul
title 銀行CSV修正ツール
cd /d "%~dp0"

echo ============================================
echo    銀行CSV修正ツール - 起動中
echo ============================================
echo.

echo [1/3] 最新版を取得しています...
git pull --ff-only
if errorlevel 1 (
    echo.
    echo [警告] git pull に失敗しました（ネットワーク不安定の可能性）。
    echo        現在の版のまま起動を続行します。
    echo.
)

echo.
echo [2/3] 依存パッケージを確認しています...
call pnpm install
if errorlevel 1 (
    echo.
    echo [エラー] 依存パッケージのインストールに失敗しました。
    echo         ウィンドウを閉じる前にメッセージを確認してください。
    pause
    exit /b 1
)

echo.
echo [3/3] アプリを起動します。
echo        起動完了するとブラウザが自動で開きます。
echo        終了するときはこのウィンドウを閉じてください。
echo ============================================
echo.

call pnpm launch

echo.
echo アプリが終了しました。
pause
