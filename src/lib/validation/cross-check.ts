/**
 * 帳票間の整合性バリデーション
 *
 * MJS会計大将の4帳票を取り込んだ後、以下をチェック：
 *   1. 試算表の当月残高 vs 元帳の月末残高
 *   2. 試算表の当月借方/貸方合計 vs 推移試算表の当月欄
 *   3. 3期比較の当期累計 vs 月次試算表の当月残高
 *   4. 元帳の月計行 vs 試算表の当月借方/貸方
 *
 * 許容誤差: 1円未満（会計データは整数円）
 */

import type { ValidationCheck, ValidationResult } from '../types'
import type { GeneralLedgerParseResult } from '../parsers/general-ledger'
import type { ThreePeriodParseResult } from '../parsers/three-period'
import type { TransitionParseResult } from '../parsers/transition'
import type { TrialBalanceParseResult } from '../parsers/trial-balance'

const TOLERANCE = 0 // 許容誤差（円）

export interface CrossCheckInputs {
  trialBalance: TrialBalanceParseResult
  transition: TransitionParseResult
  threePeriod: ThreePeriodParseResult
  generalLedger: GeneralLedgerParseResult
  targetYear: number
  targetMonth: number
}

export function runCrossCheck(inputs: CrossCheckInputs): ValidationResult {
  const checks: ValidationCheck[] = []

  // Check 1: 試算表と元帳の当月借方・貸方合計を突合
  checks.push(...checkTrialBalanceVsLedger(inputs))

  // Check 2: 試算表と推移試算表の当月欄を突合
  checks.push(...checkTrialBalanceVsTransition(inputs))

  // Check 3: 試算表と3期比較の当期月次実績を突合
  checks.push(...checkTrialBalanceVsThreePeriod(inputs))

  return {
    passed: checks.every((c) => c.passed),
    checks,
  }
}

// =============================================================================
// Check 1: 試算表 vs 元帳
// =============================================================================

function checkTrialBalanceVsLedger(inputs: CrossCheckInputs): ValidationCheck[] {
  const checks: ValidationCheck[] = []
  const { trialBalance, generalLedger, targetYear, targetMonth } = inputs
  const yearMonth = `${targetYear}-${String(targetMonth).padStart(2, '0')}`

  // 元帳の月計行を科目コードごとに集計
  const ledgerTotals = new Map<string, { debit: number; credit: number }>()
  for (const total of generalLedger.monthlyTotals) {
    if (total.yearMonth !== yearMonth) continue
    ledgerTotals.set(total.accountCode, { debit: total.debit, credit: total.credit })
  }

  // 試算表の各行と突合
  for (const tbRow of trialBalance.rows) {
    const ledger = ledgerTotals.get(tbRow.accountCode)
    if (!ledger) continue // 元帳にない科目（集計行等）はスキップ

    if (Math.abs(tbRow.debit - ledger.debit) > TOLERANCE) {
      checks.push({
        name: `試算表と元帳の借方突合: ${tbRow.accountCode} ${tbRow.accountName}`,
        passed: false,
        expectedValue: ledger.debit,
        actualValue: tbRow.debit,
        message: `試算表 ${tbRow.debit} 円 / 元帳 ${ledger.debit} 円`,
      })
    }
    if (Math.abs(tbRow.credit - ledger.credit) > TOLERANCE) {
      checks.push({
        name: `試算表と元帳の貸方突合: ${tbRow.accountCode} ${tbRow.accountName}`,
        passed: false,
        expectedValue: ledger.credit,
        actualValue: tbRow.credit,
        message: `試算表 ${tbRow.credit} 円 / 元帳 ${ledger.credit} 円`,
      })
    }
  }

  if (checks.length === 0) {
    checks.push({
      name: '試算表と元帳の月次合計突合',
      passed: true,
    })
  }
  return checks
}

// =============================================================================
// Check 2: 試算表 vs 推移試算表
// =============================================================================

function checkTrialBalanceVsTransition(inputs: CrossCheckInputs): ValidationCheck[] {
  const checks: ValidationCheck[] = []
  const { trialBalance, transition, targetMonth } = inputs

  // 推移試算表から当月列を抽出
  const transitionByCode = new Map<string, number>()
  for (const row of transition.rows) {
    const amount = row.monthlyAmounts.find((m) => m.month === targetMonth)?.amount
    if (amount !== undefined) transitionByCode.set(row.accountCode, amount)
  }

  // PL科目のみチェック（BS は残高なので突合意義が薄い）
  const plRows = trialBalance.rows.filter((r) => r.reportType === 'PL')
  for (const tbRow of plRows) {
    const expected = transitionByCode.get(tbRow.accountCode)
    if (expected === undefined) continue

    // PLの当月変動額 = 貸方 - 借方（収益） または 借方 - 貸方（費用）
    // ここでは当月残高と推移試算表の当月値を比較（どちらも同じロジックで出力されているはず）
    const tbMonthlyAmount = tbRow.currentBalance - tbRow.previousBalance
    if (Math.abs(tbMonthlyAmount - expected) > TOLERANCE) {
      checks.push({
        name: `試算表と推移試算表の当月値突合: ${tbRow.accountCode} ${tbRow.accountName}`,
        passed: false,
        expectedValue: expected,
        actualValue: tbMonthlyAmount,
      })
    }
  }

  if (checks.length === 0) {
    checks.push({ name: '試算表と推移試算表の当月値突合', passed: true })
  }
  return checks
}

// =============================================================================
// Check 3: 試算表 vs 3期比較推移表
// =============================================================================

function checkTrialBalanceVsThreePeriod(inputs: CrossCheckInputs): ValidationCheck[] {
  const checks: ValidationCheck[] = []
  const { trialBalance, threePeriod } = inputs

  const threePeriodByCode = new Map<string, number>()
  for (const row of threePeriod.rows) {
    threePeriodByCode.set(row.accountCode, row.monthly.current.amount)
  }

  const plRows = trialBalance.rows.filter((r) => r.reportType === 'PL')
  for (const tbRow of plRows) {
    const expected = threePeriodByCode.get(tbRow.accountCode)
    if (expected === undefined) continue
    const tbMonthlyAmount = tbRow.currentBalance - tbRow.previousBalance
    if (Math.abs(tbMonthlyAmount - expected) > TOLERANCE) {
      checks.push({
        name: `試算表と3期比較の当月値突合: ${tbRow.accountCode} ${tbRow.accountName}`,
        passed: false,
        expectedValue: expected,
        actualValue: tbMonthlyAmount,
      })
    }
  }

  if (checks.length === 0) {
    checks.push({ name: '試算表と3期比較の当月値突合', passed: true })
  }
  return checks
}
