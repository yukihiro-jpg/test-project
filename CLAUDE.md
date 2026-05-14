# 銀行CSV統合版 現金出納帳・仮払管理システム

## このプロジェクトについて

`cash-ledger-app/index.html` は単一ファイルのHTML/CSS/JSアプリです。
ブラウザの `file://` プロトコルで直接開いて使います（サーバー不要）。

## 対象ブランチ（重要）

- **本番ブランチ**: `app/cash-ledger-with-bank-csv`
- **作業手順**:
  1. `app/cash-ledger-with-bank-csv` から作業ブランチを作成する
  2. 作業ブランチ名は `claude/bank-csv-<内容>-<ランダム4文字>` の形式
  3. 変更をコミット・プッシュし、`app/cash-ledger-with-bank-csv` へのPRを作成してマージする
  4. `app/cash-ledger-management` には絶対に触らない（別アプリ）

## 別アプリとの関係

| ブランチ | 内容 | 触ってよいか |
|---|---|---|
| `app/cash-ledger-with-bank-csv` | **このアプリ**（銀行CSV機能付き） | ✅ |
| `app/cash-ledger-management` | 現行アプリ（銀行CSV機能なし） | ❌ 触らない |

## 対象ファイル

- `cash-ledger-app/index.html` — アプリ本体（唯一の編集対象）

## データ保存

- 通常データ（出納帳・仮払等）: `localStorage`（キー: `ca_*`）
- 銀行CSVセッション: `IndexedDB`（DB名: `CashLedgerBankDB`）
- 銀行CSV学習履歴: `localStorage`（キー: `ca_bank_history`）
- 銀行CSVテンプレート: `localStorage`（キー: `ca_bank_templates`）

## 主要な状態変数（JS）

```javascript
// 共通
let currentPage = 'dashboard'; // 現在のページ
let currentLocation = '';       // 選択中の拠点

// 銀行CSV
let bankCsvPage = 'list';       // 'list' | 'importing' | 'mapping' | 'editing'
let bankCurrentSession = null;  // 編集中セッション
let bankSessionCache = null;    // セッション一覧キャッシュ
```

## 銀行CSV機能の概要（実装済み）

- CSVインポート: ドラッグ&ドロップ、文字コード自動検出（UTF-8/Shift_JIS/EUC-JP/JIS）
- 列マッピングUI: クリックで役割割当、テンプレート保存
- 摘要編集: 空欄行のオレンジ強調、オートコンプリート（金額×日付パターンから学習）
- 自動保存: 800msデバウンス → IndexedDB
- セッションマージ: 同銀行・同口座の重複排除
- CSV出力: BOM付きUTF-8（日付/摘要/入金/出金/残高）
- **デュアルペイン編集は実装しない**（ユーザー判断）

## Git操作の注意

- `app/*` ブランチへの直接プッシュは403で拒否される
- 必ず `claude/bank-csv-*` の作業ブランチ経由でPRを作成してマージする
- マージ方法は squash merge を使う
