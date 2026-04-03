// 節税シミュレーションエンジン

import type {
  Case,
  TaxSavingStrategy,
  TaxSavingSimulationResult,
  StrategyResult,
  TaxCalculationResult,
  GiftPlan,
  InsuranceSavingPlan,
} from '@/types';
import { calculateInheritanceTax, calculateTotalAssetValue } from './inheritance-tax';
import { simulateGiftTax } from './gift-tax';
import { calculateInsuranceExemption } from './asset-valuation';
import { countLegalHeirs } from './deductions';
import { INSURANCE_EXEMPTION_PER_HEIR, BASIC_DEDUCTION_PER_HEIR } from './tax-tables';

/**
 * 対策種別の日本語ラベル
 */
export const STRATEGY_LABELS: Record<string, string> = {
  gift: '生前贈与',
  life_insurance: '生命保険活用',
  real_estate: '不動産活用',
  '養子縁組': '養子縁組',
  education_fund: '教育資金一括贈与',
  housing_fund: '住宅取得資金贈与',
  marriage_child_fund: '結婚・子育て資金一括贈与',
  small_land_special: '小規模宅地等の特例活用',
  spouse_deduction: '配偶者控除最大活用',
};

// --- 定数 ---

/** 教育資金一括贈与の非課税限度額（1人あたり） */
const EDUCATION_FUND_LIMIT = 15_000_000;

/** 住宅取得資金贈与の非課税限度額 */
const HOUSING_FUND_LIMIT = 10_000_000;

/** 不動産活用時の評価圧縮率（現金→賃貸建物の実効評価割合） */
const REAL_ESTATE_EFFECTIVE_RATIO = 0.42;

// --- メイン関数 ---

/**
 * 節税シミュレーションを実行
 *
 * 各対策を独立に評価し、個別の節税効果と合計を算出する。
 * 対策間の相互作用は簡易計算のため考慮しない。
 */
export function simulateTaxSaving(
  caseData: Case,
  strategies: TaxSavingStrategy[]
): TaxSavingSimulationResult {
  // 1. 対策前の税額を計算
  const originalResult = calculateInheritanceTax(caseData);
  const beforeTax = originalResult.heirTaxDetails.reduce(
    (sum, h) => sum + h.finalTax,
    0
  );

  const marginalRate = estimateMarginalRate(originalResult.taxableAmount);

  // 2. 有効な各対策の節税効果を計算
  const strategyResults: StrategyResult[] = [];

  for (const strategy of strategies) {
    if (!strategy.enabled) continue;

    const result = calculateStrategyResult(
      caseData,
      strategy,
      originalResult,
      marginalRate
    );
    if (result) {
      strategyResults.push(result);
    }
  }

  // 3. 合計節税額
  const totalSaving = strategyResults.reduce((sum, r) => sum + r.saving, 0);
  const afterTax = Math.max(0, beforeTax - totalSaving);

  return {
    beforeTax,
    strategyResults,
    afterTax,
    totalSaving,
  };
}

// --- 対策ごとの振り分け ---

function calculateStrategyResult(
  caseData: Case,
  strategy: TaxSavingStrategy,
  originalResult: TaxCalculationResult,
  marginalRate: number
): StrategyResult | null {
  const label = STRATEGY_LABELS[strategy.type] || strategy.type;

  switch (strategy.type) {
    case 'gift': {
      if (!strategy.giftPlan) return null;
      return calculateGiftSaving(
        caseData,
        strategy.id,
        strategy.giftPlan,
        originalResult,
        label
      );
    }
    case 'life_insurance': {
      if (!strategy.insurancePlan) return null;
      return calculateLifeInsuranceSaving(
        caseData,
        strategy.insurancePlan,
        marginalRate,
        strategy.id,
        label
      );
    }
    case '養子縁組':
      return calculateAdoptionSaving(caseData, marginalRate, strategy.id, label);
    case 'education_fund': {
      const amount = strategy.estimatedReduction || 0;
      return calculateEducationFundSaving(amount, marginalRate, strategy.id, label);
    }
    case 'housing_fund': {
      const amount = strategy.estimatedReduction || 0;
      return calculateHousingFundSaving(amount, marginalRate, strategy.id, label);
    }
    case 'real_estate': {
      const investmentAmount = strategy.estimatedReduction || 0;
      return calculateRealEstateSaving(investmentAmount, marginalRate, strategy.id, label);
    }
    case 'small_land_special':
      return calculateSmallLandSaving(caseData, marginalRate, strategy.id, label);
    case 'spouse_deduction':
      return calculateSpouseDeductionSaving(
        caseData,
        originalResult,
        strategy.id,
        label
      );
    default:
      return null;
  }
}

// --- 各対策の計算関数 ---

/**
 * 生前贈与（gift-tax.ts の simulateGiftTax をラップ）
 */
