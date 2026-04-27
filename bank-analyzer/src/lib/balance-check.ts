import type { Transaction } from '@/types'

export type BalanceMismatch = {
  txId: string
  index: number
  expected: number
  actual: number
}

export type PageBoundaryWarning = {
  page: number
  pageStart: number
  prevPageEnd: number
}

export type BalanceCheckResult = {
  mismatches: BalanceMismatch[]
  computedEnd: number
  pageBoundaryWarnings: PageBoundaryWarning[]
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

  // ページ境界の残高接続チェック（前ページ終了残高 vs 次ページ開始残高）
  const pageBoundaryWarnings: PageBoundaryWarning[] = []
  // ページ毎に取引をグループ化
  const pageGroups = new Map<number, Transaction[]>()
  for (const tx of transactions) {
    const p = tx.pageNumber ?? 0
    if (p <= 0) continue
    if (!pageGroups.has(p)) pageGroups.set(p, [])
    pageGroups.get(p)!.push(tx)
  }
  const sortedPages = Array.from(pageGroups.keys()).sort((a, b) => a - b)
  let lastPageEnd: number | null = null
  for (const page of sortedPages) {
    const txs = pageGroups.get(page)!
    if (txs.length === 0) continue
    const first = txs[0]
    const pageStart = (first.balance || 0) - (first.deposit || 0) + (first.withdrawal || 0)
    const last = txs[txs.length - 1]
    const pageEnd = last.balance || 0
    if (lastPageEnd !== null && Math.abs(lastPageEnd - pageStart) > TOLERANCE) {
      pageBoundaryWarnings.push({ page, pageStart, prevPageEnd: lastPageEnd })
    }
    lastPageEnd = pageEnd
  }

  return { mismatches, computedEnd: prev, pageBoundaryWarnings }
}
