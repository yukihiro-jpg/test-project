import type { CashEntry, BankEntry, CashLedgerMonth, BankBookMonth } from './types'

/**
 * 現金出納帳の残高を再計算する
 * 前月繰越から順に計算し、各エントリのbalanceを更新
 */
export function recalculateCashBalances(data: CashLedgerMonth): CashLedgerMonth {
  let balance = data.carryOver

  const updatedEntries = data.entries.map((entry) => {
    balance = balance + (entry.income ?? 0) - (entry.expense ?? 0)
    return { ...entry, balance }
  })

  return { ...data, entries: updatedEntries }
}

/**
 * 通帳記録の残高を再計算する
 */
export function recalculateBankBalances(data: BankBookMonth): BankBookMonth {
  let balance = data.carryOver

  const updatedEntries = data.entries.map((entry) => {
    balance = balance + (entry.deposit ?? 0) - (entry.withdrawal ?? 0)
    return { ...entry, balance }
  })

  return { ...data, entries: updatedEntries }
}

/**
 * 月末残高を取得する（次月の前月繰越に使用）
 */
export function getClosingBalance(entries: (CashEntry | BankEntry)[], carryOver: number): number {
  if (entries.length === 0) return carryOver
  return entries[entries.length - 1].balance
}

/**
 * 月間の収入合計
 */
export function getTotalIncome(entries: CashEntry[]): number {
  return entries.reduce((sum, e) => sum + (e.income ?? 0), 0)
}

/**
 * 月間の支出合計
 */
export function getTotalExpense(entries: CashEntry[]): number {
  return entries.reduce((sum, e) => sum + (e.expense ?? 0), 0)
}

/**
 * 月間の入金合計
 */
export function getTotalDeposit(entries: BankEntry[]): number {
  return entries.reduce((sum, e) => sum + (e.deposit ?? 0), 0)
}

/**
 * 月間の出金合計
 */
export function getTotalWithdrawal(entries: BankEntry[]): number {
  return entries.reduce((sum, e) => sum + (e.withdrawal ?? 0), 0)
}

/**
 * 金額のフォーマット（カンマ区切り）
 */
export function formatAmount(amount: number | null): string {
  if (amount == null || amount === 0) return ''
  return amount.toLocaleString('ja-JP')
}

/**
 * 金額のフォーマット（残高用・常に表示）
 */
export function formatBalance(amount: number): string {
  return amount.toLocaleString('ja-JP')
}
