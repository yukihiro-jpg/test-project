# 書類スキャンシステム - セットアップガイド

## 概要

顧問先がスマホで書類を撮影 → 自動台形補正 + OCR → Google Driveに保存 → 毎朝メール通知

## システム構成図

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ 顧問先スマホ  │────→│ Google Apps Script │────→│  Google Drive    │
│  (PWA)       │     │  (バックエンド)     │     │  (OCR済PDF保存)  │
└─────────────┘     └──────────────────┘     └─────────────────┘
                            │                          │
                            │ 毎朝6時                   │
                            ▼                          │
                    ┌──────────────┐                   │
                    │    Gmail     │                    │
                    │ (日次レポート) │                   │
                    └──────────────┘                   │
                            │                          │
                            ▼                          ▼
                    ┌──────────────────────────────────┐
                    │    税理士（AI解析）                 │
                    └──────────────────────────────────┘
```

## セットアップ手順

### Step 1: Google Driveフォルダの準備

1. Google Driveで新しいフォルダを作成（例: `顧問先_書類スキャン`）
2. フォルダURLの末尾のIDをコピー
   - URL例: `https://drive.google.com/drive/folders/1ABCxyz123`
   - ID: `1ABCxyz123`

### Step 2: Google Apps Scriptの設定

1. [Google Apps Script](https://script.google.com) を開く
2. 「新しいプロジェクト」を作成
3. プロジェクト名を「書類スキャン」に変更
4. `Code.gs` の内容を `apps-script/Code.gs` から貼り付け

#### 設定値の編集

`Code.gs` 冒頭の `CONFIG` を編集:

```javascript
const CONFIG = {
  ROOT_FOLDER_ID: 'Step 1でコピーしたフォルダID',
  NOTIFICATION_EMAIL: 'あなたのGmail@gmail.com',
  OCR_LANGUAGE: 'ja',
};
```

#### Drive APIの有効化

1. Apps Scriptエディタで「サービス」（左サイドバーの＋）をクリック
2. 「Drive API」を選択して「追加」

#### デプロイ

1. 「デプロイ」→「新しいデプロイ」
2. 種類: 「ウェブアプリ」
3. 次のユーザーとして実行: 「自分」
4. アクセスできるユーザー: 「全員」
5. 「デプロイ」をクリック
6. 表示されたURLをコピー（後で使います）

#### トリガーの設定

1. Apps Scriptエディタで `createTriggers` 関数を選択
2. 「実行」ボタンをクリック
3. 権限を承認
4. これで毎朝6時（JST）にメール通知が設定されます

### Step 3: PWAフロントエンドの設定

#### Apps Script URLの設定

`frontend/index.html` の `CONFIG` セクションを編集:

```javascript
const CONFIG = {
    APPS_SCRIPT_URL: 'Step 2でコピーしたデプロイURL',
    // ...
};
```

#### ホスティング（3つの選択肢）

**選択肢A: GitHub Pages（推奨・無料）**

1. このリポジトリをGitHubにpush
2. Settings → Pages → Source: `main` branch, `/frontend` folder
3. URLが発行される（例: `https://yourname.github.io/doc-scanner/`）

**選択肢B: Google Sites に埋め込み**

1. Google Sitesで新しいサイトを作成
2. 「埋め込み」でHTMLを貼り付け

**選択肢C: Firebase Hosting（カスタムドメイン可）**

```bash
npm install -g firebase-tools
firebase init hosting
# public directory: frontend
firebase deploy
```

### Step 4: 顧問先へのURL配布

顧問先ごとに固有のURLを作成します:

```
https://あなたのドメイン/?client=tanaka&name=田中商事
```

パラメータ:
- `client`: クライアント識別ID（英数字）
- `name`: 表示名（日本語OK）

**QRコードの作成（おすすめ）**:
- Google Chartsで生成可能:
  `https://chart.googleapis.com/chart?cht=qr&chs=300x300&chl=YOUR_URL`
- または、任意のQRコード生成サービスをご利用ください

## 使い方

### 顧問先の操作

1. 共有されたURLまたはQRコードを開く
2. 書類の種類を選択
3. 「書類を撮影する」をタップ
4. カメラで書類を撮影
5. プレビューを確認して「送信する」

### 税理士側の運用

1. 毎朝6時にGmailでレポートが届く
2. メール内のリンクからGoogle Driveのフォルダを開く
3. OCR済みPDFファイルをAIツールで解析

## フォルダ構成

```
顧問先_書類スキャン/              ← ROOT_FOLDER
├── tanaka_田中商事/              ← クライアント別フォルダ（自動作成）
│   ├── 2026-03-25/              ← 日付別フォルダ（自動作成）
│   │   ├── tanaka_receipt_1711...jpg   ← 元画像
│   │   └── tanaka_receipt_1711...pdf   ← OCR済PDF
│   └── 2026-03-26/
│       └── ...
├── suzuki_鈴木工業/
│   └── ...
└── _scan_upload_log              ← ログ用スプレッドシート（自動作成）
```

## トラブルシューティング

### カメラが起動しない
- ブラウザの設定でカメラへのアクセスを許可してください
- HTTPS接続が必要です（HTTP では動作しません）

### 画像が送信されない
- インターネット接続を確認してください
- Apps Script のデプロイURLが正しいか確認してください

### 台形補正が効かない
- 書類と背景のコントラストが十分か確認してください
- 暗い場所での撮影は避けてください
- 「自動台形補正」のスイッチがONになっているか確認してください

### OCRの精度が低い
- 撮影時に書類全体がフレーム内に収まるようにしてください
- ピントが合っていることを確認してください
- 明るい場所で撮影してください

## セキュリティについて

- 画像データはGoogle Driveに直接保存されます
- 通信はHTTPS暗号化されています
- Google Apps Scriptは税理士のGoogleアカウント権限で実行されます
- クライアントURLを知っている人のみアクセス可能です
- 必要に応じてApps Scriptのアクセス制限を強化できます
