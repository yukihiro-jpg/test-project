// 二次相続シミュレーション

import type {
  SecondaryInheritanceConfig,
  SecondaryInheritanceResult,
  SecondaryHeirDetail,
  RatioSimulationResult,
  Case,
  Heir,
  TaxCalculationResult,
} from '@/types';
import { calculateInheritanceTax, calculateTotalAssetValue } from './inheritance-tax';
import {
  INHERITANCE_TAX_BRACKETS,
  BASIC_DEDUCTION_BASE,
  BASIC_DEDUCTION_PER_HEIR,
  calculateTaxFromBrackets,
} from './tax-tables';
import {
  countLegalHeirs,
  calculateLegalShareRatios,
  calculateSpouseDeduction,
} from './deductions';
import { calculateInsuranceExemption, calculateDeductibleFuneralExpenses } from './asset-valuation';
import { calculateAge } from '@/lib/dates/wareki';

/**
 * 二次相続の相続人を取得（配偶者を除く）
 */
function getSecondaryHeirs(heirs: Heir[]): Heir[] {
  return heirs.filter(h => h.relationship !== 'spouse');
}

/**
 * 配偶者の現在年齢を取得
 */
function getSpouseAge(heirs: Heir[], referenceDate: string): number {
  const spouse = heirs.find(h => h.relationship === 'spouse');
  if (!spouse) return 0;
  return calculateAge(spouse.birthDate, referenceDate);
}

/**
 * 指定された配偶者取得割合で一次相続税を計算する
 *
 * 法定相続分による総額計算は変わらないが、
 * 配偶者の実際取得額が変わるため配偶者控除が変動し、
 * 結果として各相続人の最終税額が変わる。
 */
function calculatePrimaryTaxWithSpouseRatio(
  primaryResult: TaxCalculationResult,
  heirs: Heir[],
  spouseRatio: number,
  referenceDate: string
): { totalTax: number; spouseAcquired: number; heirTaxes: Map<string, number> } {
  const { netTaxableValue, totalInheritanceTax } = primaryResult;

  const spouse = heirs.find(h => h.relationship === 'spouse');
  const nonSpouseHeirs = heirs.filter(h => h.relationship !== 'spouse');

  // 配偶者の取得額
  const spouseAcquired = Math.floor(netTaxableValue * spouseRatio);
  // 残りを他の相続人で等分
  const remainingValue = netTaxableValue - spouseAcquired;
  const perNonSpouseValue = nonSpouseHeirs.length > 0
    ? Math.floor(remainingValue / nonSpouseHeirs.length)
    : 0;

  // 按分税額の計算
  const totalAcquired = netTaxableValue;
  const heirTaxes = new Map<string, number>();

  // 法定相続分を取得（配偶者控除の計算に使用）
  const legalRatios = calculateLegalShareRatios(heirs);
  const spouseLegalRatio = spouse ? (legalRatios.get(spouse.id) || 0) : 0;

  let totalFinalTax = 0;

  for (const heir of heirs) {
    const isSpouse = heir.relationship === 'spouse';
    const acquiredValue = isSpouse ? spouseAcquired : perNonSpouseValue;
    const taxablePrice = Math.max(0, acquiredValue);

    // 按分税額
    const allocatedTax = totalAcquired > 0
      ? Math.floor(totalInheritanceTax * (taxablePrice / totalAcquired))
      : 0;

    // 配偶者控除
    const spouseDeduction = isSpouse
      ? calculateSpouseDeduction(
          totalInheritanceTax,
          taxablePrice,
          totalAcquired,
          spouseLegalRatio,
          netTaxableValue
        )
      : 0;

    const finalTax = Math.max(0, allocatedTax - spouseDeduction);
    heirTaxes.set(heir.id, finalTax);
    totalFinalTax += finalTax;
  }

  return {
    totalTax: totalFinalTax,
    spouseAcquired,
    heirTaxes,
  };
}

/**
 * 二次相続税を計算
 */
