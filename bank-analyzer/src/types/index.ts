export type Transaction = {
  id: string
  date: string
  description: string
  deposit: number
  withdrawal: number
  balance: number
  remarks?: string
}

export type ParsedPassbook = {
  passbookId: string
  fileName: string
  bankName: string
  branchName: string
  accountNumber: string
  label: string
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
