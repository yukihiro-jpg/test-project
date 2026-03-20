@echo off
echo ============================================
echo  会計大将インポートCSV生成ツール セットアップ
echo ============================================
echo.

REM Pythonバージョン確認
python --version 2>NUL
if errorlevel 1 (
    echo エラー: Pythonがインストールされていません。
    echo https://www.python.org/downloads/ からPython 3.8以上をインストールしてください。
    pause
    exit /b 1
)

echo.
echo 必要なライブラリをインストールします...
pip install -r requirements.txt

echo.
echo ============================================
echo  セットアップ完了
echo ============================================
echo.
echo 使い方:
echo   python main.py --init 顧問先名    : 顧問先フォルダを作成
echo   python main.py --list              : 顧問先一覧を表示
echo   python main.py 顧問先名            : 仕訳CSVを生成
echo   python main.py 顧問先名 --build-rulebook : ルールブックのみ生成
echo.
echo ※ スキャンPDFのOCRを使う場合は別途 Tesseract-OCR のインストールが必要です
echo   https://github.com/UB-Mannheim/tesseract/wiki
echo.
pause
