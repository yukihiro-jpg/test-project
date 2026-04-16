// ============================
// アプリ設定
// ============================

export interface AppConfig {
  dataFolder: string
  companyName: string
  fiscalYearStart: number // 期首月（1〜12）
  createdAt: string
}

// ============================
// 現金出納帳
// ============================

export interface CashEntry {
  id: string
  date: string           // "YYYY-MM-DD"
  description: string    // 摘要（必須）
  accountCode?: string   // 勘定科目コード（任意）
  counterparty: string   // 取引先
  income: number | null   // 収入金額
  expense: number | null  // 支出金額
  balance: number         // 残高（自動計算）
  createdAt: string
  updatedAt: string
}

export interface CashLedgerMonth {
  month: string           // "YYYY-MM"
  carryOver: number       // 前月繰越額
  entries: CashEntry[]
  reconciliation?: ReconciliationRecord
}

export interface ReconciliationRecord {
  date: string
  actualBalance: number
  bookBalance: number
  difference: number
}

// ============================
// 通帳記録
// ============================

export interface BankEntry {
  id: string
  date: string
  passbookDescription: string   // 通帳記載の摘要（必須）
  transactionType: string       // 取引内容（必須・税理士向け最重要フィールド）
  accountCode?: string          // 勘定科目コード（任意）
  counterparty: string          // 取引先
  deposit: number | null        // お預り金額
  withdrawal: number | null     // お引出金額
  balance: number               // 残高（自動計算）
  createdAt: string
  updatedAt: string
}

export interface BankBookMonth {
  month: string
  accountId: string
  carryOver: number
  entries: BankEntry[]
}

export interface BankAccount {
  id: string
  bankName: string       // 銀行名
  branchName: string     // 支店名
  accountType: string    // 普通 / 当座
  accountNumber: string  // 口座番号
  openingBalance: number // 期首残高
}

// ============================
// 推測入力学習データ
// ============================

export interface SuggestionData {
  counterpartyMap: {
    [counterparty: string]: {
      descriptions: { [description: string]: number }
      transactionTypes: { [type: string]: number }
      lastUsed: string
    }
  }
  descriptionToType: {
    [passbookDesc: string]: { [type: string]: number }
  }
}

// ============================
// 税理士メモ
// ============================

export interface TaxAccountantMemo {
  content: string
  updatedAt: string
}

// ============================
// 勘定科目コード
// ============================

export interface AccountCode {
  code: string
  name: string
  category: string
}

// ============================
// CSV学習データ
// ============================

export interface CsvLearningData {
  descriptionToAccountCode: {
    [passbookDesc: string]: { code: string; name: string; count: number }
  }
  descriptionToTransactionType: {
    [passbookDesc: string]: { type: string; count: number }
  }
  descriptionToCounterparty: {
    [passbookDesc: string]: { counterparty: string; count: number }
  }
}

// ============================
// UI用型
// ============================

export type PageType = 'dashboard' | 'cash-ledger' | 'bank-book' | 'settings' | 'help'

export interface MonthOption {
  value: string  // "YYYY-MM"
  label: string  // "2026年4月"
}
