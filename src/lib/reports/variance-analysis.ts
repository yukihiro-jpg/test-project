/**
 * 増減要因分析
 *
 * 異常値が検出された科目について、総勘定元帳から上位の仕訳を抽出し、
 * 「どの取引先・どの摘要で変動が大きかったか」を特定する。
 */

import type { LedgerEntry } from '../parsers/general-ledger'
import type { AnomalyFinding } from './anomaly'

export interface VarianceDetail {
  finding: AnomalyFinding
  topContributors: LedgerContribution[]
}

export interface LedgerContribution {
  description: string              // 摘要
  counterAccountName: string
  amount: number                   // 借方または貸方
  voucherNo?: string
  date: Date
}

export interface VarianceAnalysisOptions {
  findings: AnomalyFinding[]
  ledgerEntries: LedgerEntry[]
  targetYear: number
  targetMonth: number
  topN?: number                    // デフォルト 5
}

export function analyzeVariance(opts: VarianceAnalysisOptions): VarianceDetail[] {
  const topN = opts.topN ?? 5
  const results: VarianceDetail[] = []

  for (const finding of opts.findings) {
    // 当月の該当科目仕訳を抽出
    const relevantEntries = opts.ledgerEntries.filter(
      (e) =>
        e.accountCode === finding.accountCode &&
        e.date.getFullYear() === opts.targetYear &&
        e.date.getMonth() + 1 === opts.targetMonth,
    )

    // 金額順にソート（費用科目は借方、収益科目は貸方を見る）
    const isCostType = finding.direction === 'increase'
    const contributors: LedgerContribution[] = relevantEntries
      .map((e) => ({
        description: e.description,
        counterAccountName: e.counterAccountName,
        amount: Math.max(e.debit, e.credit),
        voucherNo: e.voucherNo,
        date: e.date,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, topN)

    results.push({ finding, topContributors: contributors })
  }

  return results
}
