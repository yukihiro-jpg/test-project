// 贈与税計算エンジン（暦年課税 + 相続時精算課税）

import type {
  GiftPlan,
  GiftPlanEntry,
  GiftTaxResult,
  GiftTaxResultEntry,
  Heir,
  TaxCalculationResult,
} from '@/types';
import {
  GIFT_TAX_GENERAL_BRACKETS,
  GIFT_TAX_SPECIAL_BRACKETS,
  GIFT_TAX_BASIC_DEDUCTION,
  SETTLEMENT_SPECIAL_DEDUCTION,
  SETTLEMENT_BASIC_DEDUCTION,
  SETTLEMENT_TAX_RATE,
  calculateTaxFromBrackets,
} from './tax-tables';
import { calculateAge } from '@/lib/dates/wareki';

/**
 * 暦年贈与の贈与税を計算（1年分）
 */
export function calculateCalendarGiftTax(
  annualGiftAmount: number,
  isSpecialRate: boolean
): number {
  const taxableAmount = annualGiftAmount - GIFT_TAX_BASIC_DEDUCTION;
  if (taxableAmount <= 0) return 0;

  const brackets = isSpecialRate
    ? GIFT_TAX_SPECIAL_BRACKETS
    : GIFT_TAX_GENERAL_BRACKETS;

  return calculateTaxFromBrackets(taxableAmount, brackets);
}

/**
 * 相続時精算課税の贈与税を計算（累計ベース）
 */
export function calculateSettlementGiftTax(
  annualGiftAmount: number,
  cumulativeGiftBeforeThisYear: number
): { tax: number; usedSpecialDeduction: number } {
  // 年間110万円の基礎控除
  const afterBasicDeduction = Math.max(0, annualGiftAmount - SETTLEMENT_BASIC_DEDUCTION);

  if (afterBasicDeduction === 0) {
    return { tax: 0, usedSpecialDeduction: 0 };
  }

  // 特別控除の残額
  const remainingSpecialDeduction = Math.max(0, SETTLEMENT_SPECIAL_DEDUCTION - cumulativeGiftBeforeThisYear);
  const usedSpecialDeduction = Math.min(afterBasicDeduction, remainingSpecialDeduction);

  // 特別控除適用後の課税対象額
  const taxableAmount = afterBasicDeduction - usedSpecialDeduction;

  // 一律20%
  const tax = Math.floor(taxableAmount * SETTLEMENT_TAX_RATE);

  return { tax, usedSpecialDeduction };
}

/**
 * 贈与が特例税率（直系尊属→18歳以上）の対象かを判定
 */
function isSpecialRateApplicable(heir: Heir, referenceDate: string): boolean {
  const age = calculateAge(heir.birthDate, referenceDate);
  // 直系卑属（子・養子・代襲相続の孫）で18歳以上
  const isDirectDescendant = ['child', 'adopted', 'grandchild_proxy'].includes(heir.relationship);
  return isDirectDescendant && age >= 18;
}

/**
 * 贈与シミュレーションを実行
 */
export function simulateGiftTax(
  giftPlan: GiftPlan,
  heirs: Heir[],
  referenceDate: string,
  originalTaxResult: TaxCalculationResult
): GiftTaxResult {
  const entries: GiftTaxResultEntry[] = [];
  let totalGiftTax = 0;

  // 相続時精算課税の累計額を追跡（受贈者ごと）
  const cumulativeSettlement = new Map<string, number>();

  for (const planEntry of giftPlan.entries) {
    const heir = heirs.find(h => h.id === planEntry.heirId);
    if (!heir) continue;

    const isSpecialRate = isSpecialRateApplicable(heir, referenceDate);
    let cumulativeGift = 0;
    let cumulativeGiftTax = 0;

    for (let yearOffset = 0; yearOffset < planEntry.years; yearOffset++) {
      const year = planEntry.startYear + yearOffset;
      let giftTax: number;

      if (planEntry.taxSystem === 'calendar') {
        // 暦年課税
        giftTax = calculateCalendarGiftTax(planEntry.annualAmount, isSpecialRate);
      } else {
        // 相続時精算課税
        const prevCumulative = cumulativeSettlement.get(planEntry.heirId) || 0;
        const result = calculateSettlementGiftTax(planEntry.annualAmount, prevCumulative);
        giftTax = result.tax;
        // 基礎控除を除いた額を累計に加算
        const addToCumulative = Math.max(0, planEntry.annualAmount - SETTLEMENT_BASIC_DEDUCTION);
        cumulativeSettlement.set(planEntry.heirId, prevCumulative + addToCumulative);
      }

      cumulativeGift += planEntry.annualAmount;
      cumulativeGiftTax += giftTax;
      totalGiftTax += giftTax;

      entries.push({
        heirId: planEntry.heirId,
        year,
        giftAmount: planEntry.annualAmount,
        taxSystem: planEntry.taxSystem,
        giftTax,
        cumulativeGift,
        cumulativeGiftTax,
      });
    }
  }

  // 贈与により減少する相続財産の概算
  const totalGifted = entries.reduce((sum, e) => sum + e.giftAmount, 0);

  // 相続時精算課税で贈与した分は相続財産に加算される（基礎控除分除く）
  const settlementAddBack = Array.from(cumulativeSettlement.values()).reduce((sum, v) => sum + v, 0);

  // 暦年贈与で減少する相続財産（簡易計算）
  const calendarGifted = entries
    .filter(e => e.taxSystem === 'calendar')
    .reduce((sum, e) => sum + e.giftAmount, 0);

  // 概算の節税効果
  const estimatedReduction = calendarGifted - settlementAddBack;
  const originalTotalTax = originalTaxResult.heirTaxDetails.reduce((sum, h) => sum + h.finalTax, 0);

  // 簡易計算：贈与により相続財産が減少した場合の相続税の概算削減額
  // 実際には再計算が必要だが、限界税率で概算
  const marginalRate = estimateMarginalRate(originalTaxResult.taxableAmount);
  const estimatedInheritanceTaxSaving = Math.floor(estimatedReduction * marginalRate);

  const inheritanceTaxWithGift = Math.max(0, originalTotalTax - estimatedInheritanceTaxSaving);
  const totalTaxBurden = inheritanceTaxWithGift + totalGiftTax;
  const taxSaving = originalTotalTax - totalTaxBurden;

  return {
    entries,
    totalGiftTax,
    inheritanceTaxWithGift,
    totalTaxBurden,
    taxSaving: Math.max(0, taxSaving),
  };
}

/**
 * 課税遺産総額から限界税率を推定
 */
function estimateMarginalRate(taxableAmount: number): number {
  if (taxableAmount <= 10_000_000) return 0.10;
  if (taxableAmount <= 30_000_000) return 0.15;
  if (taxableAmount <= 50_000_000) return 0.20;
  if (taxableAmount <= 100_000_000) return 0.30;
  if (taxableAmount <= 200_000_000) return 0.40;
  if (taxableAmount <= 300_000_000) return 0.45;
  if (taxableAmount <= 600_000_000) return 0.50;
  return 0.55;
}
