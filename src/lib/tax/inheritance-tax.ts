// 相続税計算メインエンジン

import type {
  Case,
  Assets,
  Heir,
  DivisionPlan,
  TaxCalculationResult,
  HeirTaxDetail,
} from '@/types';
import {
  calculateLandValue,
  calculateBuildingValue,
  calculateCashValue,
  calculateListedStockValue,
  calculateUnlistedStockValue,
  calculateOtherAssetValue,
  calculateInsuranceExemption,
  calculateRetirementExemption,
  calculateDeductibleFuneralExpenses,
} from './asset-valuation';
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
  calculateMinorDeduction,
  calculateDisabilityDeduction,
} from './deductions';

/**
 * 財産総額を計算
 */
export function calculateTotalAssetValue(assets: Assets): number {
  let total = 0;

  // 土地（紐づく建物がある場合は貸家建付地の減額を適用）
  total += assets.lands.reduce((sum, l) => {
    const linkedBld = l.linkedBuildingId ? assets.buildings.find(b => b.id === l.linkedBuildingId) : undefined;
    return sum + calculateLandValue(l, linkedBld);
  }, 0);

  // 建物
  total += assets.buildings.reduce((sum, b) => sum + calculateBuildingValue(b), 0);

  // 現金預金
  total += assets.cashDeposits.reduce((sum, c) => sum + calculateCashValue(c), 0);

  // 上場株式
  total += assets.listedStocks.reduce((sum, s) => sum + calculateListedStockValue(s).totalValue, 0);

  // 非上場株式
  total += assets.unlistedStocks.reduce((sum, s) => sum + calculateUnlistedStockValue(s), 0);

  // その他財産
  total += assets.others.reduce((sum, o) => sum + calculateOtherAssetValue(o), 0);

  return total;
}

/**
 * 各相続人の取得財産額を遺産分割案から計算
 */
function calculateHeirAcquiredValues(
  caseData: Case
): Map<string, number> {
  const { assets, division, heirs } = caseData;
  const heirValues = new Map<string, number>();

  // 初期化
  heirs.forEach(h => heirValues.set(h.id, 0));

  // 分割エントリがない場合は法定相続分で按分
  if (!division.entries || division.entries.length === 0) {
    const totalAsset = calculateTotalAssetValue(assets);
    const legalHeirCount = countLegalHeirs(heirs);
    const insurance = calculateInsuranceExemption(assets.insurances, legalHeirCount);
    const retirement = calculateRetirementExemption(assets.retirementBenefits, legalHeirCount);
    const totalDebt = assets.debts.reduce((sum, d) => sum + d.amount, 0);
    const funeralDeductible = calculateDeductibleFuneralExpenses(assets.funeralExpenses);
    const netValue = totalAsset + insurance.taxableAmount + retirement.taxableAmount - totalDebt - funeralDeductible;

    const ratios = calculateLegalShareRatios(heirs);
    ratios.forEach((ratio, heirId) => {
      heirValues.set(heirId, Math.floor(netValue * ratio));
    });
    return heirValues;
  }

  // 分割エントリに基づいて計算
  for (const entry of division.entries) {
    const current = heirValues.get(entry.heirId) || 0;
    if (entry.amount !== undefined) {
      heirValues.set(entry.heirId, current + entry.amount);
    }
  }

  // 代償分割金の調整
  for (const comp of assets.compensationPayments) {
    const payerValue = heirValues.get(comp.payerHeirId) || 0;
    const receiverValue = heirValues.get(comp.receiverHeirId) || 0;
    heirValues.set(comp.payerHeirId, payerValue - comp.amount);
    heirValues.set(comp.receiverHeirId, receiverValue + comp.amount);
  }

  return heirValues;
}

/**
 * 相続税を計算（メイン関数）
 */
