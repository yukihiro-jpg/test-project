import type { CashEntry, BankEntry } from './types'

export interface ValidationError {
  field: string
  message: string
}

/**
 * 現金出納帳エントリのバリデーション
 */
export function validateCashEntry(
  entry: Partial<CashEntry>,
  month: string
): ValidationError[] {
  const errors: ValidationError[] = []

  // 日付
  if (!entry.date) {
    errors.push({ field: 'date', message: '日付を入力してください' })
  } else if (!isValidDate(entry.date)) {
    errors.push({ field: 'date', message: '正しい日付を入力してください' })
  } else if (!isInMonth(entry.date, month)) {
    errors.push({ field: 'date', message: '選択中の月の日付を入力してください' })
  }

  // 摘要
  if (!entry.description || entry.description.trim().length < 2) {
    errors.push({ field: 'description', message: '摘要を2文字以上で入力してください' })
  }

  // 金額（どちらか一方は必須）
  const hasIncome = entry.income != null && entry.income > 0
  const hasExpense = entry.expense != null && entry.expense > 0

  if (!hasIncome && !hasExpense) {
    errors.push({ field: 'income', message: '収入または支出のどちらかを入力してください' })
  }

  if (entry.income != null && entry.income < 0) {
    errors.push({ field: 'income', message: '収入金額は0以上で入力してください' })
  }

  if (entry.expense != null && entry.expense < 0) {
    errors.push({ field: 'expense', message: '支出金額は0以上で入力してください' })
  }

  if (hasIncome && !Number.isInteger(entry.income)) {
    errors.push({ field: 'income', message: '金額は整数で入力してください' })
  }

  if (hasExpense && !Number.isInteger(entry.expense)) {
    errors.push({ field: 'expense', message: '金額は整数で入力してください' })
  }

  return errors
}

/**
 * 通帳エントリのバリデーション
 */
export function validateBankEntry(
  entry: Partial<BankEntry>,
  month: string
): ValidationError[] {
  const errors: ValidationError[] = []

  // 日付
  if (!entry.date) {
    errors.push({ field: 'date', message: '日付を入力してください' })
  } else if (!isValidDate(entry.date)) {
    errors.push({ field: 'date', message: '正しい日付を入力してください' })
  } else if (!isInMonth(entry.date, month)) {
    errors.push({ field: 'date', message: '選択中の月の日付を入力してください' })
  }

  // 摘要（通帳記載）
  if (!entry.passbookDescription || entry.passbookDescription.trim().length < 1) {
    errors.push({ field: 'passbookDescription', message: '通帳の摘要を入力してください' })
  }

  // 取引内容（最重要）
  if (!entry.transactionType || entry.transactionType.trim().length < 1) {
    errors.push({ field: 'transactionType', message: '取引内容を入力してください' })
  }

  // 金額
  const hasDeposit = entry.deposit != null && entry.deposit > 0
  const hasWithdrawal = entry.withdrawal != null && entry.withdrawal > 0

  if (!hasDeposit && !hasWithdrawal) {
    errors.push({ field: 'deposit', message: '入金または出金のどちらかを入力してください' })
  }

  if (entry.deposit != null && entry.deposit < 0) {
    errors.push({ field: 'deposit', message: '入金額は0以上で入力してください' })
  }

  if (entry.withdrawal != null && entry.withdrawal < 0) {
    errors.push({ field: 'withdrawal', message: '出金額は0以上で入力してください' })
  }

  return errors
}

// ---- ヘルパー ----

function isValidDate(dateStr: string): boolean {
  const d = new Date(dateStr)
  return !isNaN(d.getTime())
}

function isInMonth(dateStr: string, month: string): boolean {
  return dateStr.startsWith(month)
}
