# 月次財務報告アプリ

会計データ（MJS会計大将）から顧問先社長向けの**月次報告資料を自動生成**するWebアプリケーションです。税理士・会計事務所での月次報告会を効率化し、社長との対話の質を高めることを目的としています。

## 主要機能

### 資料の自動生成（7セクション構成）
1. エグゼクティブサマリー
2. 業績サマリー（BS/PL）
3. トレンド分析（12ヶ月推移・3期比較）
4. 増減要因分析（元帳データで深掘り）
5. 資金繰り・キャッシュ
6. 部門別／セグメント別業績
7. 論点・アラート
8. アクションアイテム

### 差別化機能
- **AI叩き台コメント生成**（Gemini 2.5 Flash）: 税理士のコメント作成を支援
- **前月コメント引継ぎ・宿題追跡**: 連続性のある打合せを実現
- **社長プロファイル**: 顧問先ごとに資料の語彙・重視KPI・フォントサイズを最適化
- **業界ベンチマーク**: e-Stat（政府統計）の無料データで業界平均と比較

### 出力
- PDF（A4縦・印刷用）
- Excel（社長が加工できるネイティブ形式）
- ブラウザでのページ単位コメント入力 → コメント入りPDF再出力
- 自分のGmailから社長へ直接メール送信

## 技術スタック

| レイヤー | 採用技術 |
|---|---|
| フロント・バック | Next.js 14 (App Router) + TypeScript |
| UI | Tailwind CSS + Recharts |
| DB | Cloud Firestore |
| ファイル保管 | Google Drive |
| 認証 | Googleログイン（指定メール1件のみ許可） |
| AI | Gemini API 2.5 Flash |
| メール送信 | Gmail API |
| PDF生成 | Puppeteer |
| Excel生成 | ExcelJS |
| ホスティング | Google Cloud Run |
| 開発環境 | GitHub Codespaces |

## 入力データ仕様

MJS会計大将から出力する以下4種類のCSVに対応：

1. **月次試算表**（当月のBS/PL全体像）
2. **推移試算表**（期中の月次トレンド）
3. **3期比較推移表**（中期的な構造変化）
4. **総勘定元帳**（取引レベル詳細・異常値の原因特定）

文字コード: Shift-JIS（UTF-8 BOM も対応）
日付形式: 和暦（R07/09/01 等）→ 自動で西暦変換

## セットアップ

### 1. 前提
- Google Cloud プロジェクト（課金有効、無料枠内で運用）
- GitHub リポジトリ（Private 推奨）
- 以下の API を有効化：
  - Cloud Firestore API
  - Google Drive API
  - Gmail API
  - Google OAuth 2.0
  - Generative Language API（Gemini）

### 2. 環境変数
```bash
cp .env.example .env.local
# .env.local を編集して実際の値を設定
```

### 3. 依存関係インストール
```bash
npm install
```

### 4. 開発サーバー起動
```bash
npm run dev
# → http://localhost:3000
```

### 5. Cloud Run デプロイ
```bash
gcloud run deploy financial-report-app \
  --source . \
  --region asia-northeast1 \
  --allow-unauthenticated=false
```

## フォルダ構造

```
/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx            # ダッシュボード
│   │   ├── clients/            # 顧問先管理
│   │   ├── reports/            # 月次レポート
│   │   └── api/                # API Routes
│   ├── components/             # 共通 React コンポーネント
│   ├── lib/
│   │   ├── parsers/            # MJS CSV パーサー（4種類）
│   │   ├── utils/              # 和暦変換・文字コード判定など
│   │   └── types.ts            # 型定義
│   └── middleware.ts           # 認証ミドルウェア
├── scripts/
│   ├── mask-sample-data.ts     # サンプルデータマスキング
│   └── cleanup-test-data.ts    # テストデータ削除
├── docs/                       # 設計ドキュメント
├── samples/                    # サンプルCSV（.gitignore済）
└── .devcontainer/              # Codespaces 設定
```

## 開発コマンド

| コマンド | 用途 |
|---|---|
| `npm run dev` | 開発サーバー起動 |
| `npm run build` | 本番ビルド |
| `npm run typecheck` | TypeScript 型チェック |
| `npm run lint` | ESLint 実行 |
| `npm run mask:sample` | サンプルCSVのマスキング |
| `npm run cleanup:test-data` | テストデータ全削除（ドライラン） |
| `npm run estat:import` | e-Stat 業界平均データ取込 |

## セキュリティ・データ取扱方針

会計データは最重要機密のため、以下を遵守：

- 通信・保管ともに暗号化
- 顧問先ごとのアクセス権限分離
- サンプルデータは `.gitignore` 済み、絶対にコミットしない
- **開発完了時のテストデータ削除手順**は [`docs/TEST_DATA_POLICY.md`](docs/TEST_DATA_POLICY.md) を参照
- アップロードCSVの保持期間を設定

## ライセンス

Private（公開不可）
