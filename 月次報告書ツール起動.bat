@echo off
chcp 65001 > nul
cd /d "%~dp0"

REM Check Python availability
python --version >nul 2>&1
if %errorlevel% equ 0 (
    python launcher.py
    goto :done
)

python3 --version >nul 2>&1
if %errorlevel% equ 0 (
    python3 launcher.py
    goto :done
)

py --version >nul 2>&1
if %errorlevel% equ 0 (
    py launcher.py
    goto :done
)

echo.
echo ============================================
echo   Error: Python not found
echo ============================================
echo.
echo   Python is required to run this tool.
echo.
echo   1. Go to https://www.python.org/downloads/
echo   2. Click "Download Python 3.xx"
echo   3. Run the installer
echo   4. CHECK "Add Python to PATH"
echo   5. Click "Install Now"
echo   6. Restart your PC
echo   7. Double-click this file again
echo.

:done
echo.
pause
