@echo off
chcp 932 >/dev/null 2>&1
setlocal EnableDelayedExpansion

title 現金出納帳・仮払管理システム インストーラー

set "TARGET_DIR=%USERPROFILE%\Documents\現金出納帳"
set "APP_FILE=%TARGET_DIR%\index.html"
set "ICON_FILE=%TARGET_DIR%\app.ico"
set "SOURCE=%~dp0index.html"
set "ICON_SOURCE=%~dp0app.ico"
set "DESKTOP=%USERPROFILE%\Desktop"
set "SHORTCUT=%DESKTOP%\現金出納帳.lnk"
set "URL_SHORTCUT=%DESKTOP%\現金出納帳.url"

cls
echo.
echo ============================================================
echo    現金出納帳・仮払管理システム
echo    かんたんインストーラー
echo ============================================================
echo.
echo  このインストーラーは次のことを行います:
echo.
echo    1. アプリ本体を以下のフォルダにコピーします
echo       %TARGET_DIR%
echo    2. デスクトップに起動アイコンを作成します
echo       （ブラウザのタブではなく、アプリ専用ウィンドウで開きます）
echo.
echo  ※ ネットワーク通信は一切行いません
echo  ※ すべてのデータはご利用のパソコン内に保存されます
echo.

if not exist "%SOURCE%" (
  echo [エラー] index.html が見つかりません。
  echo このバッチファイルは index.html と同じフォルダから実行してください。
  echo.
  pause
  exit /b 1
)

echo Enterキーでインストールを開始します。
echo （中止する場合はこのウィンドウを閉じてください）
pause >/dev/null

echo.
echo --- インストール中 ---

if not exist "%TARGET_DIR%" mkdir "%TARGET_DIR%"

if exist "%APP_FILE%" (
  echo  [情報] 既存のアプリを最新版に更新します
  echo         （登録済みデータは保持されます）
)

copy /Y "%SOURCE%" "%APP_FILE%" >/dev/null
if errorlevel 1 (
  echo [エラー] ファイルのコピーに失敗しました。
  echo         ウイルス対策ソフトの設定や、書き込み権限をご確認ください。
  pause
  exit /b 1
)
echo  [OK] アプリ本体をコピーしました

if exist "%ICON_SOURCE%" (
  copy /Y "%ICON_SOURCE%" "%ICON_FILE%" >/dev/null
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

REM 既存ショートカットがあれば削除（再インストール時の重複防止）
if exist "%SHORTCUT%" del /F /Q "%SHORTCUT%" >/dev/null 2>&1
if exist "%URL_SHORTCUT%" del /F /Q "%URL_SHORTCUT%" >/dev/null 2>&1

REM file:// URL 用にバックスラッシュをスラッシュへ変換
set "APP_FILE_FWD=!APP_FILE:\=/!"

set "LAUNCH_MODE="
if defined BROWSER (
  REM 日本語パスは環境変数経由で PowerShell に渡す（コマンドライン直書きの文字化けを回避）
  set "SC_PATH=%SHORTCUT%"
  set "SC_TARGET=%BROWSER%"
  set "SC_URL=file:///!APP_FILE_FWD!"
  set "SC_WORKDIR=%TARGET_DIR%"
  set "SC_ICON=%ICON_FILE%"
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws=New-Object -ComObject WScript.Shell; $sc=$ws.CreateShortcut($env:SC_PATH); $sc.TargetPath=$env:SC_TARGET; $sc.Arguments='--app=' + [char]34 + $env:SC_URL + [char]34; $sc.WorkingDirectory=$env:SC_WORKDIR; if (Test-Path $env:SC_ICON) { $sc.IconLocation=$env:SC_ICON } else { $sc.IconLocation=$env:SC_TARGET + ',0' }; $sc.Save()" >/dev/null 2>&1
  if exist "%SHORTCUT%" (
    echo  [OK] デスクトップに「現金出納帳」アイコンを作成しました
    echo       （!BROWSER_NAME! のアプリ専用ウィンドウで起動します）
    set "LAUNCH_MODE=APP"
  ) else (
    echo  [警告] アプリ専用ウィンドウのアイコン作成に失敗しました。
    echo         通常のショートカットで代替します（ブラウザのタブで開きます）。
    > "%URL_SHORTCUT%" echo [InternetShortcut]
    >> "%URL_SHORTCUT%" echo URL=file:///!APP_FILE_FWD!
    set "LAUNCH_MODE=URL"
  )
) else (
  > "%URL_SHORTCUT%" echo [InternetShortcut]
  >> "%URL_SHORTCUT%" echo URL=file:///!APP_FILE_FWD!
  echo  [OK] デスクトップにショートカットを作成しました
  echo       （既定のブラウザで起動します）
  set "LAUNCH_MODE=URL"
)

echo.
echo ============================================================
echo    インストール完了！
echo ============================================================
echo.
echo  デスクトップの「現金出納帳」アイコンを
echo  ダブルクリックすると起動できます。
echo.
echo  困ったときは「はじめにお読みください.txt」をご覧ください。
echo.

choice /M "今すぐ起動しますか" /C YN /N
if errorlevel 2 goto :end

if "!LAUNCH_MODE!"=="APP" (
  start "" "%BROWSER%" --app="file:///!APP_FILE_FWD!"
) else (
  start "" "%APP_FILE%"
)

:end
echo.
echo このウィンドウは閉じてかまいません。
pause
endlocal
