// 通帳の1取引
export interface BankTransaction {
  id: string
  pageIndex: number
  rowIndex: number
  date: string // YYYY-MM-DD
  description: string
  deposit: number | null
  withdrawal: number | null
  balance: number
  boundingBox?: { x: number; y: number; width: number; height: number }
}

// ページ情報
export interface StatementPage {
  pageIndex: number
  transactions: BankTransaction[]
  openingBalance: number
  closingBalance: number
  isBalanceValid: boolean
  balanceDifference: number
  imageDataUrl?: string
}

// 仕訳行
export interface JournalEntry {
  id: string
  transactionId: string | null
  date: string // YYYYMMDD
  debitCode: string
  debitName: string
  debitSubCode: string
  debitSubName: string
  debitTaxType: string
  debitIndustry: string
  debitTaxInclude: string
  debitAmount: number
  debitTaxAmount: number
  debitTaxCode: string
  debitTaxRate: string
  debitBusinessType: string
  creditCode: string
  creditName: string
  creditSubCode: string
  creditSubName: string
  creditTaxType: string
  creditIndustry: string
  creditTaxInclude: string
  creditAmount: number
  creditTaxAmount: number
  creditTaxCode: string
  creditTaxRate: string
  creditBusinessType: string
  description: string
  isCompound: boolean
  parentId: string | null
}

// 科目マスタ
export interface AccountItem {
  code: string
  name: string
  subCode?: string
  subName?: string
  taxCode?: string
  taxCategory?: string
}

// 学習パターン
export interface PatternEntry {
  keyword: string
  debitCode: string
  debitName: string
  creditCode: string
  creditName: string
  taxCode: string
  taxCategory: string
  businessType: string
  useCount: number
}

// パース結果のraw行データ（列マッピング用）
export interface RawTableRow {
  cells: string[]
  rowIndex: number
  boundingBox?: { x: number; y: number; width: number; height: number }
}

// 列マッピング設定
export interface ColumnMapping {
  dateColumn: number
  descriptionColumn: number
  depositColumn: number
  withdrawalColumn: number
  balanceColumn: number
}

// パース結果
export interface ParseResult {
  pages: StatementPage[]
  rawPages?: RawTableRow[][] // 列マッピング用
  sourceType: 'pdf-text' | 'pdf-ocr' | 'excel'
  needsColumnMapping: boolean
}

// アップロード設定
export interface UploadConfig {
  accountCode: string
  accountName: string
  file: File
}
