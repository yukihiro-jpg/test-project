export type Transaction = {
  id: string
  date: string
  description: string
  deposit: number
  withdrawal: number
  balance: number
  remarks?: string
  pageNumber?: number
}

export type ParsedPassbook = {
  passbookId: string
  fileName: string
  bankName: string
  branchName: string
  accountNumber: string
  label: string
  purpose: string
  startBalance: number | null
  endBalance: number | null
  transactions: Transaction[]
  warnings: string[]
}

export type AnalyzeRequest = {
  fileName: string
  label: string
  bankName?: string
  branchName?: string
  accountNumber?: string
  startDate: string
  endDate: string
  pdfBase64: string
}

export type AnalyzeResponse = {
  passbook: ParsedPassbook
}

export type AssetMovementRow = {
  id: string
  date: string
  passbookEntries: Record<string, { deposit: number; withdrawal: number }>
  conclusionAmount: number
  remarks: string
  isFundTransfer: boolean
  sourceTransactionIds: string[]
}

export type AssetMovementTable = {
  passbookOrder: string[]
  rows: AssetMovementRow[]
}

export type UploadItem = {
  id: string
  file: File
  label: string
  bankName: string
  branchName: string
  accountNumber: string
}

export type BalanceCertUploadItem = {
  id: string
  file: File
}

export type DepositRow = {
  id: string
  bankName: string
  branchName: string
  accountType: string
  accountNumber: string
  amount: number
  accruedInterest: number
  hasCertificate: boolean
  remarks: string
  sourceFileName?: string
}

export type ParsedBalanceCert = {
  certId: string
  fileName: string
  referenceDate: string // 証明日 (基準日として使う候補)
  issueDate: string // 発行日
  rows: DepositRow[]
  warnings: string[]
}
