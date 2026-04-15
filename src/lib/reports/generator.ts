/**
 * 資料生成エンジン
 *
 * パース済みの4帳票データと社長プロファイルを入力に、
 * 7セクション構成のレポートコンテンツを生成する。
 *
 * セクション：
 *   1. executive_summary    エグゼクティブサマリー
 *   2. performance          業績サマリー
 *   3. trend                トレンド分析
 *   4. variance_analysis    増減要因分析
 *   5. cash_flow            資金繰り
 *   6. segment              部門別業績（該当する場合）
 *   7. advisories           論点・アラート
 *   8. action_items         アクションアイテム（翌月宿題）
 */

import type { GeneralLedgerParseResult } from '../parsers/general-ledger'
import type { ThreePeriodParseResult } from '../parsers/three-period'
import type { TransitionParseResult } from '../parsers/transition'
import type { TrialBalanceParseResult } from '../parsers/trial-balance'
import type { ClientProfile, ReportSection } from '../types'
import { detectAnomalies, type AnomalyFinding } from './anomaly'
import { analyzeVariance, type VarianceDetail } from './variance-analysis'

export interface GenerateReportInput {
  trialBalance: TrialBalanceParseResult
  transition: TransitionParseResult
  threePeriod: ThreePeriodParseResult
  generalLedger: GeneralLedgerParseResult
  profile: ClientProfile | null
  targetYear: number
  targetMonth: number
  previousMonthOpenItems: Array<{ content: string; pageNumber: number }>
}

export function generateReport(input: GenerateReportInput): ReportSection[] {
  const anomalies = detectAnomalies({
    transition: input.transition.rows,
    threePeriod: input.threePeriod.rows,
    targetMonth: input.targetMonth,
  })
  const variance = analyzeVariance({
    findings: anomalies.slice(0, 10), // 上位10件について元帳深掘り
    ledgerEntries: input.generalLedger.entries,
    targetYear: input.targetYear,
    targetMonth: input.targetMonth,
  })

  return [
    buildExecutiveSummary(input, anomalies),
    buildPerformance(input),
    buildTrend(input),
    buildVarianceAnalysis(input, variance),
    buildCashFlow(input),
    buildSegment(input),
    buildAdvisories(input, anomalies),
    buildActionItems(input),
  ]
}

// =============================================================================
// セクションビルダ
// =============================================================================

function buildExecutiveSummary(
  input: GenerateReportInput,
  anomalies: AnomalyFinding[],
): ReportSection {
  const revenueRow = input.trialBalance.rows.find(
    (r) => r.reportType === 'PL' && r.accountName.includes('売上高'),
  )
  const operatingIncomeRow = input.trialBalance.rows.find(
    (r) => r.reportType === 'PL' && r.accountName.includes('営業利益'),
  )

  return {
    type: 'executive_summary',
    pageNumber: 1,
    title: `${input.targetYear}年${input.targetMonth}月 エグゼクティブサマリー`,
    content: {
      headline: {
        revenue: revenueRow?.currentBalance ?? null,
        operatingIncome: operatingIncomeRow?.currentBalance ?? null,
      },
      anomalyCount: anomalies.length,
      topFocus: anomalies.slice(0, 3).map((a) => ({
        accountName: a.accountName,
        changeRatio: a.changeRatio,
        type: a.type,
      })),
    },
    comments: [],
  }
}

function buildPerformance(input: GenerateReportInput): ReportSection {
  const plRows = input.trialBalance.rows.filter((r) => r.reportType === 'PL')
  const bsRows = input.trialBalance.rows.filter((r) => r.reportType === 'BS')

  return {
    type: 'performance',
    pageNumber: 2,
    title: '業績サマリー（BS / PL）',
    content: {
      pl: plRows.map((r) => ({
        code: r.accountCode,
        name: r.accountName,
        amount: r.currentBalance,
        ratio: r.compositionRatio,
      })),
      bs: bsRows.map((r) => ({
        code: r.accountCode,
        name: r.accountName,
        amount: r.currentBalance,
        ratio: r.compositionRatio,
      })),
    },
    comments: [],
  }
}

