# 販売管理アプリ

Electron + React + TypeScript + SQLite による販売・購買管理デスクトップアプリです。

## 主な機能

- 取引先（顧客・仕入先）管理
- 商品マスタ管理
- 納品書の登録と請求書化（複数納品を集約）
- 売上請求書発行（PDF 出力、適格請求書対応）
- 仕入請求書登録（PDF アップロード→ Gemini API 解析→確認画面）
- 入出金登録・消込（請求書への割当）
- 資金繰り表（予定／実績、銀行口座別、日次残高グラフ）
- 売掛金・買掛金 残高一覧（基準日指定）
- 棚卸表 Excel 出力
- バックアップ／復元（zip 形式）

## セットアップ

```bash
npm install
npm run dev
```

初回起動時に SQLite データベースをユーザーデータディレクトリに作成し、マイグレーションを実行します。

### インストーラ作成

```bash
npm run dist          # 現在のプラットフォーム向け
npm run dist:win      # Windows (NSIS)
npm run dist:mac      # macOS (dmg)
```

## 設定

`設定` 画面から以下を登録してください。

- 会社情報、適格請求書番号
- Gemini API キー（仕入請求書 PDF 自動解析に使用、暗号化保存）
- 銀行口座

## TODO

- pdfmake の日本語フォント組込（現在は Roboto のフォールバック）。
  `vfs_fonts.js` を Noto Sans JP でビルドし直して差し替えること。
- アイコンを `resources/icon.png` / `resources/icon.icns` / `resources/icon.ico` に配置。