function calculateGiftSaving(
  caseData: Case,
  strategyId: string,
  giftPlan: GiftPlan,
  originalResult: TaxCalculationResult,
  label: string
): StrategyResult {
  const giftResult = simulateGiftTax(
    giftPlan,
    caseData.heirs,
    caseData.referenceDate,
    originalResult
  );

  return {
    strategyId,
    type: 'gift',
    label,
    saving: giftResult.taxSaving,
    detail: `贈与税 ${formatYen(giftResult.totalGiftTax)}、相続税削減 ${formatYen(giftResult.taxSaving + giftResult.totalGiftTax)}、差引節税 ${formatYen(giftResult.taxSaving)}`,
  };
}

/**
 * 生命保険活用
 *
 * 現金を生命保険に移し替えることで、非課税枠を活用する。
 * 非課税枠 = 500万 × 法定相続人数
 */
function calculateLifeInsuranceSaving(
  caseData: Case,
  plan: InsuranceSavingPlan,
  marginalRate: number,
  strategyId: string,
  label: string
): StrategyResult {
  const { assets, heirs } = caseData;
  const legalHeirCount = countLegalHeirs(heirs);

  // 現在の保険金合計
  const currentInsuranceTotal = assets.insurances
    .filter(i => i.isDeathBenefit)
    .reduce((sum, i) => sum + i.amount, 0);

  // 非課税枠
  const exemptionLimit = INSURANCE_EXEMPTION_PER_HEIR * legalHeirCount;

  // 追加保険金を加えた後の合計
  const newInsuranceTotal = currentInsuranceTotal + plan.additionalDeathBenefit;

  // 新たに非課税枠に収まる額（= 節税対象額）
  const currentExempted = Math.min(currentInsuranceTotal, exemptionLimit);
  const newExempted = Math.min(newInsuranceTotal, exemptionLimit);
  const additionalSheltered = newExempted - currentExempted;

  // 節税効果 = 非課税枠で保護された額 × 限界税率
  const saving = Math.floor(additionalSheltered * marginalRate);

  return {
    strategyId,
    type: 'life_insurance',
    label,
    saving: Math.max(0, saving),
    detail: `非課税枠 ${formatYen(exemptionLimit)}（現在 ${formatYen(currentInsuranceTotal)}）、追加保険金 ${formatYen(plan.additionalDeathBenefit)}、非課税活用増加分 ${formatYen(additionalSheltered)}`,
  };
}

/**
 * 養子縁組
 *
 * 法定相続人を増やすことで基礎控除・保険非課税枠を拡大する。
 * 実子がいる場合は養子1人まで、いない場合は2人まで。
 */
function calculateAdoptionSaving(
  caseData: Case,
  marginalRate: number,
  strategyId: string,
  label: string
): StrategyResult {
  const { heirs } = caseData;

  const hasRealChild = heirs.some(
    h => h.relationship === 'child' || h.relationship === 'grandchild_proxy'
  );
  const currentAdoptedCount = heirs.filter(h => h.relationship === 'adopted').length;
  const maxAdopted = hasRealChild ? 1 : 2;

  // これ以上養子を追加できるか
  const additionalAdoptable = Math.max(0, maxAdopted - currentAdoptedCount);

  if (additionalAdoptable === 0) {
    return {
      strategyId,
      type: '養子縁組',
      label,
      saving: 0,
      detail: '養子の上限に達しているため追加効果なし',
    };
  }

  // 養子1人追加あたりの効果
  const deductionIncrease = BASIC_DEDUCTION_PER_HEIR * additionalAdoptable;
  const insuranceIncrease = INSURANCE_EXEMPTION_PER_HEIR * additionalAdoptable;
  const totalReduction = deductionIncrease + insuranceIncrease;

  const saving = Math.floor(totalReduction * marginalRate);

  return {
    strategyId,
    type: '養子縁組',
    label,
    saving: Math.max(0, saving),
    detail: `養子 ${additionalAdoptable}人追加可、基礎控除増 ${formatYen(deductionIncrease)}、保険非課税枠増 ${formatYen(insuranceIncrease)}`,
  };
}

/**
 * 教育資金一括贈与（1人あたり最大1,500万円非課税）
 */
function calculateEducationFundSaving(
  amount: number,
  marginalRate: number,
  strategyId: string,
  label: string
): StrategyResult {
  const effectiveAmount = Math.min(amount, EDUCATION_FUND_LIMIT);
  const saving = Math.floor(effectiveAmount * marginalRate);

  return {
    strategyId,
    type: 'education_fund',
    label,
    saving: Math.max(0, saving),
    detail: `贈与額 ${formatYen(effectiveAmount)}（上限 ${formatYen(EDUCATION_FUND_LIMIT)}）× 限界税率 ${(marginalRate * 100).toFixed(0)}%`,
  };
}

/**
 * 住宅取得資金贈与（最大1,000万円非課税）
 */
function calculateHousingFundSaving(
  amount: number,
  marginalRate: number,
  strategyId: string,
  label: string
): StrategyResult {
  const effectiveAmount = Math.min(amount, HOUSING_FUND_LIMIT);
  const saving = Math.floor(effectiveAmount * marginalRate);

  return {
    strategyId,
    type: 'housing_fund',
    label,
    saving: Math.max(0, saving),
    detail: `贈与額 ${formatYen(effectiveAmount)}（上限 ${formatYen(HOUSING_FUND_LIMIT)}）× 限界税率 ${(marginalRate * 100).toFixed(0)}%`,
  };
}

