@echo off
chcp 65001 >nul
echo デスクトップにショートカットを作成しています...

set SCRIPT_DIR=%~dp0
set BAT_PATH=%SCRIPT_DIR%start_app.bat
set ICON_PATH=%SCRIPT_DIR%app.ico
set SHORTCUT_PATH=%USERPROFILE%\Desktop\相続税土地評価アプリ.lnk

rem VBScript でショートカットを作成
echo Set ws = CreateObject("WScript.Shell") > "%TEMP%\make_shortcut.vbs"
echo Set sc = ws.CreateShortcut("%SHORTCUT_PATH%") >> "%TEMP%\make_shortcut.vbs"
echo sc.TargetPath = "%BAT_PATH%" >> "%TEMP%\make_shortcut.vbs"
echo sc.WorkingDirectory = "%SCRIPT_DIR%\.." >> "%TEMP%\make_shortcut.vbs"
echo sc.Description = "相続税土地評価アプリを最新版で起動" >> "%TEMP%\make_shortcut.vbs"
if exist "%ICON_PATH%" (
    echo sc.IconLocation = "%ICON_PATH%" >> "%TEMP%\make_shortcut.vbs"
)
echo sc.Save >> "%TEMP%\make_shortcut.vbs"

cscript //nologo "%TEMP%\make_shortcut.vbs"
del "%TEMP%\make_shortcut.vbs"

echo.
echo ショートカットを作成しました: %SHORTCUT_PATH%
echo.
pause
