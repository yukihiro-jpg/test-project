@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

echo ============================================================
echo 日下部税理士事務所 ファイル同期エージェント インストール
echo ============================================================
echo.

set APP_DIR=%APPDATA%\KusakabeSyncAgent

REM アプリディレクトリ作成
if not exist "%APP_DIR%" mkdir "%APP_DIR%"

REM ファイルをコピー
echo ファイルをコピー中...
copy /Y "%~dp0sync_agent.exe" "%APP_DIR%\" > nul
copy /Y "%~dp0config.json" "%APP_DIR%\" > nul
copy /Y "%~dp0service_account.json" "%APP_DIR%\" > nul

REM サイレント実行用VBSを作成（cmd画面を表示しない）
echo サイレント実行スクリプトを作成中...
> "%APP_DIR%\run_sync_silent.vbs" echo Set WshShell = CreateObject("WScript.Shell"^)
>> "%APP_DIR%\run_sync_silent.vbs" echo WshShell.Run """%APP_DIR%\sync_agent.exe""", 0, False

REM デスクトップフォルダを取得
for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "[System.Environment]::GetFolderPath('Desktop')"`) do set DESKTOP=%%i
set LOCAL_FOLDER=%DESKTOP%\日下部税理士事務所

REM ローカルフォルダ作成
if not exist "%LOCAL_FOLDER%" mkdir "%LOCAL_FOLDER%"

REM 「今すぐ同期する」ボタン（.bat）をローカルフォルダに配置
echo 即時同期ボタンを作成中...
> "%LOCAL_FOLDER%\今すぐ同期する.bat" echo @echo off
>> "%LOCAL_FOLDER%\今すぐ同期する.bat" echo chcp 65001 ^> nul
>> "%LOCAL_FOLDER%\今すぐ同期する.bat" echo echo 同期を実行しています...
>> "%LOCAL_FOLDER%\今すぐ同期する.bat" echo wscript.exe "%APP_DIR%\run_sync_silent.vbs"
>> "%LOCAL_FOLDER%\今すぐ同期する.bat" echo echo 同期を開始しました。数秒後に完了します。
>> "%LOCAL_FOLDER%\今すぐ同期する.bat" echo timeout /t 3 /nobreak ^> nul

REM タスクスケジューラ登録（wscriptで起動 = cmd画面非表示）
echo タスクスケジューラに登録中...
schtasks /Delete /TN "KusakabeSyncAgent" /F > nul 2>&1
schtasks /Create ^
  /TN "KusakabeSyncAgent" ^
  /TR "wscript.exe \"%APP_DIR%\run_sync_silent.vbs\"" ^
  /SC MINUTE /MO 15 /F

echo.
echo ============================================================
echo インストール完了！
echo ============================================================
echo.
echo 同期フォルダ: %LOCAL_FOLDER%
echo 15分ごとに自動同期されます（画面非表示）。
echo 即座に同期したい場合は「今すぐ同期する.bat」をダブルクリックしてください。
echo.
pause