export function calculateInheritanceTax(caseData: Case): TaxCalculationResult {
  const { assets, heirs, referenceDate } = caseData;
  const legalHeirCount = countLegalHeirs(heirs);

  // 1. 財産総額
  const totalAssetValue = calculateTotalAssetValue(assets);

  // 2. 保険金の非課税枠
  const insurance = calculateInsuranceExemption(assets.insurances, legalHeirCount);

  // 2.5. 退職金の非課税枠
  const retirement = calculateRetirementExemption(assets.retirementBenefits, legalHeirCount);

  // 3. 債務・葬式費用
  const totalDebt = assets.debts.reduce((sum, d) => sum + d.amount, 0);
  const funeralDeductible = calculateDeductibleFuneralExpenses(assets.funeralExpenses);
  const totalDeductions = totalDebt + funeralDeductible;

  // 4. 課税価格合計
  const netTaxableValue = Math.max(0,
    totalAssetValue + insurance.taxableAmount + retirement.taxableAmount - totalDeductions
  );

  // 5. 基礎控除
  const basicDeduction = BASIC_DEDUCTION_BASE + BASIC_DEDUCTION_PER_HEIR * legalHeirCount;

  // 6. 課税遺産総額
  const taxableAmount = Math.max(0, netTaxableValue - basicDeduction);

  // 7. 法定相続分で按分して相続税の総額を計算
  const legalShareRatios = calculateLegalShareRatios(heirs);
  let totalInheritanceTax = 0;
  const legalShareTaxes = new Map<string, { ratio: number; amount: number; tax: number }>();

  legalShareRatios.forEach((ratio, heirId) => {
    const amount = Math.floor(taxableAmount * ratio);
    const tax = calculateTaxFromBrackets(amount, INHERITANCE_TAX_BRACKETS);
    legalShareTaxes.set(heirId, { ratio, amount, tax });
    totalInheritanceTax += tax;
  });

  // 8. 各人の取得財産額を算出
  const heirAcquiredValues = calculateHeirAcquiredValues(caseData);

  // 9. 各人の相続税額を按分して計算
  const totalAcquired = Array.from(heirAcquiredValues.values()).reduce((sum, v) => sum + Math.max(0, v), 0);

  const heirTaxDetails: HeirTaxDetail[] = heirs.map(heir => {
    const acquiredValue = heirAcquiredValues.get(heir.id) || 0;
    const taxablePrice = Math.max(0, acquiredValue);
    const legalData = legalShareTaxes.get(heir.id) || { ratio: 0, amount: 0, tax: 0 };

    // 按分税額
    const allocatedTax = totalAcquired > 0
      ? Math.floor(totalInheritanceTax * (taxablePrice / totalAcquired))
      : 0;

    // 配偶者控除
    const spouseDeduction = heir.relationship === 'spouse'
      ? calculateSpouseDeduction(
          totalInheritanceTax,
          taxablePrice,
          totalAcquired,
          legalData.ratio,
          netTaxableValue
        )
      : 0;

    // 未成年者控除
    const minorDeduction = calculateMinorDeduction(heir, referenceDate);

    // 障害者控除
    const disabilityDeduction = calculateDisabilityDeduction(heir, referenceDate);

    // 最終税額
    const finalTax = Math.max(0,
      allocatedTax - spouseDeduction - minorDeduction - disabilityDeduction
    );

    return {
      heirId: heir.id,
      heirName: heir.name,
      acquiredValue,
      taxablePrice,
      legalShareRatio: legalData.ratio,
      legalShareAmount: legalData.amount,
      taxOnLegalShare: legalData.tax,
      allocatedTax,
      spouseDeduction,
      minorDeduction,
      disabilityDeduction,
      finalTax,
    };
  });

  return {
    totalAssetValue: totalAssetValue + insurance.totalAmount + retirement.totalAmount,
    totalDeductions,
    insuranceExemption: insurance.exemption,
    retirementExemption: retirement.exemption,
    netTaxableValue,
    basicDeduction,
    taxableAmount,
    totalInheritanceTax,
    heirTaxDetails,
  };
}
