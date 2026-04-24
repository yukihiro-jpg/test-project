# 上場株式 相続税評価額計算アプリ

Flask + yfinance による株価自動取得・相続税評価額計算ツール

## セットアップ

```bash
pip install flask yfinance openpyxl requests beautifulsoup4 pandas
```

## 起動

```bash
python app.py
```

ブラウザで http://localhost:5000 が開きます。

## 相続税業務管理アプリとの連携

1. このアプリを起動した状態で
2. 相続税業務管理アプリの「上場株式」ページを開く
3. 歯車アイコンからAPI URLを確認（デフォルト: http://localhost:5000）
4. 「接続テスト」で接続確認
5. 銘柄コード入力 → 「自動計算」で株価が自動反映
