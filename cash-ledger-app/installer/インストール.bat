@echo off
chcp 65001 >nul 2>&1
setlocal EnableDelayedExpansion

title 現金出納帳・仮払管理システム インストーラー

set "APP_NAME=現金出納帳"
set "TARGET_DIR=%USERPROFILE%\Documents\現金出納帳"
set "APP_FILE=%TARGET_DIR%\index.html"
set "SOURCE=%~dp0index.html"
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
pause >nul

echo.
echo --- インストール中 ---

REM フォルダ作成
if not exist "%TARGET_DIR%" mkdir "%TARGET_DIR%"

REM 既存上書き確認
if exist "%APP_FILE%" (
  echo  [情報] 既存のアプリを最新版に更新します
  echo         （登録済みデータは保持されます）
)

REM ファイルコピー
copy /Y "%SOURCE%" "%APP_FILE%" >nul
if errorlevel 1 (
  echo [エラー] ファイルのコピーに失敗しました。
  echo         ウイルス対策ソフトの設定や、書き込み権限をご確認ください。
  pause
  exit /b 1
)
echo  [OK] アプリ本体をコピーしました

REM Chrome 検出
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

REM Edge 検出（Chrome 未導入時のフォールバック）
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
if exist "%SHORTCUT%" del /F /Q "%SHORTCUT%" >nul 2>&1
if exist "%URL_SHORTCUT%" del /F /Q "%URL_SHORTCUT%" >nul 2>&1

REM file:// URL 用にバックスラッシュをスラッシュへ変換
set "APP_FILE_FWD=!APP_FILE:\=/!"

if defined BROWSER (
  REM Chrome / Edge のアプリモードで .lnk を作成
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws=New-Object -ComObject WScript.Shell; $sc=$ws.CreateShortcut('%SHORTCUT%'); $sc.TargetPath='%BROWSER%'; $sc.Arguments='--app=' + [char]34 + 'file:///!APP_FILE_FWD!' + [char]34; $sc.WorkingDirectory='%TARGET_DIR%'; $sc.IconLocation='%BROWSER%,0'; $sc.Save()"
  if errorlevel 1 (
    echo  [警告] アイコン作成に失敗したため、簡易ショートカットで代替します
    > "%URL_SHORTCUT%" echo [InternetShortcut]
    >> "%URL_SHORTCUT%" echo URL=file:///!APP_FILE_FWD!
    set "LAUNCH_MODE=URL"
  ) else (
    echo  [OK] デスクトップに「現金出納帳」アイコンを作成しました
    echo       （!BROWSER_NAME! のアプリモードで起動します）
    set "LAUNCH_MODE=APP"
  )
) else (
  REM ブラウザ未検出時は .url で既定ブラウザに開かせる
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
