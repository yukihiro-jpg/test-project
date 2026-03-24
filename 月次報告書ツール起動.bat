@echo off
chcp 65001 > nul
title 月次経営報告書作成ツール

echo ================================================
echo   月次経営報告書作成ツール を起動しています...
echo ================================================
echo.

cd /d "%~dp0"

REM Pythonの存在確認
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo エラー: Pythonがインストールされていません。
    echo https://www.python.org/downloads/ からインストールしてください。
    echo.
    pause
    exit /b 1
)

REM launcher.pyを実行
python launcher.py

if %errorlevel% neq 0 (
    echo.
    echo エラーが発生しました。
    pause
)
