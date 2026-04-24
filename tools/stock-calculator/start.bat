@echo off
chcp 65001 >/dev/null
cd /d "%~dp0"
echo 株価計算サーバーを起動しています...
echo ブラウザで http://localhost:5000 が開きます
echo このウィンドウは閉じないでください
echo.
python app.py
pause
