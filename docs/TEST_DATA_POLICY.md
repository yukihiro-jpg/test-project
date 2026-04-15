# テストデータ取扱方針

## 原則

**本番顧問先の実データは開発環境に一切持ち込まない。** 検証用途で実データを参照する場合は、
必ずマスキングスクリプトでダミー化したうえで使用する。

## マスキング手順

### 1. 実データを `samples/original/` に配置（Git管理外）

```
samples/
├── original/          # ← ここは .gitignore 済み、絶対にコミットされない
│   ├── 月次試算表.csv
│   ├── 推移試算表.csv
│   ├── 3期比較推移表.csv
│   └── 総勘定元帳.csv
└── masked/            # ← マスキング済みデータ、これも .gitignore 済み
```

### 2. マスキング実行

```bash
npm run mask:sample
# デフォルトで samples/original/ → samples/masked/ に変換
```

マスキングにより以下が置換される：
- 取引先・取引先法人名 → 「テスト商事」等のダミー
- 個人名 → 「サンプル太郎」等のダミー
- 地名 → 「テスト市」等
- 金額 → ±20% のランダム変動（構造は保持）
- 科目コード・勘定科目名 → 変更なし（パーサー検証のため）

### 3. 開発・テスト中はマスキング済みデータのみ使用

```typescript
// 正しい例
const csvPath = 'samples/masked/月次試算表.csv'

// 間違った例（絶対NG）
const csvPath = 'samples/original/月次試算表.csv'
```

## 開発完了時の削除手順

開発完了・本番リリース時には、以下を順に実行する：

### Step 1: テストデータ削除スクリプトの実行

```bash
# まずドライラン（何が削除されるか確認）
npm run cleanup:test-data

# 問題なければ実行
npm run cleanup:test-data -- --run
```

削除対象：
- `samples/` ディレクトリ（original / masked 両方）
- `test-data/`, `fixtures/` ディレクトリ
- `generated/`, `output/` ディレクトリ
- `.next/cache`
- Firestore の `test_*` コレクション
- Google Drive の `/test/` 配下のファイル

### Step 2: Git 履歴の確認

```bash
# 履歴に実データが含まれていないか確認
git log --all --full-history -- samples/
git log --all --full-history -- test-data/
git log --all --full-history -- 'fixtures/*.csv'
```

履歴にコミット済みのものがあれば `git filter-repo` 等で完全削除を検討する。

### Step 3: ローカル環境の確認

- 作業PCのダウンロードフォルダ、デスクトップから実データCSVを削除
- Google Drive のアップロード履歴を確認
- Gmail の添付ファイル送受信履歴を確認

### Step 4: 第三者環境の確認

- Claude Code のチャット履歴を削除
- GitHub Codespaces のスナップショット・キャッシュを確認
- Google Cloud Storage のログバケットを確認

### Step 5: 削除完了記録

削除実施日時、実施者、削除対象を記録し、顧問先への報告が必要な場合は連絡する。

## 本番運用時のデータ取扱い

本番稼働後は、顧問先の実データは以下のルールで管理する：

- アップロード直後に Cloud Storage に暗号化保存
- 処理完了後は原データを削除（保持期間を設定）
- Firestore には集計済み・必要最小限のデータのみ保存
- 監査ログを有効化（誰がいつアクセスしたか追跡可能）

## 違反時の対応

万が一、実データが Git にコミットされた等の違反が発生した場合：

1. 即座に該当コミットを履歴から削除
2. GitHub Security Advisories に報告
3. 漏洩範囲の確認
4. 顧問先への説明と必要に応じた謝罪
