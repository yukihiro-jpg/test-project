@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ===== 最新バージョンに更新中... =====
git pull 2>nul
if errorlevel 1 (
    echo [注意] Git更新をスキップしました（オフラインまたはGit未設定）
)

echo ===== 依存パッケージを確認中... =====
call npm install --silent 2>nul

echo ===== アプリを起動中... =====
start "" cmd /c "npm run dev"
timeout /t 3 /nobreak >nul
start http://localhost:3000
echo.
echo ブラウザでアプリが開きます。
echo このウィンドウは閉じても構いません。
