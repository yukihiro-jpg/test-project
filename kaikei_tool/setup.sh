#!/bin/bash
echo "============================================"
echo " 会計大将インポートCSV生成ツール セットアップ"
echo "============================================"
echo

# Pythonバージョン確認
if ! command -v python3 &> /dev/null; then
    echo "エラー: Python3がインストールされていません。"
    exit 1
fi

python3 --version
echo

echo "必要なライブラリをインストールします..."
pip3 install -r requirements.txt

echo
echo "セットアップ完了"
echo
echo "使い方:"
echo "  python3 main.py --init 顧問先名    : 顧問先フォルダを作成"
echo "  python3 main.py --list              : 顧問先一覧を表示"
echo "  python3 main.py 顧問先名            : 仕訳CSVを生成"
echo "  python3 main.py 顧問先名 --build-rulebook : ルールブックのみ生成"
