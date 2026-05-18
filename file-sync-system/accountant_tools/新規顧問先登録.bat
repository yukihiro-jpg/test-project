@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

REM ============================================================
REM  新規顧問先登録ツール
REM ------------------------------------------------------------
REM  デスクトップにフォルダごと置いてダブルクリックで起動。
REM  ・このBATと同じフォルダの「インストーラー」フォルダに出力
REM  ・test-project リポジトリは自動検出（事務所PC/自宅PCどちらでも）
REM ============================================================

set "KIT_DIR=%~dp0"
if "%KIT_DIR:~-1%"=="\" set "KIT_DIR=%KIT_DIR:~0,-1%"
set "INSTALLERS_DIR=%KIT_DIR%\インストーラー"

REM リポジトリのパスを自動検出
set "REPO_DIR="
if exist "C:\Users\yukihiro\test-project\file-sync-system\accountant_tools\new_client_wizard.py" (
    set "REPO_DIR=C:\Users\yukihiro\test-project\file-sync-system"
) else if exist "C:\Users\user\test-project\file-sync-system\accountant_tools\new_client_wizard.py" (
    set "REPO_DIR=C:\Users\user\test-project\file-sync-system"
) else if exist "%USERPROFILE%\test-project\file-sync-system\accountant_tools\new_client_wizard.py" (
    set "REPO_DIR=%USERPROFILE%\test-project\file-sync-system"
)

if "!REPO_DIR!"=="" (
    echo ============================================================
    echo  エラー: test-project リポジトリが見つかりません
    echo ============================================================
    echo.
    echo 以下のいずれかの場所に test-project があることを確認してください:
    echo   C:\Users\yukihiro\test-project
    echo   C:\Users\user\test-project
    echo   %%USERPROFILE%%\test-project
    echo.
    pause
    exit /b 1
)

echo ============================================================
echo  新規顧問先登録ツール
echo ============================================================
echo.
echo  リポジトリ: !REPO_DIR!
echo  出力先:     %INSTALLERS_DIR%
echo.

if not exist "%INSTALLERS_DIR%" mkdir "%INSTALLERS_DIR%"

python "!REPO_DIR!\accountant_tools\new_client_wizard.py" --output-dir "%INSTALLERS_DIR%"

set RC=%errorlevel%

if not "%RC%"=="0" (
    echo.
    echo ============================================================
    echo  エラーが発生しました ^(コード: %RC%^)
    echo ============================================================
)

echo.
echo インストーラーフォルダを開きますか？
choice /C YN /M "Y=はい / N=いいえ"
if "%errorlevel%"=="1" explorer "%INSTALLERS_DIR%"

pause
