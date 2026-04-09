import type { BankTransaction, StatementPage } from './types'

/**
 * 開始残高を計算する
 * - 通帳に開始残高行がある場合: その値を使用
 * - 1行目から取引が始まる場合: balance[0] - deposit[0] + withdrawal[0]
 */
export function calculateOpeningBalance(transactions: BankTransaction[]): number {
  if (transactions.length === 0) return 0

  const first = transactions[0]
  const deposit = first.deposit ?? 0
  const withdrawal = first.withdrawal ?? 0

  // 入出金がどちらもない場合は残高行（開始残高そのもの）
  if (deposit === 0 && withdrawal === 0) {
    return first.balance
  }

  // 1行目が取引の場合: 逆算
  return first.balance - deposit + withdrawal
}

/**
 * 終了残高を取得する（最終行の残高）
 */
export function getClosingBalance(transactions: BankTransaction[]): number {
  if (transactions.length === 0) return 0
  return transactions[transactions.length - 1].balance
}

/**
 * ページの残高を検証する
 */
export function validatePageBalance(page: StatementPage): {
  isValid: boolean
  difference: number
  calculatedClosing: number
} {
  const { transactions, openingBalance } = page

  if (transactions.length === 0) {
    return { isValid: true, difference: 0, calculatedClosing: openingBalance }
  }

  // 開始残高から各取引を順に適用して終了残高を計算
  let calculated = openingBalance
  for (const tx of transactions) {
    calculated += (tx.deposit ?? 0) - (tx.withdrawal ?? 0)
  }

  const closingBalance = getClosingBalance(transactions)
  const difference = calculated - closingBalance

  return {
    isValid: Math.abs(difference) < 1, // 1円未満の誤差は許容
    difference,
    calculatedClosing: calculated,
  }
}

/**
 * StatementPage配列の残高情報を更新する
 */
export function updatePageBalances(pages: StatementPage[]): StatementPage[] {
  return pages.map((page) => {
    const openingBalance = calculateOpeningBalance(page.transactions)
    const closingBalance = getClosingBalance(page.transactions)
    const validation = validatePageBalance({
      ...page,
      openingBalance,
      closingBalance,
    })

    return {
      ...page,
      openingBalance,
      closingBalance,
      isBalanceValid: validation.isValid,
      balanceDifference: validation.difference,
    }
  })
}