export function calculateSecondaryInheritanceTax(
  config: SecondaryInheritanceConfig,
  primaryResult: TaxCalculationResult,
  heirs: Heir[],
  referenceDate: string
): SecondaryInheritanceResult {
  const { spouseAcquisitionRatio, spouseOwnAssets, spouseExpectedDeathAge, estimatedAssetChangeRate } = config;

  // 一次相続の税額を配偶者取得割合に基づいて計算
  const primaryCalc = calculatePrimaryTaxWithSpouseRatio(
    primaryResult, heirs, spouseAcquisitionRatio, referenceDate
  );

  // 二次相続の相続人（配偶者を除く）
  const secondaryHeirs = getSecondaryHeirs(heirs);
  const secondaryHeirCount = secondaryHeirs.length;

  // 配偶者の現在年齢と二次相続までの年数
  const spouseCurrentAge = getSpouseAge(heirs, referenceDate);
  const yearsUntilDeath = Math.max(0, spouseExpectedDeathAge - spouseCurrentAge);

  // 配偶者が一次相続で取得した純額（配偶者の税引後取得額）
  const spouse = heirs.find(h => h.relationship === 'spouse');
  const spouseTaxOnPrimary = spouse ? (primaryCalc.heirTaxes.get(spouse.id) || 0) : 0;
  const spouseNetInherited = primaryCalc.spouseAcquired - spouseTaxOnPrimary;

  // 二次相続時の遺産総額 = (配偶者の取得額 + 配偶者固有財産) × (1 + 増減率)^年数
  const baseEstate = spouseNetInherited + spouseOwnAssets;
  const growthFactor = Math.pow(1 + estimatedAssetChangeRate, yearsUntilDeath);
  const secondaryEstateValue = Math.max(0, Math.floor(baseEstate * growthFactor));

  // 基礎控除
  const secondaryBasicDeduction = BASIC_DEDUCTION_BASE + BASIC_DEDUCTION_PER_HEIR * secondaryHeirCount;

  // 課税遺産総額
  const secondaryTaxableAmount = Math.max(0, secondaryEstateValue - secondaryBasicDeduction);

  // 法定相続分で按分して税額を計算（子のみなので等分）
  const sharePerHeir = secondaryHeirCount > 0 ? 1 / secondaryHeirCount : 0;
  let secondaryTotalTax = 0;

  for (let i = 0; i < secondaryHeirCount; i++) {
    const legalShareAmount = Math.floor(secondaryTaxableAmount * sharePerHeir);
    const taxOnShare = calculateTaxFromBrackets(legalShareAmount, INHERITANCE_TAX_BRACKETS);
    secondaryTotalTax += taxOnShare;
  }

  // 各相続人の税額を按分（等分取得の場合は均等）
  const perHeirAcquired = secondaryHeirCount > 0
    ? Math.floor(secondaryEstateValue / secondaryHeirCount)
    : 0;
  const perHeirTax = secondaryHeirCount > 0
    ? Math.floor(secondaryTotalTax / secondaryHeirCount)
    : 0;

  const secondaryHeirDetails: SecondaryHeirDetail[] = secondaryHeirs.map(heir => ({
    heirId: heir.id,
    heirName: heir.name,
    acquiredValue: perHeirAcquired,
    tax: perHeirTax,
  }));

  // 一次相続で配偶者以外が払った税の合計
  const primaryOtherHeirsTax = Array.from(primaryCalc.heirTaxes.entries())
    .filter(([id]) => !spouse || id !== spouse.id)
    .reduce((sum, [, tax]) => sum + tax, 0);

  const combinedTotalTax = primaryCalc.totalTax + secondaryTotalTax;

  // 比較シミュレーション
  const ratioSimulations = simulateRatioComparison(config, primaryResult, heirs, referenceDate);

  return {
    primaryTax: primaryCalc.totalTax,
    primarySpouseAcquired: primaryCalc.spouseAcquired,
    primaryOtherHeirsTax,
    secondaryEstateValue,
    secondaryBasicDeduction,
    secondaryTaxableAmount,
    secondaryTotalTax,
    secondaryHeirDetails,
    combinedTotalTax,
    ratioSimulations,
  };
}

