@echo off
chcp 65001 >/dev/null
echo ========================================
echo 上場株式 相続税評価額計算アプリ セットアップ
echo ========================================
echo.
echo 必要ライブラリをインストールしています...
pip install flask yfinance openpyxl requests beautifulsoup4 pandas
echo.
echo セットアップ完了！
echo 起動するには start.bat をダブルクリックしてください。
pause
