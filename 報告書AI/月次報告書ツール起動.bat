@echo off
chcp 65001 > nul
title 月次経営報告書作成ツール

echo ================================================
echo   月次経営報告書作成ツール を起動しています...
echo ================================================
echo.

cd /d "%~dp0"

REM Pythonの存在確認（python / python3 / py コマンドを順に試す）
python --version >nul 2>&1
if %errorlevel% equ 0 (
    echo Python を検出しました。
    python launcher.py
    goto :done
)

python3 --version >nul 2>&1
if %errorlevel% equ 0 (
    echo Python3 を検出しました。
    python3 launcher.py
    goto :done
)

py --version >nul 2>&1
if %errorlevel% equ 0 (
    echo Python(py) を検出しました。
    py launcher.py
    goto :done
)

echo.
echo ============================================
echo   エラー: Pythonが見つかりません
echo ============================================
echo.
echo このツールの実行にはPythonが必要です。
echo.
echo 【インストール手順】
echo   1. https://www.python.org/downloads/ を開く
echo   2. 「Download Python 3.xx」ボタンをクリック
echo   3. インストーラーを実行
echo   4. ★重要★「Add Python to PATH」にチェックを入れる
echo   5. 「Install Now」をクリック
echo   6. インストール完了後、PCを再起動
echo   7. このファイルを再度ダブルクリック
echo.

:done
echo.
pause
