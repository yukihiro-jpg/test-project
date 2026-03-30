# 年末調整書類アップロードアプリ

年末調整に必要な控除証明書等を、顧問先の従業員がスマートフォンで撮影してGoogle Drive共有ドライブにPDFとして保管するWebアプリケーションです。

## 機能

### 従業員向け（スマホ）
- QRコードまたはURLからアクセス
- 氏名を入力し、該当する書類を撮影
- 送信ボタンで一括アップロード

### 対応書類
- 生命保険料控除証明書
- 地震保険料控除証明書
- 国民年金保険料控除証明書
- 国民健康保険の支払証明
- 小規模企業共済掛金払込証明書
- iDeCo掛金払込証明書
- 住宅借入金等特別控除申告書（2年目以降）
- 住宅取得資金に係る借入金の年末残高証明書（2年目以降）
- 前職の源泉徴収票

### 管理者向け
- 顧問先ごとのアップロードURL・QRコード生成
- 進捗管理スプレッドシート（従業員コード順、未提出者別シート）
- 毎朝6:30の進捗メール通知（全顧問先まとめ）

## セットアップ

### 1. Google Cloud設定

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成
2. 以下のAPIを有効化:
   - Google Drive API
   - Google Sheets API
   - Gmail API
3. 「サービスアカウント」を作成し、JSONキーをダウンロード
4. Google Drive共有ドライブでサービスアカウントのメールアドレスを「コンテンツ管理者」として追加

### 2. 環境変数の設定

`.env.example` をコピーして `.env.local` を作成:

```bash
cp .env.example .env.local
```

以下の値を設定:

| 変数 | 説明 |
|------|------|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | サービスアカウントのメールアドレス |
| `GOOGLE_PRIVATE_KEY` | サービスアカウントの秘密鍵 |
| `GOOGLE_SHARED_DRIVE_ID` | 共有ドライブのID |
| `GOOGLE_SPREADSHEET_ID` | 進捗管理用スプレッドシートのID |
| `NOTIFICATION_EMAIL` | 進捗メール送信先アドレス |
| `NEXT_PUBLIC_APP_URL` | デプロイ後のアプリURL |

### 3. 顧問先の登録

`src/lib/clients.ts` に顧問先情報を追加:

```typescript
const clients: Client[] = [
  {
    id: 'abc-company',        // URLに使用するID
    name: '株式会社ABC',       // 表示名
    driveFolderId: 'xxxxx',   // Google Drive上のフォルダID
  },
]
```

### 4. Google Drive上の準備

各顧問先フォルダ内に「従業員一覧」という名前のGoogleスプレッドシートを配置:

| A列（従業員コード） | B列（氏名） |
|---------------------|-------------|
| 001 | 山田太郎 |
| 002 | 鈴木花子 |
| ... | ... |

### 5. アプリの起動

```bash
npm install
npm run dev
```

## 定期実行の設定（cron）

### スプレッドシート更新（毎日0:00）
```bash
0 0 * * * cd /path/to/project && npm run cron:spreadsheet
```

### 進捗メール送信（毎朝6:30）
```bash
30 6 * * * cd /path/to/project && npm run cron:email
```

## Google Driveフォルダ構造

```
共有ドライブ/
├── 株式会社A/
│   ├── 従業員一覧（Googleスプレッドシート）
│   ├── 山田太郎/
│   │   ├── 生命保険料控除証明書.pdf
│   │   └── 国民年金保険料控除証明書.pdf
│   └── 鈴木花子/
│       └── ...
├── 株式会社B/
│   └── ...
```

## デプロイ

### Vercel（推奨）
1. GitHubリポジトリと連携
2. 環境変数を設定
3. デプロイ

### その他
Node.js 18以上の環境で `npm run build && npm run start` で起動可能です。

## 技術スタック

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- Google APIs (Drive, Sheets, Gmail)
- pdf-lib + sharp (画像→PDF変換)
- qrcode (QRコード生成)
