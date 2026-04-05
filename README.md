# 書類スキャンシステム

顧問先がスマホで書類を撮影するだけで、自動台形補正・OCR処理されたPDFがGoogle Driveに保存され、毎朝メールで通知が届くシステムです。

## 特徴

- **スマホだけで完結**: アプリインストール不要（URLを開くだけのPWA）
- **自動台形補正**: 斜めから撮影しても真上からのように補正（OpenCV.js）
- **OCR処理**: Google Drive APIによる日本語OCR対応
- **自動整理**: クライアント別・日付別にフォルダ自動作成
- **毎朝メール通知**: 前日のアップロード一覧がGmailに届く

## プロジェクト構成

```
├── frontend/           # PWAフロントエンド（スマホ用）
│   ├── index.html      # メインアプリ（カメラ撮影 + 台形補正）
│   ├── manifest.json   # PWAマニフェスト
│   └── sw.js           # Service Worker
├── apps-script/        # Google Apps Script（バックエンド）
│   ├── Code.gs         # メインスクリプト
│   └── appsscript.json # Apps Script設定
└── docs/
    └── SETUP.md        # 詳細セットアップガイド
```

## クイックスタート

1. Google Driveにフォルダを作成
2. Google Apps Scriptにバックエンドをデプロイ
3. フロントエンドをGitHub Pagesなどでホスティング
4. 顧問先にURLを配布

詳細は [docs/SETUP.md](docs/SETUP.md) をご覧ください。