function buildTrend(input: GenerateReportInput): ReportSection {
  return {
    type: 'trend',
    pageNumber: 3,
    title: 'トレンド分析（12ヶ月推移・3期比較）',
    content: {
      monthly: input.transition.rows
        .filter((r) => r.reportType === 'PL')
        .map((r) => ({
          code: r.accountCode,
          name: r.accountName,
          monthly: r.monthlyAmounts,
        })),
      threePeriod: input.threePeriod.rows
        .filter((r) => r.reportType === 'PL')
        .map((r) => ({
          code: r.accountCode,
          name: r.accountName,
          twoYearsAgo: r.cumulative.twoYearsAgo.amount,
          lastYear: r.cumulative.lastYear.amount,
          current: r.cumulative.current.amount,
        })),
    },
    comments: [],
  }
}

function buildVarianceAnalysis(
  _input: GenerateReportInput,
  variance: VarianceDetail[],
): ReportSection {
  return {
    type: 'variance_analysis',
    pageNumber: 4,
    title: '増減要因分析',
    content: {
      details: variance.map((v) => ({
        account: {
          code: v.finding.accountCode,
          name: v.finding.accountName,
        },
        type: v.finding.type,
        current: v.finding.currentAmount,
        comparison: v.finding.comparisonAmount,
        ratio: v.finding.changeRatio,
        topContributors: v.topContributors.map((c) => ({
          description: c.description,
          counter: c.counterAccountName,
          amount: c.amount,
          date: c.date.toISOString(),
        })),
      })),
    },
    comments: [],
  }
}

function buildCashFlow(input: GenerateReportInput): ReportSection {
  // 現預金・売掛金・買掛金・借入金を BS から抽出
  const bsRows = input.trialBalance.rows.filter((r) => r.reportType === 'BS')
  const pickBySubstring = (keyword: string) =>
    bsRows.find((r) => r.accountName.includes(keyword))

  return {
    type: 'cash_flow',
    pageNumber: 5,
    title: '資金繰り・キャッシュ',
    content: {
      cashBalance: pickBySubstring('現預金')?.currentBalance ?? null,
      accountsReceivable: pickBySubstring('売掛金')?.currentBalance ?? null,
      accountsPayable: pickBySubstring('買掛金')?.currentBalance ?? null,
      shortTermDebt: pickBySubstring('短期借入')?.currentBalance ?? null,
      longTermDebt: pickBySubstring('長期借入')?.currentBalance ?? null,
    },
    comments: [],
  }
}

function buildSegment(_input: GenerateReportInput): ReportSection {
  // TODO: 部門別会計を使用している顧問先向けに実装
  //       MJSで部門設定があれば帳票種別に「部門」列が入る想定
  return {
    type: 'segment',
    pageNumber: 6,
    title: '部門別業績',
    content: { available: false, message: '部門別会計が設定されていません' },
    comments: [],
  }
}

function buildAdvisories(
  _input: GenerateReportInput,
  anomalies: AnomalyFinding[],
): ReportSection {
  return {
    type: 'advisories',
    pageNumber: 7,
    title: '論点・アラート',
    content: {
      items: anomalies.map((a) => ({
        accountCode: a.accountCode,
        accountName: a.accountName,
        type: a.type,
        direction: a.direction,
        changeRatio: a.changeRatio,
        currentAmount: a.currentAmount,
        comparisonAmount: a.comparisonAmount,
      })),
    },
    comments: [],
  }
}

function buildActionItems(input: GenerateReportInput): ReportSection {
  return {
    type: 'action_items',
    pageNumber: 8,
    title: 'アクションアイテム',
    content: {
      // 前月からの引継ぎ宿題を表示
      carriedOverFromLastMonth: input.previousMonthOpenItems,
      newItems: [], // ユーザーが打合せ後に追加
    },
    comments: [],
  }
}
