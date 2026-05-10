// 顧問先（クライアント）情報
export interface Client {
  id: string
  name: string
  fiscalYearEndMonth: number // 決算月 1-12（例: 8 = 8月決算）
  fiscalYearLabel: string    // 例: "R7.8期"
  createdAt: string
  folderId?: string          // Google Drive フォルダID
}

// 月次財務データ（1ヶ月分）
export interface MonthlyData {
  month: number       // 月 1-12
  netSales: number           // 純売上高
  cogs: number               // 売上原価
  grossProfit: number        // 売上総利益
  sgaExpense: number         // 販売費及び一般管理費
  operatingProfit: number    // 営業利益
  ordinaryIncome: number     // 営業外収益
  interestExpense: number    // 支払利息
  ordinaryProfit: number     // 経常利益
  // 貸借対照表
  currentAssets: number      // 流動資産
  currentLiabilities: number // 流動負債
  longTermDebt: number       // 長期借入金
  leaseLiabilities: number   // リース債務
  depreciation: number       // 減価償却費
}

// 1期分の財務データ
export interface FiscalYearData {
  label: string              // 例: "R7.8期"
  startMonth: number         // 期首月 1-12
  endMonth: number           // 決算月 1-12
  months: MonthlyData[]      // 月次データ（期首から決算月まで）
  annual: {                  // 年計
    netSales: number
    cogs: number
    grossProfit: number
    sgaExpense: number
    operatingProfit: number
    ordinaryProfit: number
  }
}

// アップロード済みファイル情報（Drive保存）
export interface UploadedFile {
  fileId: string
  fileName: string
  yearLabel: string  // 例: "R5", "R6", "R7"（どの期のデータか）
  uploadedAt: string
}

// クライアント詳細（ファイル情報含む）
export interface ClientDetail extends Client {
  files: UploadedFile[]
}

// 報告書生成用データ（3期分）
export interface ReportData {
  client: Client
  reportMonth: number       // 報告対象月 1-12
  reportYear: string        // 例: "R7"
  fiscalYears: FiscalYearData[]  // [R5, R6, R7] 順
  generatedAt: string
}

// SGAの内訳（単月）
export interface SgaBreakdown {
  label: string
  amount: number
}

// clients.json に保存するデータ形式
export interface ClientsStore {
  clients: Client[]
  updatedAt: string
}
