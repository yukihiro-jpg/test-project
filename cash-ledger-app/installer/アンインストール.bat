@echo off
chcp 65001 >nul 2>&1
setlocal EnableDelayedExpansion

title 現金出納帳 アンインストーラー

set "APP_NAME=現金出納帳"
set "TARGET_DIR=%USERPROFILE%\Documents\現金出納帳"
set "DESKTOP=%USERPROFILE%\Desktop"
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
