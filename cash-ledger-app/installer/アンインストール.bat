@echo off
chcp 932 >nul 2>&1
setlocal EnableDelayedExpansion

title 現金出納帳 アンインストーラー

REM 実 Desktop / Documents の取得
set "DESKTOP="
set "DOCUMENTS="
for /f "usebackq delims=" %%A in (`powershell -NoProfile -Command "[Environment]::GetFolderPath('Desktop')"`) do set "DESKTOP=%%A"
for /f "usebackq delims=" %%A in (`powershell -NoProfile -Command "[Environment]::GetFolderPath('MyDocuments')"`) do set "DOCUMENTS=%%A"
if not defined DESKTOP set "DESKTOP=%USERPROFILE%\Desktop"
if not defined DOCUMENTS set "DOCUMENTS=%USERPROFILE%\Documents"

set "TARGET_DIR=%DOCUMENTS%\現金出納帳"
set "SHORTCUT=%DESKTOP%\現金出納帳.lnk"
set "URL_SHORTCUT=%DESKTOP%\現金出納帳.url"

cls
echo.
echo ============================================================
echo    現金出納帳 アンインストーラー
echo ============================================================
echo.
echo  以下を削除します:
echo.
echo    ・デスクトップの「現金出納帳」アイコン
echo    ・アプリ本体フォルダ
echo      %TARGET_DIR%
echo.
echo  【重要】
echo  入力済みの現金出納帳・仮払・銀行CSVなどのデータは
echo  Webブラウザ内に保存されています。
echo  ブラウザの「サイト データを削除」を行わない限り、
echo  再インストール時にそのまま使えます。
echo.

choice /M "本当にアンインストールしますか" /C YN /N
if errorlevel 2 (
  echo 中止しました。
  pause
  exit /b 0
)

echo.
echo --- アンインストール中 ---

if exist "%SHORTCUT%" (
  del /F /Q "%SHORTCUT%"
  echo  [OK] デスクトップのアイコンを削除しました
)
if exist "%URL_SHORTCUT%" (
  del /F /Q "%URL_SHORTCUT%"
  echo  [OK] デスクトップのショートカットを削除しました
)

REM 旧バージョン（%USERPROFILE%\Desktop に作っていたもの）も掃除
if /I not "%DESKTOP%"=="%USERPROFILE%\Desktop" (
  if exist "%USERPROFILE%\Desktop\現金出納帳.lnk" del /F /Q "%USERPROFILE%\Desktop\現金出納帳.lnk" >nul 2>&1
  if exist "%USERPROFILE%\Desktop\現金出納帳.url" del /F /Q "%USERPROFILE%\Desktop\現金出納帳.url" >nul 2>&1
)

REM 旧バージョン（%USERPROFILE%\Documents に置いていたもの）も掃除
if /I not "%DOCUMENTS%"=="%USERPROFILE%\Documents" (
  if exist "%USERPROFILE%\Documents\現金出納帳" rmdir /S /Q "%USERPROFILE%\Documents\現金出納帳" >nul 2>&1
)

if exist "%TARGET_DIR%" (
  rmdir /S /Q "%TARGET_DIR%"
  echo  [OK] アプリ本体フォルダを削除しました
)

echo.
echo ============================================================
echo    アンインストール完了
echo ============================================================
echo.
pause
endlocal
