@echo off
chcp 65001 > nul
title 通帳解析アプリ
cd /d "%~dp0"

echo ====================================
echo  通帳解析アプリ
echo ====================================
echo.

echo [1/4] 最新版を取得しています...
git stash --include-untracked --quiet 2>nul
git fetch origin
git checkout claude/bank-statement-analyzer-XMaDE
git pull origin claude/bank-statement-analyzer-XMaDE
if errorlevel 1 (
  echo.
  echo 警告: git pull に失敗しました。オフラインまたはネットワーク不通の可能性があります。
  echo 既存のバージョンで起動します...
  echo.
)

echo.
echo [2/4] 依存パッケージを確認しています...
call npm install --no-audit --no-fund
if errorlevel 1 (
  echo.
  echo エラー: npm install に失敗しました。Node.js がインストールされているか確認してください。
  pause
  exit /b 1
)

echo.
echo [3/4] 10 秒後にブラウザで http://localhost:3001 を開きます...
start "" /min cmd /c "timeout /t 10 > nul & start http://localhost:3001"

echo.
echo [4/4] サーバーを起動します。
echo このウィンドウを閉じるか Ctrl+C で停止します。
echo ====================================
echo.
call npm run dev
