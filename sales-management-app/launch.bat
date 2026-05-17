@echo off
REM 販売管理アプリ ランチャー
REM 最新のソースコードでアプリを起動します（git pull → npm install → npm run dev）。
setlocal
cd /d "%~dp0"

echo ========================================
echo   販売管理アプリを起動します
echo ========================================
echo.

REM 最新コードを取得（ネットワークが無い場合はスキップ）
echo [1/3] 最新コードを取得中...
git pull --ff-only 2>nul
if %ERRORLEVEL% NEQ 0 (
  echo   ※ git pull をスキップしました（オフラインまたは未変更）
)

REM 依存パッケージを確認（差分があれば自動で取得）
echo [2/3] 依存パッケージを確認中...
call npm install --silent --no-audit --no-fund

REM アプリ起動
echo [3/3] アプリを起動します。閉じるにはこのウィンドウで Ctrl+C を押してください。
echo.
call npm run dev

endlocal
