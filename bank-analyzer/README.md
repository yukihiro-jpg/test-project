# 通帳解析アプリ（bank-analyzer）

相続税申告における現金預金評価のための通帳解析ツールです。Gemini API を利用して通帳PDFを解析し、指定期間の取引一覧と金融資産異動一覧表を作成します。

## 機能

- 通帳PDF（画像PDF・テキストPDF）の複数アップロード
- 解析期間（開始日〜終了日）の指定
- Gemini 2.5 Flash による日付・摘要・入金・出金・残高の抽出
- 残高検証（不一致時は自動再解析）
- 取引内容の画面上での編集
- 50万円以上の取引をピックアップした金融資産異動一覧表
- 通帳間の資金移動を自動検出（日付±5日 / 金額一致）
- ATM出金摘要を「不明金」と自動判定（キーワードはアプリ内で編集可）
- Excelダウンロード（罫線・色付きヘッダ・和暦・#,###形式）

## セットアップ

```bash
cd bank-analyzer
npm install
cp .env.example .env.local
# .env.local に GEMINI_API_KEY を設定
npm run dev
```

http://localhost:3001 でアクセスできます。

## 環境変数

| 変数 | 説明 |
|------|------|
| `GEMINI_API_KEY` | Google AI Studio で取得した Gemini API キー |
| `GEMINI_MODEL` | 使用モデル（デフォルト: `gemini-2.5-flash`） |

## 使い方

1. **期間を指定**: 開始日・終了日を入力
2. **通帳PDFをアップロード**: 複数可。各PDFにラベル・銀行名・支店・口座番号を入力
3. **解析実行**: Gemini で順次解析
4. **結果確認・編集**: 通帳ごとのタブで取引を確認・編集（残高は自動検証）
5. **金融資産異動一覧表で確認・編集**: 50万円以上の取引と資金移動が自動集計
6. **Excelダウンロード**: 提出資料形式で出力

## 技術スタック

- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- @google/generative-ai (Gemini 2.5 Flash)
- exceljs（Excel出力）
