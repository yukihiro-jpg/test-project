@echo off
chcp 65001 > nul
setlocal

echo ============================================================
echo 日下部税理士事務所 ファイル同期エージェント アンインストール
echo ============================================================
echo.

set APP_DIR=%APPDATA%\KusakabeSyncAgent

echo タスクスケジューラを削除中...
schtasks /Delete /TN "KusakabeSyncAgent" /F > nul 2>&1
schtasks /Delete /TN "KusakabeSyncAgentLogon" /F > nul 2>&1

echo アプリケーションデータを削除中...
if exist "%APP_DIR%" rmdir /S /Q "%APP_DIR%"

echo.
echo ============================================================
echo アンインストール完了
echo ============================================================
echo.
echo デスクトップの「日下部税理士事務所」フォルダはそのまま残っています。
echo 不要であれば手動で削除してください。
echo.
pause
