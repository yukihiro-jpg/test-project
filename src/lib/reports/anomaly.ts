/**
 * 異常値検知
 *
 * 各PL科目について：
 *   - 前月比 ±10% を超える変動
 *   - 前年同月比 ±20% を超える変動
 * を検出し、該当科目を論点・アラートセクションに反映する。
 *
 * 閾値は環境変数で調整可能。
 */

import type { ThreePeriodRow } from '../parsers/three-period'
import type { TransitionRow } from '../parsers/transition'

export interface AnomalyFinding {
  accountCode: string
  accountName: string
  type: 'mom' | 'yoy'             // month-over-month or year-over-year
  currentAmount: number
  comparisonAmount: number
  changeAmount: number
  changeRatio: number              // 例: 0.25 → +25%
  direction: 'increase' | 'decrease'
}

export interface AnomalyDetectOptions {
  transition: TransitionRow[]
  threePeriod: ThreePeriodRow[]
  targetMonth: number
  thresholds?: {
    mom?: number                   // 前月比 ±N%（デフォルト 10）
    yoy?: number                   // 前年同月比 ±N%（デフォルト 20）
  }
}

export function detectAnomalies(opts: AnomalyDetectOptions): AnomalyFinding[] {
  const momThreshold = opts.thresholds?.mom ?? Number(process.env.ANOMALY_THRESHOLD_MOM ?? 10)
  const yoyThreshold = opts.thresholds?.yoy ?? Number(process.env.ANOMALY_THRESHOLD_YOY ?? 20)
  const findings: AnomalyFinding[] = []

  // 前月比（推移試算表から）
  for (const row of opts.transition) {
    if (row.reportType !== 'PL') continue
    const currentIdx = row.monthlyAmounts.findIndex((m) => m.month === opts.targetMonth)
    if (currentIdx <= 0) continue
    const current = row.monthlyAmounts[currentIdx].amount
    const previous = row.monthlyAmounts[currentIdx - 1].amount
    if (previous === 0) continue

    const changeRatio = (current - previous) / Math.abs(previous)
    if (Math.abs(changeRatio) * 100 >= momThreshold) {
      findings.push({
        accountCode: row.accountCode,
        accountName: row.accountName,
        type: 'mom',
        currentAmount: current,
        comparisonAmount: previous,
        changeAmount: current - previous,
        changeRatio,
        direction: changeRatio > 0 ? 'increase' : 'decrease',
      })
    }
  }

  // 前年同月比（3期比較推移表から）
  for (const row of opts.threePeriod) {
    if (row.reportType !== 'PL') continue
    const current = row.monthly.current.amount
    const lastYear = row.monthly.lastYear.amount
    if (lastYear === 0) continue

    const changeRatio = (current - lastYear) / Math.abs(lastYear)
    if (Math.abs(changeRatio) * 100 >= yoyThreshold) {
      findings.push({
        accountCode: row.accountCode,
        accountName: row.accountName,
        type: 'yoy',
        currentAmount: current,
        comparisonAmount: lastYear,
        changeAmount: current - lastYear,
        changeRatio,
        direction: changeRatio > 0 ? 'increase' : 'decrease',
      })
    }
  }

  return findings.sort((a, b) => Math.abs(b.changeRatio) - Math.abs(a.changeRatio))
}
