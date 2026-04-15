# データモデル設計書（Firestore）

## コレクション構造

```
clients/{clientId}
├─ (document) Client                      # 顧問先基本情報
├─ profile/
│    └─ (document) ClientProfile          # 社長プロファイル（1件のみ）
└─ reports/{reportId}
     ├─ (document) MonthlyReport          # 月次レポート本体
     ├─ sections/{sectionType}
     │    └─ (document) ReportSection     # セクション別コンテンツ
     └─ comments/{commentId}
          └─ (document) Comment           # ページ単位コメント

benchmark/{fiscalYear}
└─ indicators/{industryCode}_{capitalScale}
     └─ (document) BenchmarkData          # 業界平均データ

audit/{auditId}
└─ (document) AuditLog                    # 監査ログ
```

## 主要ドキュメントの構造

### clients/{clientId}

```typescript
{
  id: string
  name: string                  // 顧問先名
  industryCode: string          // 日本標準産業分類（中分類コード）
  capitalScale: CapitalScale    // 資本金階級
  fiscalYearEndMonth: number    // 決算月（1-12）
  employeeCount?: number
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### clients/{clientId}/profile/default

```typescript
{
  clientId: string
  presidentName: string
  presidentEmail: string
  presidentAgeGroup?: "under_40s" | "50s" | "60s" | "70s_plus"
  reportStyle: "detailed" | "summary" | "balanced"
  commentTone: "polite" | "casual" | "data_driven"
  focusedKpis: string[]         // ["revenue", "gross_margin", ...]
  vocabularyPreference: Record<string, string>
  customTerms: Record<string, string>
  fontSize: "normal" | "large" | "extra_large"
  meetingFrequency: "monthly" | "bi_monthly"
  meetingNotes?: string
}
```

### clients/{clientId}/reports/{year}_{month}

```typescript
{
  id: string                    // "2025_10" 形式
  clientId: string
  year: number
  month: number
  status: "draft" | "finalized" | "sent"
  createdAt: Timestamp
  finalizedAt?: Timestamp
  sentAt?: Timestamp
  sourceData: {
    uploadedAt: Timestamp
    trialBalanceFile: string    // GCS path
    transitionFile: string
    threePeriodFile: string
    generalLedgerFile: string
  }
  validation: {
    passed: boolean
    checks: Array<{
      name: string
      passed: boolean
      message?: string
      expectedValue?: number
      actualValue?: number
    }>
  }
}
```

### clients/{clientId}/reports/{reportId}/comments/{commentId}

```typescript
{
  id: string
  reportId: string
  sectionType: SectionType
  pageNumber: number
  content: string
  tags: CommentTag[]            // ["important", "next_month", ...]
  linkedCommentId?: string      // 前月からの引継ぎ元コメント ID
  status: "open" | "closed"
  aiGenerated: boolean
  aiOriginalContent?: string    // AI生成時の原文を保持
  createdAt: Timestamp
  updatedAt: Timestamp
  closedAt?: Timestamp
}
```

### benchmark/{fiscalYear}/indicators/{industryCode}_{capitalScale}

```typescript
{
  fiscalYear: number
  industryCode: string
  capitalScale: CapitalScale
  indicators: {
    operating_margin: number
    ordinary_margin: number
    gross_margin: number
    equity_ratio: number
    current_ratio: number
    total_asset_turnover: number
    labor_productivity: number
  }
  source: "法人企業統計調査"
  sourceUrl: string
  importedAt: Timestamp
}
```

## インデックス設計

### 必要な複合インデックス

1. `clients/{clientId}/reports` 
   - `status ASC, year DESC, month DESC`（最新ドラフトの取得）
2. `clients/{clientId}/reports/{reportId}/comments`
   - `status ASC, tags ARRAY_CONTAINS`（未解決の宿題抽出）
   - `createdAt DESC`（一覧表示）

## セキュリティルール方針

```javascript
// 概略のみ記載。実装時に firestore.rules で具体化する
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 全てのアクセスは認証済みかつ、指定メールアドレスのみ許可
    match /{document=**} {
      allow read, write: if request.auth.token.email == resource.data.allowedEmail;
    }
  }
}
```

## データの保持期間

| コレクション | 保持期間 |
|---|---|
| `clients` | 永続 |
| `reports` | 7年（会計関連法令準拠） |
| `comments` | reports と同期 |
| `benchmark` | 5年分保持 |
| `audit` | 3年 |
| 原データCSV（GCS） | 3ヶ月（集計後は削除） |
