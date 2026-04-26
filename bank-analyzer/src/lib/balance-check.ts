import type { Transaction } from '@/types'

export type BalanceMismatch = {
  txId: string
  index: number
  expected: number
  actual: number
}

export type BalanceCheckResult = {
  mismatches: BalanceMismatch[]
  computedEnd: number
}

const TOLERANCE = 0.5

export function computeBalanceMismatches(
  transactions: Transaction[],
  startBalance: number
): BalanceCheckResult {
  const mismatches: BalanceMismatch[] = []
  let prev = startBalance
  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i]
    const expected = prev + (tx.deposit || 0) - (tx.withdrawal || 0)
    const actual = tx.balance || 0
    if (Math.abs(expected - actual) > TOLERANCE) {
      mismatches.push({ txId: tx.id, index: i, expected, actual })
    }
    prev = actual
  }
  return { mismatches, computedEnd: prev }
}
