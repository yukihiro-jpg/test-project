@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

REM ============================================================
REM  Kakomon Tool Launcher (Stable Version)
REM ------------------------------------------------------------
REM  Robust path detection without chained if-else-if.
REM ============================================================

REM --- Step 1: Find repository (sequential, no else-if chain) ---
set "REPO_DIR="

set "P1=C:\Users\yukihiro\test-project\file-sync-system"
set "P2=C:\Users\user\test-project\file-sync-system"
set "P3=%USERPROFILE%\test-project\file-sync-system"

if exist "%P1%\accountant_tools\new_client_wizard.py" set "REPO_DIR=%P1%"
if not defined REPO_DIR if exist "%P2%\accountant_tools\new_client_wizard.py" set "REPO_DIR=%P2%"
if not defined REPO_DIR if exist "%P3%\accountant_tools\new_client_wizard.py" set "REPO_DIR=%P3%"

if not defined REPO_DIR goto :not_found

REM --- Step 2: Setup paths ---
set "KIT_DIR=%~dp0"
if "%KIT_DIR:~-1%"=="\" set "KIT_DIR=%KIT_DIR:~0,-1%"
set "OUTPUT_DIR=%KIT_DIR%\インストーラー"
if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"

echo ============================================================
echo  新規顧問先登録ツール
echo ============================================================
echo.
echo  リポジトリ: %REPO_DIR%
echo  出力先:     %OUTPUT_DIR%
echo.

REM --- Step 3: Run Python wizard ---
python "%REPO_DIR%\accountant_tools\new_client_wizard.py" --output-dir "%OUTPUT_DIR%"
set "RC=%errorlevel%"

if not "%RC%"=="0" (
    echo.
    echo ============================================================
    echo  エラーが発生しました ^(コード: %RC%^)
    echo ============================================================
)

echo.
choice /C YN /N /M "インストーラーフォルダを開きますか？ [Y/N]: "
if "%errorlevel%"=="1" explorer "%OUTPUT_DIR%"

pause
exit /b %RC%

:not_found
echo ============================================================
echo  エラー: test-project リポジトリが見つかりません
echo ============================================================
echo.
echo 以下のいずれかの場所に test-project があることを確認してください:
echo   %P1%
echo   %P2%
echo   %P3%
echo.
pause
exit /b 1
