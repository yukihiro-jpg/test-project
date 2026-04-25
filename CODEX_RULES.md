# Codex作業ルール

このリポジトリでは、Codexは以下のルールを必ず守ること。

## 基本方針

既存アプリのファイルは、ユーザーの明示的な許可がない限り変更しないこと。

まずは新規ディレクトリ内だけで作業すること。

## 作成してよい場所

Codexが最初に作業してよい場所は、以下のディレクトリのみ。

- `codex-test-project/`

## 作成してよいファイル

最初の確認用アプリとして作成してよいファイルは以下のみ。

- `codex-test-project/index.html`
- `codex-test-project/style.css`
- `codex-test-project/script.js`
- `codex-test-project/README.md`

## 変更禁止ファイル・変更禁止フォルダ

以下は、ユーザーの明示的な許可がない限り変更禁止。

- `package.json`
- `package-lock.json`
- `.github/`
- `.env` 系ファイル
- `src/`
- `app/`
- `components/`
- 既存アプリのファイル全般

## 禁止操作

以下は禁止。

- `main` ブランチへ直接pushすること
- ユーザー確認前にPull Requestを作成すること
- ユーザー確認前にmergeすること
- 既存ファイルを勝手にリファクタリングすること
- 依存関係を勝手に追加すること

## 作業前の確認

作業開始前に、以下を確認してから進めること。

1. 現在のブランチ名
2. 変更予定のファイル一覧
3. 変更対象が `codex-test-project/` 内だけであること

## Codexへの指示

作業を始めるときは、必ずこの `CODEX_RULES.md` を読んでから作業すること。
