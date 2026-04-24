@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

echo ============================================================
echo 日下部税理士事務所 ファイル同期エージェント インストール
echo ============================================================
echo.

set APP_DIR=%APPDATA%\KusakabeSyncAgent

REM 既存のインストールをクリーンアップ
echo [1/6] 既存のインストール情報をクリアしています...
schtasks /Delete /TN "KusakabeSyncAgent" /F > nul 2>&1
if exist "%APP_DIR%\config.json" del /Q "%APP_DIR%\config.json" > nul 2>&1
if exist "%APP_DIR%\sync_manifest.json" del /Q "%APP_DIR%\sync_manifest.json" > nul 2>&1
if exist "%APP_DIR%\sync.log" del /Q "%APP_DIR%\sync.log" > nul 2>&1
if exist "%APP_DIR%\upload_log.json" del /Q "%APP_DIR%\upload_log.json" > nul 2>&1
if exist "%APP_DIR%\run_sync_silent.vbs" del /Q "%APP_DIR%\run_sync_silent.vbs" > nul 2>&1

REM アプリディレクトリ作成
if not exist "%APP_DIR%" mkdir "%APP_DIR%"

REM ファイルをコピー
echo [2/6] ファイルをコピー中...
copy /Y "%~dp0sync_agent.exe" "%APP_DIR%\" > nul
copy /Y "%~dp0config.json" "%APP_DIR%\" > nul
copy /Y "%~dp0service_account.json" "%APP_DIR%\" > nul

REM 顧問先名を取得して表示
echo [3/6] 設定内容を確認中...
for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "(Get-Content '%APP_DIR%\config.json' -Raw | ConvertFrom-Json).client_name"`) do set CLIENT_NAME=%%i
echo   顧問先: !CLIENT_NAME!

REM サイレント実行用VBSを作成
echo [4/6] サイレント実行スクリプトを作成中...
> "%APP_DIR%\run_sync_silent.vbs" echo Set WshShell = CreateObject("WScript.Shell"^)
>> "%APP_DIR%\run_sync_silent.vbs" echo WshShell.Run """%APP_DIR%\sync_agent.exe""", 0, False

REM デスクトップフォルダを取得
for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "[System.Environment]::GetFolderPath('Desktop')"`) do set DESKTOP=%%i
set LOCAL_FOLDER=%DESKTOP%\日下部税理士事務所

REM 既存ローカルフォルダがある場合は警告（削除しない）
if exist "%LOCAL_FOLDER%" (
    echo.
    echo [!] 既に「%LOCAL_FOLDER%」フォルダが存在します。
    echo     過去のインストールで作成されたファイルが残っている可能性があります。
    echo     必要なら手動で確認してください。
    echo.
)

REM ローカルフォルダ作成
if not exist "%LOCAL_FOLDER%" mkdir "%LOCAL_FOLDER%"

REM 「今すぐ同期する」ボタンを作成
echo [5/6] 即時同期ボタンを作成中...
> "%LOCAL_FOLDER%\今すぐ同期する.bat" echo @echo off
>> "%LOCAL_FOLDER%\今すぐ同期する.bat" echo chcp 65001 ^> nul
>> "%LOCAL_FOLDER%\今すぐ同期する.bat" echo echo 同期を実行しています...
>> "%LOCAL_FOLDER%\今すぐ同期する.bat" echo wscript.exe "%APP_DIR%\run_sync_silent.vbs"
>> "%LOCAL_FOLDER%\今すぐ同期する.bat" echo echo 同期を開始しました。数秒後に完了します。
>> "%LOCAL_FOLDER%\今すぐ同期する.bat" echo timeout /t 3 /nobreak ^> nul

REM タスクスケジューラ登録
echo [6/6] タスクスケジューラに登録中...
schtasks /Create ^
  /TN "KusakabeSyncAgent" ^
  /TR "wscript.exe \"%APP_DIR%\run_sync_silent.vbs\"" ^
  /SC MINUTE /MO 15 /F > nul

REM 初回同期実行（即座にフォルダが作られる）
echo.
echo 初回同期を実行中...
wscript.exe "%APP_DIR%\run_sync_silent.vbs"
timeout /t 8 /nobreak > nul

echo.
echo ============================================================
echo インストール完了！
echo ============================================================
echo.
echo 顧問先: !CLIENT_NAME!
echo 同期フォルダ: %LOCAL_FOLDER%
echo 15分ごとに自動同期されます（画面非表示）。
echo 即座に同期したい場合は「今すぐ同期する.bat」をダブルクリックしてください。
echo.
pause
