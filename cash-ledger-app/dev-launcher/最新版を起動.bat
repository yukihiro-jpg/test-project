@echo off
chcp 65001 >nul 2>&1
setlocal EnableDelayedExpansion

title 現金出納帳・仮払管理システム - 最新版を起動

set "BRANCH=app/cash-ledger-with-bank-csv"
set "REPO_ROOT=%~dp0..\.."
set "APP_FILE=%REPO_ROOT%\cash-ledger-app\index.html"

cls
echo.
echo ============================================================
echo    現金出納帳・仮払管理システム
echo    最新版の取得と起動（税理士事務所用）
echo ============================================================
echo.
echo  このランチャーは次のことを行います:
echo.
echo    1. GitHub から本番ブランチ ^(%BRANCH%^) の最新を取得
echo    2. Chrome / Edge のアプリモードで index.html を起動
echo.
echo  ※ このフォルダ配下は業務専用クローンとしてご利用ください
echo    （手元で編集すると pull に失敗する場合があります）
echo.

REM ----- リポジトリルートへ移動 -----
pushd "%REPO_ROOT%" >nul 2>&1
if errorlevel 1 (
  echo [エラー] リポジトリルートに移動できません: %REPO_ROOT%
  pause
  exit /b 1
)

REM ----- git の存在確認 -----
where git >nul 2>&1
if errorlevel 1 (
  echo [警告] git が見つかりません。最新版の取得をスキップしてローカルで起動します。
  goto :launch
)

REM ----- git リポジトリかどうか確認 -----
git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo [警告] この場所は git リポジトリではありません。ローカルの内容で起動します。
  goto :launch
)

REM ----- 最新版を取得 -----
echo --- 最新版を取得しています ---
git fetch origin %BRANCH%
if errorlevel 1 (
  echo  [警告] fetch に失敗しました（ネットワーク or 認証）。ローカルの内容で起動します。
  goto :launch
)

REM ----- 現在のブランチを確認し、必要なら切替 -----
for /f "delims=" %%B in ('git rev-parse --abbrev-ref HEAD') do set "CURRENT_BRANCH=%%B"
if not "!CURRENT_BRANCH!"=="%BRANCH%" (
  echo  [情報] ブランチを切り替えます: !CURRENT_BRANCH! -^> %BRANCH%
  git switch %BRANCH% >nul 2>&1
  if errorlevel 1 (
    git switch -c %BRANCH% origin/%BRANCH% >nul 2>&1
    if errorlevel 1 (
      echo  [警告] ブランチ切替に失敗しました。ローカルの内容で起動します。
      goto :launch
    )
  )
)

REM ----- 早送りマージで更新 -----
git pull --ff-only origin %BRANCH%
if errorlevel 1 (
  echo  [警告] pull に失敗しました（手元に未コミットの変更があるかも）。
  echo         ローカルの内容で起動します。
) else (
  echo  [OK] 最新版に更新しました
)

:launch
echo.
if not exist "%APP_FILE%" (
  echo [エラー] index.html が見つかりません: %APP_FILE%
  popd
  pause
  exit /b 1
)

REM ----- Chrome 検出 -----
set "BROWSER="
set "BROWSER_NAME="
for %%P in (
  "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
  "%PROGRAMFILES%\Google\Chrome\Application\chrome.exe"
  "%PROGRAMFILES(X86)%\Google\Chrome\Application\chrome.exe"
) do (
  if not defined BROWSER if exist "%%~P" (
    set "BROWSER=%%~P"
    set "BROWSER_NAME=Google Chrome"
  )
)

REM ----- Edge 検出（Chrome 未導入時のフォールバック） -----
if not defined BROWSER (
  for %%P in (
    "%PROGRAMFILES(X86)%\Microsoft\Edge\Application\msedge.exe"
    "%PROGRAMFILES%\Microsoft\Edge\Application\msedge.exe"
  ) do (
    if not defined BROWSER if exist "%%~P" (
      set "BROWSER=%%~P"
      set "BROWSER_NAME=Microsoft Edge"
    )
  )
)

REM ----- file:// URL 用にバックスラッシュをスラッシュへ変換 -----
set "APP_FILE_FWD=!APP_FILE:\=/!"

echo --- アプリを起動します ---
if defined BROWSER (
  echo  [OK] !BROWSER_NAME! のアプリモードで起動します
  start "" "!BROWSER!" --app="file:///!APP_FILE_FWD!"
) else (
  echo  [情報] Chrome/Edge が見つからないため、既定のブラウザで開きます
  start "" "file:///!APP_FILE_FWD!"
)

popd
echo.
echo このウィンドウは数秒後に自動で閉じます。
ping -n 3 127.0.0.1 >nul 2>&1
endlocal
exit /b 0
