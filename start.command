#!/bin/bash

echo "========================================"
echo "  営業成績ダッシュボード を起動中..."
echo "========================================"
echo ""

cd "$(dirname "$0")"

# 初回のみ：必要なライブラリをインストール
if ! python3 -c "import streamlit" 2>/dev/null; then
    echo "初回セットアップ中...必要なライブラリをインストールしています"
    pip3 install -r requirements.txt
    echo ""
fi

echo "ブラウザが自動で開きます。少しお待ちください..."
echo "終了するには、このウィンドウを閉じてください。"
echo ""

streamlit run app.py --server.port 8501
