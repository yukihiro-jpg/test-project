/**
 * アプリ全体で使う型定義
 *
 * 会計データ、顧問先、社長プロファイル、レポート、コメント等の
 * 主要なデータ構造を定義します。
 */

// =============================================================================
// 顧問先
// =============================================================================

export interface Client {
  id: string
  name: string                      // 顧問先名
  industryCode: string              // 日本標準産業分類（中分類）
  capitalScale: CapitalScale        // 資本金階級
  fiscalYearEndMonth: number        // 決算月（1-12）
  employeeCount?: number            // 従業員数
  createdAt: Date
  updatedAt: Date
}

export type CapitalScale =
  | 'less_than_10m'        // 1千万円未満
  | '10m_to_50m'           // 1千万円〜5千万円
  | '50m_to_100m'          // 5千万円〜1億円
  | '100m_to_1b'           // 1億円〜10億円
  | 'more_than_1b'         // 10億円以上

// =============================================================================
// 社長プロファイル
// =============================================================================

export interface ClientProfile {
  clientId: string
  // 社長情報
  presidentName: string
  presidentEmail: string
  presidentAgeGroup?: AgeGroup      // フォントサイズ調整用
  // 好み設定
  reportStyle: 'detailed' | 'summary' | 'balanced'
  commentTone: 'polite' | 'casual' | 'data_driven'
  focusedKpis: Kpi[]
  // 用語設定
  vocabularyPreference: Record<string, string>  // 例: { "売上総利益": "粗利" }
  customTerms: Record<string, string>           // 取引先略称など
  // 表示設定
  fontSize: 'normal' | 'large' | 'extra_large'
  // 打合せスタイル
  meetingFrequency: 'monthly' | 'bi_monthly'
  meetingNotes?: string
}

export type AgeGroup = 'under_40s' | '50s' | '60s' | '70s_plus'

export type Kpi =
  | 'revenue'              // 売上高
  | 'gross_margin'         // 粗利率
  | 'operating_income'     // 営業利益
  | 'cash_balance'         // 現預金残高
  | 'accounts_receivable'  // 売掛金
  | 'debt_balance'         // 借入金残高
  | 'labor_cost_ratio'     // 人件費率

// =============================================================================
// 月次レポート
// =============================================================================

export interface MonthlyReport {
  id: string
  clientId: string
  year: number                                  // 対象年
  month: number                                 // 対象月（1-12）
  status: 'draft' | 'finalized' | 'sent'
  createdAt: Date
  finalizedAt?: Date
  sentAt?: Date
  // 取込データのスナップショット
  sourceData: SourceDataSnapshot
  // 資料本体（7セクション）
  sections: ReportSection[]
  // バリデーション結果
  validation: ValidationResult
}

export interface SourceDataSnapshot {
  uploadedAt: Date
  trialBalanceFile: string        // 月次試算表 CSV のGCSパス
  transitionFile: string          // 推移試算表
  threePeriodFile: string         // 3期比較
  generalLedgerFile: string       // 総勘定元帳
}

export interface ValidationResult {
  passed: boolean
  checks: ValidationCheck[]
}

export interface ValidationCheck {
  name: string
  passed: boolean
  message?: string
  expectedValue?: number
  actualValue?: number
}

// =============================================================================
// レポートセクション（7セクション構成）
// =============================================================================

export type SectionType =
  | 'executive_summary'    // エグゼクティブサマリー
  | 'performance'          // 業績サマリー
  | 'trend'                // トレンド分析
  | 'variance_analysis'    // 増減要因分析
  | 'cash_flow'            // 資金繰り
  | 'segment'              // 部門別業績
  | 'advisories'           // 論点・アラート
  | 'action_items'         // アクションアイテム

export interface ReportSection {
  type: SectionType
  pageNumber: number
  title: string
  content: unknown                  // セクションごとに構造が異なる
  comments: Comment[]
}

// =============================================================================
// コメント（ページ下部）
// =============================================================================

export interface Comment {
  id: string
  reportId: string
  sectionType: SectionType
  pageNumber: number
  content: string
  tags: CommentTag[]
  // 前月宿題の引継ぎ情報
  linkedCommentId?: string
  status: 'open' | 'closed'
  // AI生成情報
  aiGenerated: boolean
  aiOriginalContent?: string        // AI生成時のオリジナルを保持
  createdAt: Date
  updatedAt: Date
  closedAt?: Date
}

export type CommentTag = 'important' | 'next_month' | 'continuing' | 'completed'

// =============================================================================
// 勘定科目（試算表・元帳）
// =============================================================================

export interface Account {
  code: string                      // 勘定科目コード
  name: string                      // 勘定科目名
  category: AccountCategory         // 大分類（BS/PL の区分）
  // 階層情報（集計行の場合）
  isSummary: boolean
  summaryLevel?: 'small' | 'medium' | 'large'  // （）〔〕【】
}

export type AccountCategory =
  | 'asset'                // 資産
  | 'liability'            // 負債
  | 'equity'               // 純資産
  | 'revenue'              // 収益
  | 'cost_of_sales'        // 売上原価
  | 'sga'                  // 販管費
  | 'non_operating'        // 営業外
  | 'extraordinary'        // 特別

// =============================================================================
// 仕訳（総勘定元帳）
// =============================================================================

export interface JournalEntry {
  clientId: string
  date: Date
  voucherNo: string
  searchNo?: string
  accountCode: string
  counterAccountCode: string
  counterAccountName: string
  description: string                // 摘要
  debit: number
  credit: number
  balance: number                    // 差引金額（その科目の累計残高）
  taxCode?: string
  taxRate?: number
  isReducedTaxRate: boolean          // 軽減税率かどうか
}

// =============================================================================
// 試算表データ
// =============================================================================

export interface TrialBalanceRow {
  reportType: 'BS' | 'PL'
  accountCode: string
  accountName: string
  previousBalance: number
  debit: number
  credit: number
  currentBalance: number
  compositionRatio?: number          // 構成比
}

// =============================================================================
// ベンチマーク（e-Stat 由来）
// =============================================================================

export interface BenchmarkData {
  id: string
  fiscalYear: number                 // データ年度
  industryCode: string
  capitalScale: CapitalScale
  indicator: BenchmarkIndicator
  value: number
  median?: number
  source: string                     // 例: "法人企業統計調査"
  sourceUrl: string
}

export type BenchmarkIndicator =
  | 'operating_margin'     // 売上高営業利益率
  | 'ordinary_margin'      // 売上高経常利益率
  | 'gross_margin'         // 売上高粗利率
  | 'equity_ratio'         // 自己資本比率
  | 'current_ratio'        // 流動比率
  | 'total_asset_turnover' // 総資本回転率
  | 'labor_productivity'   // 労働生産性
