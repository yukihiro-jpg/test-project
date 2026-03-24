#!/bin/bash
# 月次経営報告書作成ツール - Mac用ランチャー

echo "================================================"
echo "  月次経営報告書作成ツール を起動しています..."
echo "================================================"
echo ""

# スクリプトのディレクトリに移動
cd "$(dirname "$0")"

# Pythonの存在確認
if command -v python3 &> /dev/null; then
    PYTHON=python3
elif command -v python &> /dev/null; then
    PYTHON=python
else
    echo "エラー: Pythonがインストールされていません。"
    echo "https://www.python.org/downloads/ からインストールしてください。"
    echo ""
    read -p "Enterキーで終了..."
    exit 1
fi

# launcher.pyを実行
$PYTHON launcher.py
