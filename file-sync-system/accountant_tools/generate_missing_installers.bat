@echo off
chcp 65001 > nul
cd /d "%~dp0\.."

echo ============================================================
echo 顧問先インストーラー一括生成ツール
echo ============================================================
echo.
echo スプレッドシートの顧問先URL一覧を読み込み、
echo 未生成の顧問先のインストーラーを自動作成します。
echo.

echo [1/2] 社長PC用インストーラーを生成中...
python accountant_tools\sync_installers.py --device 社長PC --type boss
if errorlevel 1 (
    echo エラーが発生しました
    pause
    exit /b 1
)

echo.
echo [2/2] スタッフPC用インストーラーを生成中...
python accountant_tools\sync_installers.py --device スタッフPC --type staff
if errorlevel 1 (
    echo エラーが発生しました
    pause
    exit /b 1
)

echo.
echo ============================================================
echo 完了しました
echo ============================================================
echo.
echo installers フォルダを確認してください。
echo.
pause