/**
 * 不動産活用（現金→賃貸不動産への組み換え）
 *
 * 現金100% → 建物（固定資産税評価額 ~60%）× (1 - 借家権割合30%) = ~42%
 * 圧縮効果 = 投資額 × (1 - 0.42) = 投資額 × 58%
 */
function calculateRealEstateSaving(
  investmentAmount: number,
  marginalRate: number,
  strategyId: string,
  label: string
): StrategyResult {
  const valuationReduction = investmentAmount * (1 - REAL_ESTATE_EFFECTIVE_RATIO);
  const saving = Math.floor(valuationReduction * marginalRate);

  return {
    strategyId,
    type: 'real_estate',
    label,
    saving: Math.max(0, saving),
    detail: `投資額 ${formatYen(investmentAmount)} → 評価額 ${formatYen(Math.floor(investmentAmount * REAL_ESTATE_EFFECTIVE_RATIO))}（圧縮 ${formatYen(Math.floor(valuationReduction))}）`,
  };
}

/**
 * 小規模宅地等の特例活用
 *
 * 特例未適用の土地に特例を適用した場合の節税効果を算出する。
 */
function calculateSmallLandSaving(
  caseData: Case,
  marginalRate: number,
  strategyId: string,
  label: string
): StrategyResult {
  const { assets } = caseData;

  // 特例未適用の土地を探す
  let totalPotentialReduction = 0;
  const eligibleLands: string[] = [];

  for (const land of assets.lands) {
    // 既に適用済みの土地はスキップ
    if (land.useSpecialLand) continue;

    // specialUse の設定がある土地のみ（適用可能だが未適用のケース）
    if (!land.specialUse) continue;

    const { reductionRate, applicableArea, maxArea } = land.specialUse;
    const actualApplicableArea = Math.min(applicableArea, maxArea, land.area);

    // 土地の基本評価額を概算（路線価方式 or 倍率方式）
    let baseValue: number;
    if (land.evaluationMethod === 'rosenka') {
      baseValue = Math.floor(land.rosenkaPrice * land.area);
    } else {
      baseValue = Math.floor(land.fixedAssetTaxValue * land.multiplier);
    }

    const reductionRatio = actualApplicableArea / land.area;
    const reduction = Math.floor(baseValue * reductionRatio * reductionRate);
    totalPotentialReduction += reduction;
    eligibleLands.push(land.location || land.id);
  }

  const saving = Math.floor(totalPotentialReduction * marginalRate);

  if (eligibleLands.length === 0) {
    return {
      strategyId,
      type: 'small_land_special',
      label,
      saving: 0,
      detail: '適用可能な未適用土地なし',
    };
  }

  return {
    strategyId,
    type: 'small_land_special',
    label,
    saving: Math.max(0, saving),
    detail: `対象地: ${eligibleLands.join('、')}、評価減 ${formatYen(totalPotentialReduction)}`,
  };
}

/**
 * 配偶者控除最大活用
 *
 * 配偶者が法定相続分または1.6億円のいずれか大きい額まで非課税。
 * 現在の分割案と比較して追加の控除余地を算出する。
 */
function calculateSpouseDeductionSaving(
  caseData: Case,
  originalResult: TaxCalculationResult,
  strategyId: string,
  label: string
): StrategyResult {
  const { heirs } = caseData;

  // 配偶者を探す
  const spouseDetail = originalResult.heirTaxDetails.find(d => {
    const heir = heirs.find(h => h.id === d.heirId);
    return heir?.relationship === 'spouse';
  });

  if (!spouseDetail) {
    return {
      strategyId,
      type: 'spouse_deduction',
      label,
      saving: 0,
      detail: '配偶者が相続人にいないため適用不可',
    };
  }

  // 配偶者の現在の税額（控除適用後）
  // もし既に finalTax = 0 ならさらなる節税はない
  // ただし、配偶者の取得額を増やして他の相続人の負担を減らす余地がある

  // 配偶者控除は配偶者自身の税額を減らすもの
  // 配偶者が既に全額控除されている場合 (finalTax === 0) でも
  // 取得割合を変えることで全体の節税になる可能性がある
  // ただし簡易計算ではこの効果のみ評価

  const saving = spouseDetail.finalTax;

  if (saving === 0) {
    return {
      strategyId,
      type: 'spouse_deduction',
      label,
      saving: 0,
      detail: '配偶者控除は既に最大限活用済み',
    };
  }

  return {
    strategyId,
    type: 'spouse_deduction',
    label,
    saving,
    detail: `配偶者の取得額を法定相続分または1.6億円以内に調整することで配偶者税額 ${formatYen(saving)} を削減可能`,
  };
}

// --- ユーティリティ ---

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

/**
 * 金額を日本円表記にフォーマット
 */
function formatYen(amount: number): string {
  if (amount >= 100_000_000) {
    return `${(amount / 100_000_000).toFixed(1)}億円`;
  }
  if (amount >= 10_000) {
    return `${Math.floor(amount / 10_000)}万円`;
  }
  return `${amount}円`;
}
