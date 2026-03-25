# 相続財産シミュレーションアプリ

税理士事務所向けの相続財産シミュレーション業務アプリです。
被相続人ごとの案件を管理し、財産情報の整理、分割案の比較、概算納税額の確認を一貫して行えます。

## 技術スタック

- **フレームワーク**: Next.js 16 (App Router)
- **言語**: TypeScript
- **UI**: React, Tailwind CSS, Radix UI
- **ORM**: Prisma 7
- **データベース**: SQLite（開発用、PostgreSQL移行可能な構造）
- **バリデーション**: Zod
- **フォーム**: React Hook Form

## セットアップ

```bash
# 依存関係のインストール
npm install

# Prisma クライアント生成
npx prisma generate

# DBマイグレーション
npx prisma migrate dev

# シードデータ投入
npx tsx prisma/seed.ts

# 開発サーバー起動
npm run dev
```

## ディレクトリ構成

```
src/
├── app/
│   ├── api/                          # APIルート
│   │   ├── cases/                    # 案件API
│   │   └── datasets/                 # データセットAPI
│   │       └── [datasetId]/
│   │           ├── heirs/            # 親族関係
│   │           ├── lands/            # 土地
│   │           ├── buildings/        # 建物
│   │           ├── securities/       # 上場有価証券
│   │           ├── deposits/         # 預貯金
│   │           ├── insurances/       # 生命保険
│   │           ├── liabilities/      # 債務・葬式費用
│   │           ├── gifts/            # 生前贈与
│   │           ├── partitions/       # 分割案
│   │           ├── summary/          # サマリー集計
│   │           ├── tax-estimate/     # 税額概算
│   │           └── duplicate/        # データセット複製
│   └── cases/                        # 画面ページ
│       ├── page.tsx                  # 案件一覧
│       ├── new/                      # 案件新規作成
│       └── [caseId]/
│           ├── page.tsx              # 案件詳細
│           ├── edit/                 # 案件編集
│           └── datasets/
│               └── [datasetId]/
│                   ├── page.tsx      # データセット詳細（サマリー）
│                   ├── heirs/        # 親族関係入力
│                   ├── lands/        # 土地入力
│                   ├── buildings/    # 建物入力
│                   ├── securities/   # 有価証券入力
│                   ├── deposits/     # 預貯金入力
│                   ├── insurances/   # 生命保険入力
│                   ├── liabilities/  # 債務・葬式費用入力
│                   ├── gifts/        # 生前贈与入力
│                   ├── partitions/   # 分割案管理・編集
│                   └── tax-estimate/ # 相続税概算
├── calclogic/
│   ├── inheritanceTaxCalculator.ts   # 相続税概算計算モジュール
│   └── legalShareCalculator.ts       # 法定相続分簡易計算
├── components/ui/                    # UIコンポーネント
├── lib/
│   ├── prisma.ts                     # Prismaクライアント
│   └── utils.ts                      # ユーティリティ関数
└── validators/                       # Zodバリデーションスキーマ
    ├── case.ts
    ├── dataset.ts
    ├── heir.ts
    ├── land.ts
    ├── building.ts
    ├── security.ts
    ├── deposit.ts
    ├── insurance.ts
    ├── liability.ts
    ├── gift.ts
    └── partition.ts

prisma/
├── schema.prisma                     # DBスキーマ
├── seed.ts                           # シードデータ
└── migrations/                       # マイグレーション
```

## 画面一覧

| # | 画面 | パス |
|---|------|------|
| 1 | 案件一覧 | `/cases` |
| 2 | 案件新規作成 | `/cases/new` |
| 3 | 案件詳細 | `/cases/[caseId]` |
| 4 | 案件編集 | `/cases/[caseId]/edit` |
| 5 | データセット詳細（サマリー） | `/cases/[caseId]/datasets/[datasetId]` |
| 6 | 親族関係入力 | `.../datasets/[datasetId]/heirs` |
| 7 | 土地入力 | `.../datasets/[datasetId]/lands` |
| 8 | 建物入力 | `.../datasets/[datasetId]/buildings` |
| 9 | 上場有価証券入力 | `.../datasets/[datasetId]/securities` |
| 10 | 預貯金入力 | `.../datasets/[datasetId]/deposits` |
| 11 | 生命保険入力 | `.../datasets/[datasetId]/insurances` |
| 12 | 債務・葬式費用入力 | `.../datasets/[datasetId]/liabilities` |
| 13 | 生前贈与入力 | `.../datasets/[datasetId]/gifts` |
| 14 | 分割案一覧 | `.../datasets/[datasetId]/partitions` |
| 15 | 分割案編集（配分入力） | `.../datasets/[datasetId]/partitions/[partitionId]` |
| 16 | 相続税概算 | `.../datasets/[datasetId]/tax-estimate` |

## DBテーブル一覧

| テーブル | 説明 |
|----------|------|
| Case | 案件（被相続人） |
| AssetDataset | 相続財産データセット |
| Heir | 親族関係（相続人・受遺者） |
| LandAsset | 土地 |
| BuildingAsset | 建物 |
| SecurityAsset | 上場有価証券等 |
| CashDepositAsset | 預貯金・現金 |
| InsuranceAsset | 生命保険 |
| OtherAsset | その他財産 |
| LiabilityExpense | 債務・葬式費用 |
| AnnualGift | 生前贈与（暦年課税） |
| SettlementGift | 生前贈与（相続時精算課税）※プレースホルダ |
| PartitionPlan | 分割案 |
| PartitionAllocation | 分割配分 |

