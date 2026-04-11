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
  originalDescription: string  // 通帳から読み取った元の摘要（パターン学習用）
  patternId?: string | null    // パターン学習から生成された場合のパターンID
  isCompound: boolean
  parentId: string | null
}

// 科目マスタ
export interface AccountItem {
  code: string
  name: string         // 正式科目名
  shortName: string    // 簡略科目名
  association?: string  // 連想（カタカナ検索用）
  normalBalance?: string // 正残区分（借方/貸方）
  bsPl?: string         // BS/PL区分
}

// 補助科目マスタ
export interface SubAccountItem {
  parentCode: string    // 科目コード
  parentName: string    // 科目簡略名称
  subCode: string       // 科目別補助コード
  name: string          // 正式科目名
  shortName: string     // 簡略科目名
  association?: string  // 連想
}

// 学習パターン（1行分の仕訳）
export interface PatternLine {
  debitCode: string
  debitName: string
  creditCode: string
  creditName: string
  taxCode: string
  taxCategory: string
  businessType: string
  description: string        // 変換後の摘要
  amount: number             // 金額（複合仕訳の各行の金額を保持）
}

// 学習パターン
export interface PatternEntry {
  id: string                   // 一意ID
  keyword: string              // 通帳の元の摘要（マッチング用）
  amountMin: number | null     // 金額下限（null=制限なし）
  amountMax: number | null     // 金額上限（null=制限なし）
  lines: PatternLine[]         // 仕訳行（1行 or 複合仕訳で複数行）
  useCount: number
  // 旧互換フィールド
  convertedDescription?: string
  debitCode?: string
  debitName?: string
  creditCode?: string
  creditName?: string
  taxCode?: string
  taxCategory?: string
  businessType?: string
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
  pageImageUrls?: string[] // OCR失敗時でもPDF画像を保持
  sourceType: 'pdf-text' | 'pdf-ocr' | 'excel'
  needsColumnMapping: boolean
  ocrFailed?: boolean // OCRでテキスト抽出できなかった場合
  ocrErrorMessage?: string // OCRエラーの詳細メッセージ
  corrections?: string[] // 入出金自動補正のログ
}

// アップロード設定
export interface UploadConfig {
  accountCode: string
  accountName: string
  file: File
}
