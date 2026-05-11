export type AmountStyle = "single" | "split";

export interface ImportedCsv {
  fileName: string;
  encoding: string;
  headers: string[];
  rawRows: string[][];
}

export interface ColumnMapping {
  date: number;
  summary: number;
  balance: number | null;
  amountStyle: AmountStyle;
  amount: number | null;
  incoming: number | null;
  outgoing: number | null;
}

export interface BankInfo {
  bankName: string;
  accountName: string;
}

export interface TransactionRow {
  id: number;
  date: string;
  originalSummary: string;
  editedSummary: string;
  amount: number;
  balance: string;
  needsReview: boolean;
}