## 相続税計算ロジック

計算ロジックは `src/calclogic/inheritanceTaxCalculator.ts` に独立モジュールとして実装しています。
将来、正式な税額計算ロジックへ差し替え可能な設計です。

### 独立関数一覧

| 関数 | 説明 |
|------|------|
| `calcBasicDeduction` | 基礎控除計算 |
| `calcInsuranceExemption` | 生命保険非課税限度額 |
| `calcRetirementExemption` | 退職手当金非課税限度額 |
| `calcTaxByBracket` | 速算表による税額計算 |
| `calcTaxablePrice` | 課税価格計算 |
| `calcTotalTax` | 相続税の総額計算 |
| `calcProportionalTax` | 各人按分計算 |
| `calcTwentyPercentAdd` | 2割加算 |
| `calcSpouseDeduction` | 配偶者の税額軽減 |
| `calcMinorDeduction` | 未成年者控除 |
| `calcDisabilityDeduction` | 障害者控除 |
| `calcGiftTaxCredit` | 贈与税額控除 |
| `calcSuccessionDeduction` | 相次相続控除（プレースホルダ） |
| `calcForeignTaxCredit` | 外国税額控除（プレースホルダ） |
| `calculateInheritanceTax` | メイン計算関数 |

---

## 仮仕様一覧

以下の項目は仮仕様として実装しています。正式な仕様が判明次第、差し替えてください。

### 税額計算

| 項目 | 仮仕様 | 備考 |
|------|--------|------|
| 基礎控除 | 3,000万円 + 600万円 × 法定相続人数 | 現行税法に準拠 |
| 生命保険非課税 | 500万円 × 法定相続人数 | 現行税法に準拠 |
| 退職手当金非課税 | 500万円 × 法定相続人数（プレースホルダ） | 退職手当金の入力UI未実装 |
| 税率 | 2015年以降の速算表を使用 | 8段階税率 |
| 端数処理 | 課税価格: 1,000円未満切捨て、按分税額: 100円未満切捨て | |
| 配偶者税額軽減 | 法定相続分 or 1億6千万円の大きい方まで全額控除 | 簡易版 |
| 未成年者控除 | (18歳 - 年齢) × 10万円 | 2022年4月以降基準 |
| 障害者控除 | 一般: (85歳-年齢)×10万円、特別: ×20万円 | |
| 相次相続控除 | 未実装（0を返す） | プレースホルダ |
| 外国税額控除 | 未実装（0を返す） | プレースホルダ |
| 相続時精算課税制度 | DBスキーマのみ、計算未対応 | プレースホルダ |

### 財産評価

| 項目 | 仮仕様 | 備考 |
|------|--------|------|
| 土地（路線価方式） | 路線価 × 面積 × 所有割合 × 調整係数 | 奥行補正等は調整係数で手動調整 |
| 土地（倍率方式） | 固定資産税評価額 × 倍率 × 所有割合 × 調整係数 | |
| 建物 | 固定資産税評価額 × 所有割合 × 調整係数 | |
| 有価証券 | 単価 × 数量 × 調整係数 | 月中平均等は未対応 |
| 小規模宅地等の特例 | フラグのみ、減額計算は未実装 | 要拡張 |

### 法定相続分計算

| 項目 | 仮仕様 | 備考 |
|------|--------|------|
| 簡易計算 | 配偶者+子、配偶者+直系尊属、配偶者+兄弟姉妹の3パターン | |
| 代襲相続 | 未対応 | |
| 養子 | 未対応（通常の子と同等扱い） | |
| 非嫡出子 | 未対応 | |
| 2割加算判定 | 兄弟姉妹・甥姪を自動判定、手動修正可能 | |

### 生前贈与

| 項目 | 仮仕様 | 備考 |
|------|--------|------|
| 加算対象判定 | booleanフラグで手動設定 | 相続開始前7年以内の自動判定は未実装 |
| 段階的加算 | 未対応（全額加算 or 非加算） | 2024年以降の経過措置は未実装 |

### その他

| 項目 | 仮仕様 | 備考 |
|------|--------|------|
| 自社株等 | プレースホルダ（UIなし） | |
| 退職手当金 | プレースホルダ（UIなし） | |
| その他財産 | 汎用入力のみ | |
| データセット上限 | 1案件20件まで | |
| 分割案上限 | 1データセット5件まで | |

---

## 今後の拡張ポイント

1. **小規模宅地等の特例**: 居住用・事業用・貸付用の区分と減額率の計算
2. **相続時精算課税制度**: 贈与税額との精算計算
3. **相次相続控除**: 前回相続からの経過年数に応じた控除
4. **外国税額控除**: 海外資産に係る税額控除
5. **退職手当金**: 入力UIと非課税計算
6. **自社株等**: 非上場株式の評価方法
7. **有価証券の4つの価額**: 課税時期の終値、月中平均等
8. **認証・認可**: ユーザー管理とアクセス制御
9. **PDF出力**: 試算結果のレポート出力
10. **PostgreSQL移行**: 本番環境用のDB移行
11. **生前贈与の自動判定**: 相続開始日からの年数計算による自動判定
12. **端数処理の厳密化**: 各計算ステップでの端数処理ルールの精緻化
13. **配偶者居住権**: 配偶者居住権の評価
14. **農地・山林の納税猶予**: 特例措置の対応
