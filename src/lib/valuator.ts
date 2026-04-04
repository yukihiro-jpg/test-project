import Decimal from 'decimal.js';
import { AssetCategory } from '@/types/asset';
import type { DecedentInfo } from '@/types/decedent';
import type { ExtractedInsuranceData } from '@/types/extracted';
import type {
  ValuationResult,
  DeathInsuranceBreakdown,
  AnnuityThreeWayBreakdown,
  PerpetualAnnuityBreakdown,
  PreEventAnnuityBreakdown,
  ContractRightsBreakdown,
} from '@/types/valuation';
import { NON_TAXABLE_PER_HEIR, remainingYearsRatio } from './constants';
import { decimalMax, floorToYen, toDecimalOrNull } from './decimal-helpers';
import { compoundAnnuityPresentValueFactor } from './annuity-present-value';

/**
 * 資産区分と抽出データから評価額を計算する
 */
export function calculate(
  extracted: ExtractedInsuranceData,
  category: AssetCategory,
  decedent: DecedentInfo,
): ValuationResult {
  switch (category) {
    case AssetCategory.DEATH_INSURANCE_PROCEEDS:
      return calculateDeathInsurance(extracted, decedent);
    case AssetCategory.FIXED_TERM_ANNUITY:
      return calculateFixedTermAnnuity(extracted);
    case AssetCategory.PERPETUAL_ANNUITY:
      return calculatePerpetualAnnuity(extracted);
    case AssetCategory.LIFETIME_ANNUITY:
      return calculateLifetimeAnnuity(extracted);
    case AssetCategory.PRE_EVENT_ANNUITY:
      return calculatePreEventAnnuity(extracted);
    case AssetCategory.GUARANTEED_PERIOD_ANNUITY:
      return calculateGuaranteedPeriodAnnuity(extracted);
    case AssetCategory.NON_CONTRACTUAL_ANNUITY:
      return calculateFixedTermAnnuity(extracted);
    case AssetCategory.LIFE_INSURANCE_CONTRACT_RIGHTS:
    case AssetCategory.NON_LIFE_INSURANCE_CONTRACT_RIGHTS:
      return calculateContractRights(extracted);
  }
}

function calculateDeathInsurance(
  extracted: ExtractedInsuranceData,
  decedent: DecedentInfo,
): ValuationResult {
  const gross = new Decimal(
    extracted.paidOutAmount ?? extracted.deathBenefitAmount ?? 0,
  );
  const nonTaxableLimit = NON_TAXABLE_PER_HEIR.mul(
    decedent.numberOfLegalHeirs,
  );
  const taxable = floorToYen(Decimal.max(new Decimal(0), gross.minus(nonTaxableLimit)));

  const breakdown: DeathInsuranceBreakdown = {
    type: 'death_insurance',
    grossAmount: gross.toString(),
    nonTaxableLimit: nonTaxableLimit.toString(),
    taxableAmount: taxable.toString(),
  };

  return { assessedValue: taxable.toString(), breakdown };
}

function calculateThreeWayMax(
  extracted: ExtractedInsuranceData,
  remainingYears: number,
): { result: Decimal; breakdown: AnnuityThreeWayBreakdown } {
  const annual = toDecimalOrNull(extracted.annualAnnuityAmount);
  const surrender = toDecimalOrNull(extracted.surrenderValue);
  const lumpSum = toDecimalOrNull(extracted.lumpSumOptionAmount);
  const rate = toDecimalOrNull(extracted.assumedInterestRate);

  // 方法1: 年額 × 残存年数 × 残存期間割合
  let presentValue: Decimal | null = null;
  if (annual !== null && rate !== null) {
    const pvFactor = compoundAnnuityPresentValueFactor(remainingYears, rate);
    presentValue = floorToYen(annual.mul(pvFactor));
  }

  // 方法2: 一時金相当額はそのまま
  // 方法3: 解約返戻金はそのまま

  const selectedMax = floorToYen(decimalMax(surrender, lumpSum, presentValue));

  const breakdown: AnnuityThreeWayBreakdown = {
    type: 'annuity_three_way',
    surrenderValue: surrender?.toString() ?? null,
    lumpSumAmount: lumpSum?.toString() ?? null,
    presentValueCalc: presentValue?.toString() ?? null,
    selectedMax: selectedMax.toString(),
  };

  return { result: selectedMax, breakdown };
}

function calculateFixedTermAnnuity(
  extracted: ExtractedInsuranceData,
): ValuationResult {
  const years = extracted.annuityPaymentPeriodYears ?? 0;
  const { result, breakdown } = calculateThreeWayMax(extracted, years);
  return { assessedValue: result.toString(), breakdown };
}

function calculatePerpetualAnnuity(
  extracted: ExtractedInsuranceData,
): ValuationResult {
  const annual = new Decimal(extracted.annualAnnuityAmount ?? 0);
  const rate = new Decimal(extracted.assumedInterestRate ?? 0);

  let calculated: Decimal;
  if (rate.isZero()) {
    calculated = new Decimal(0);
  } else {
    calculated = floorToYen(annual.div(rate));
  }

  const breakdown: PerpetualAnnuityBreakdown = {
    type: 'perpetual_annuity',
    annualAmount: annual.toString(),
    assumedRate: rate.toString(),
    calculatedValue: calculated.toString(),
  };

  return { assessedValue: calculated.toString(), breakdown };
}

function calculateLifetimeAnnuity(
  extracted: ExtractedInsuranceData,
): ValuationResult {
  // 終身定期金: 平均余命ベースの三方最大値
  // 注: 受取人の年齢・性別が必要だが、PDFから直接取得できない場合がある
  // ここでは annuityPaymentPeriodYears がある場合はそれを使い、
  // ない場合は一時金と解約返戻金の比較のみ行う
  const years = extracted.annuityPaymentPeriodYears ?? 20;
  const { result, breakdown } = calculateThreeWayMax(extracted, years);
  return { assessedValue: result.toString(), breakdown };
}

function calculatePreEventAnnuity(
  extracted: ExtractedInsuranceData,
): ValuationResult {
  const premiums = new Decimal(extracted.totalPremiumsPaid ?? 0);
  const assessed = floorToYen(premiums);

  const breakdown: PreEventAnnuityBreakdown = {
    type: 'pre_event_annuity',
    totalPremiumsPaid: assessed.toString(),
  };

  return { assessedValue: assessed.toString(), breakdown };
}

function calculateGuaranteedPeriodAnnuity(
  extracted: ExtractedInsuranceData,
): ValuationResult {
  const years = extracted.guaranteePeriodYears ?? 0;
  const { result, breakdown } = calculateThreeWayMax(extracted, years);
  return { assessedValue: result.toString(), breakdown };
}

function calculateContractRights(
  extracted: ExtractedInsuranceData,
): ValuationResult {
  const surrender = new Decimal(extracted.surrenderValue ?? 0);
  const assessed = floorToYen(surrender);

  const breakdown: ContractRightsBreakdown = {
    type: 'contract_rights',
    surrenderValue: assessed.toString(),
  };

  return { assessedValue: assessed.toString(), breakdown };
}
