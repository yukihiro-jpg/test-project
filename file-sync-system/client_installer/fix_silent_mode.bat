@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

echo ============================================================
echo 既存インストールの修正ツール
echo （cmd画面の非表示 + 即時同期ボタンの追加）
echo ============================================================
echo.

set APP_DIR=%APPDATA%\KusakabeSyncAgent

REM インストール済みか確認
if not exist "%APP_DIR%\sync_agent.exe" (
    echo エラー: ファイル同期エージェントがインストールされていません。
    echo 先に install.bat を実行してください。
    pause
    exit /b 1
)

REM サイレント実行用VBSを（再）作成
echo [1/3] サイレント実行スクリプトを作成中...
> "%APP_DIR%\run_sync_silent.vbs" echo Set WshShell = CreateObject("WScript.Shell"^)
>> "%APP_DIR%\run_sync_silent.vbs" echo WshShell.Run """%APP_DIR%\sync_agent.exe""", 0, False

REM デスクトップフォルダ取得
for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "[System.Environment]::GetFolderPath('Desktop')"`) do set DESKTOP=%%i
set LOCAL_FOLDER=%DESKTOP%\日下部税理士事務所

if not exist "%LOCAL_FOLDER%" mkdir "%LOCAL_FOLDER%"

REM 「今すぐ同期する.bat」を（再）作成
echo [2/3] 即時同期ボタンを作成中...
> "%LOCAL_FOLDER%\今すぐ同期する.bat" echo @echo off
>> "%LOCAL_FOLDER%\今すぐ同期する.bat" echo chcp 65001 ^> nul
>> "%LOCAL_FOLDER%\今すぐ同期する.bat" echo echo 同期を実行しています...
>> "%LOCAL_FOLDER%\今すぐ同期する.bat" echo wscript.exe "%APP_DIR%\run_sync_silent.vbs"
>> "%LOCAL_FOLDER%\今すぐ同期する.bat" echo echo 同期を開始しました。数秒後に完了します。
>> "%LOCAL_FOLDER%\今すぐ同期する.bat" echo timeout /t 3 /nobreak ^> nul

REM タスクスケジューラを再登録（cmd画面非表示モードに切替）
echo [3/3] タスクスケジューラを更新中...
schtasks /Delete /TN "KusakabeSyncAgent" /F > nul 2>&1
schtasks /Create ^
  /TN "KusakabeSyncAgent" ^
  /TR "wscript.exe \"%APP_DIR%\run_sync_silent.vbs\"" ^
  /SC MINUTE /MO 15 /F

echo.
echo ============================================================
echo 修正完了！
echo ============================================================
echo.
echo 以降、同期時にcmd画面は表示されません。
echo 即時同期したい場合はデスクトップの「日下部税理士事務所」フォルダ内の
echo 「今すぐ同期する.bat」をダブルクリックしてください。
echo.
pause
