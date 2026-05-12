# 銀行CSV修正ツール

会計事務所の顧問先向けに、銀行ダウンロードCSVの摘要欄を効率的に補完・修正するためのWindows用デスクトップアプリ。

## 概要

ネットバンキングからダウンロードした通帳CSVは、摘要欄が空欄のことが多く、会計ソフトに取り込む前に取引先名や用途を補完する必要がある。本ツールはこの作業を効率化することを目的とする。

主な特徴:

- 列マッピング方式の汎用CSV取込（銀行ごとに学習）
- 摘要欄が空欄の行のみを「未処理」として検出
- 左右2ペイン（元CSV / 解析データ）でスクロール・選択連動
- 「前の未処理へ / 次の未処理へ」のジャンプボタン
- 過去入力の自動学習による取引先サジェスト
- 途中保存対応

詳細仕様は `docs/plan.md` を参照。

## 技術スタック

- Tauri 2 + React 19 + TypeScript + Vite
- TailwindCSS v4（スタイリング）
- IndexedDB（idb ラッパー）— 銀行テンプレ・途中保存・取引先学習履歴
- Papa Parse + encoding-japanese（CSV取込・文字コード自動判定）
- TanStack Table / TanStack Virtual（将来の大量行対応用）

## 起動方法（顧問先利用）

リポジトリルートの `launch.bat` をダブルクリックすると、自動で以下を順に実行します:

1. 最新版を git pull で取得
2. 依存パッケージを確認（差分があれば自動インストール）
3. アプリを起動し、ブラウザを自動で開く

デスクトップにショートカットを置いておくと、毎回のダブルクリックで最新版で起動できます。

ショートカット作成手順:
1. `launch.bat` を右クリック → 「送る」→「デスクトップ（ショートカットを作成）」
2. デスクトップにできたショートカットを「銀行CSV修正ツール」などに改名
3. （任意）プロパティ → 「アイコンの変更」 → `src-tauri\icons\icon.ico` を指定

## 開発

```bash
pnpm install
pnpm dev          # Vite単体（ブラウザでUI確認、http://localhost:1420）
pnpm launch       # ブラウザ自動オープン付きで起動（launch.bat はこれを呼ぶ）
pnpm tauri dev    # Tauri統合（デスクトップアプリ起動、要Rustツールチェイン）
pnpm build        # フロントエンドビルド（dist/に出力）
pnpm tauri build  # Windows用 msi/exe を生成
```

`pnpm dev` はブラウザで動くため Windows でなくても UI 確認・編集作業ができます。
ファイルシステムへの直接アクセスはなく、ダウンロード/アップロードは
ブラウザ標準のAPIを使用しています。

## 顧問先への配布（スタンドアロンインストーラのビルド）

顧問先の PC には Node.js / Git / pnpm 等を一切インストールしない、単独のインストーラ（exe）を配布する場合の手順です。

### 開発側 PC（インストーラを作る人）に必要なもの

1. **Rust ツールチェイン**: https://rustup.rs から `rustup-init.exe` を実行
2. **Visual Studio Build Tools**（C++ ワークロード）: https://visualstudio.microsoft.com/visual-cpp-build-tools/ から「Build Tools for Visual Studio」をインストール。インストーラで「C++ によるデスクトップ開発」を選択
3. WebView2 SDK は Tauri CLI が必要に応じて自動取得します

初回セットアップは合計 5〜8 GB ほどダウンロードがあり、20〜40 分かかります。

### インストーラを生成する

```cmd
pnpm install
pnpm tauri build
```

初回ビルドは Rust 依存のコンパイルで 10〜20 分かかります。2 回目以降は数分で完了します。

生成された **インストーラ exe** は次の場所に出力されます:

```
src-tauri\target\release\bundle\nsis\銀行CSV修正ツール_0.1.0_x64-setup.exe
```

この `.exe` を 1 ファイルだけ顧問先に渡せばよいです。

### 顧問先での使い方

1. 配布された `銀行CSV修正ツール_0.1.0_x64-setup.exe` をダブルクリック
2. 言語選択（既定で日本語）→ インストール先（既定で `%LOCALAPPDATA%\Programs`、管理者権限不要）
3. インストール完了で **デスクトップにアプリアイコンが自動作成**
4. アイコンをダブルクリックでアプリ起動。cmd 等の黒い画面は表示されません

WebView2 が未導入の PC でも、インストーラに同梱されたブートストラッパが自動でセットアップします（ネット接続が必要）。

### バージョンアップ時

`src-tauri/tauri.conf.json` の `version` を上げてから再ビルドし、新しい `_x64-setup.exe` を顧問先に渡して上書きインストールしてもらえば更新できます。

## 配布

Windows 向け msi インストーラ。1顧問先 = 1インストール。
コード署名なしで配布する場合、初回起動時に SmartScreen 警告が表示される可能性が
あります（「詳細情報」→「実行」で起動可能）。

## サンプル

`samples/sample-bank-shift_jis.csv` に動作確認用のサンプルCSVを置いています。
