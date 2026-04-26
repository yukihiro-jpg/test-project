@echo off
chcp 65001 > nul
title 通帳解析アプリ
cd /d "%~dp0"

REM 認証プロンプトでハングさせない
set GIT_TERMINAL_PROMPT=0
set GCM_INTERACTIVE=Never

echo ====================================
echo  通帳解析アプリ
echo ====================================
echo.

echo [1/4] 最新版を取得しています...
echo   ※ 30秒以上止まる場合は Ctrl+C → Y で中断できます（既存版で起動継続）
echo.
git stash --include-untracked --quiet 2>nul

REM 30秒以上 1KB/s を下回ったら自動でタイムアウトさせる
git -c http.lowSpeedLimit=1024 -c http.lowSpeedTime=30 pull --ff-only origin claude/bank-statement-analyzer-XMaDE
if errorlevel 1 (
  echo.
  echo 警告: 最新版の取得に失敗しました（オフライン/認証/タイムアウト等）。
  echo 既存のローカル版で起動を続行します。
  echo.
)

echo.
echo [2/4] 依存パッケージを確認しています...
call npm install --no-audit --no-fund
if errorlevel 1 (
  echo.
  echo エラー: npm install に失敗しました。Node.js が入っているか確認してください。
  pause
  exit /b 1
)

echo.
echo [3/4] 10 秒後にブラウザで http://localhost:3001 を開きます...
start "" /min cmd /c "timeout /t 10 > nul & start http://localhost:3001"

echo.
echo [4/4] サーバーを起動します。終了は Ctrl+C で。
echo ====================================
echo.
call npm run dev