/**
 * 配偶者取得割合を変えた場合の一次+二次相続税を比較シミュレーション
 */
export function simulateRatioComparison(
  config: SecondaryInheritanceConfig,
  primaryResult: TaxCalculationResult,
  heirs: Heir[],
  referenceDate: string
): RatioSimulationResult[] {
  const results: RatioSimulationResult[] = [];

  // 法定相続分を取得
  const legalRatios = calculateLegalShareRatios(heirs);
  const spouse = heirs.find(h => h.relationship === 'spouse');
  const spouseLegalRatio = spouse ? (legalRatios.get(spouse.id) || 0.5) : 0.5;

  // 0%〜100%を10%刻み + 法定相続分
  const ratios: { ratio: number; label: string }[] = [];
  for (let pct = 0; pct <= 100; pct += 10) {
    ratios.push({ ratio: pct / 100, label: `${pct}%` });
  }

  // 法定相続分が既存の割合と重複しなければ追加
  const legalPct = Math.round(spouseLegalRatio * 100);
  const alreadyIncluded = ratios.some(r => Math.round(r.ratio * 100) === legalPct);
  if (!alreadyIncluded) {
    ratios.push({ ratio: spouseLegalRatio, label: `法定相続分(${legalPct}%)` });
  } else {
    // 既存のエントリのラベルを法定相続分に更新
    const existing = ratios.find(r => Math.round(r.ratio * 100) === legalPct);
    if (existing) {
      existing.label = `法定相続分(${legalPct}%)`;
    }
  }

  // 割合の昇順でソート
  ratios.sort((a, b) => a.ratio - b.ratio);

  const secondaryHeirs = getSecondaryHeirs(heirs);
  const secondaryHeirCount = secondaryHeirs.length;
  const spouseCurrentAge = getSpouseAge(heirs, referenceDate);
  const yearsUntilDeath = Math.max(0, config.spouseExpectedDeathAge - spouseCurrentAge);

  for (const { ratio, label } of ratios) {
    // 一次相続
    const primaryCalc = calculatePrimaryTaxWithSpouseRatio(
      primaryResult, heirs, ratio, referenceDate
    );

    // 配偶者の二次相続遺産
    const spouseTaxOnPrimary = spouse ? (primaryCalc.heirTaxes.get(spouse.id) || 0) : 0;
    const spouseNetInherited = primaryCalc.spouseAcquired - spouseTaxOnPrimary;
    const baseEstate = spouseNetInherited + config.spouseOwnAssets;
    const growthFactor = Math.pow(1 + config.estimatedAssetChangeRate, yearsUntilDeath);
    const secondaryEstateValue = Math.max(0, Math.floor(baseEstate * growthFactor));

    // 二次相続税
    const secondaryBasicDeduction = BASIC_DEDUCTION_BASE + BASIC_DEDUCTION_PER_HEIR * secondaryHeirCount;
    const secondaryTaxableAmount = Math.max(0, secondaryEstateValue - secondaryBasicDeduction);

    const sharePerHeir = secondaryHeirCount > 0 ? 1 / secondaryHeirCount : 0;
    let secondaryTotalTax = 0;
    for (let i = 0; i < secondaryHeirCount; i++) {
      const legalShareAmount = Math.floor(secondaryTaxableAmount * sharePerHeir);
      const taxOnShare = calculateTaxFromBrackets(legalShareAmount, INHERITANCE_TAX_BRACKETS);
      secondaryTotalTax += taxOnShare;
    }

    results.push({
      spouseRatio: ratio,
      label,
      primaryTotalTax: primaryCalc.totalTax,
      secondaryTotalTax,
      combinedTotalTax: primaryCalc.totalTax + secondaryTotalTax,
    });
  }

  return results;
}
