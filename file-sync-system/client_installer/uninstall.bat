@echo off
chcp 65001 > nul
setlocal

echo ============================================================
echo 日下部税理士事務所 ファイル同期エージェント アンインストール
echo ============================================================
echo.

REM --- config.json から識別子を読み取る（複数社対応） ---
set "APP_DIR_NAME=KusakabeSyncAgent"
for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; $c=Get-Content '%~dp0config.json' -Raw -Encoding UTF8 | ConvertFrom-Json; if($c.app_dir_name){$c.app_dir_name}else{'KusakabeSyncAgent'}"`) do set "APP_DIR_NAME=%%i"

set "APP_DIR=%APPDATA%\%APP_DIR_NAME%"

echo タスクスケジューラを削除中...
schtasks /Delete /TN "%APP_DIR_NAME%" /F > nul 2>&1
schtasks /Delete /TN "%APP_DIR_NAME%Logon" /F > nul 2>&1

echo アプリケーションデータを削除中...
if exist "%APP_DIR%" rmdir /S /Q "%APP_DIR%"

echo.
echo ============================================================
echo アンインストール完了
echo ============================================================
echo.
echo デスクトップのフォルダはそのまま残っています。
echo 不要であれば手動で削除してください。
echo.
pause
