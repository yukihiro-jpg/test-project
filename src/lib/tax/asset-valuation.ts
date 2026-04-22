// 財産評価計算

import type {
  LandAsset,
  BuildingAsset,
  CashDepositAsset,
  ListedStockAsset,
  UnlistedStockAsset,
  InsuranceAsset,
  RetirementBenefit,
  OtherAsset,
  FuneralExpense,
} from '@/types';
import { RETIREMENT_EXEMPTION_PER_HEIR } from './tax-tables';

/**
 * 土地の評価額を計算
 */
export function calculateLandValue(land: LandAsset): number {
  let baseValue: number;

  if (land.evaluationMethod === 'rosenka') {
    // 路線価方式: 路線価 × 各種補正率 × 地積
    let correctedPrice = land.rosenkaPrice;
    const shape = land.landShape;

    if (shape) {
      // 奥行価格補正
      correctedPrice *= shape.depthCorrection || 1;

      // 不整形地補正
      if (shape.irregularShape && shape.irregularCorrection) {
        correctedPrice *= shape.irregularCorrection;
      }

      // 側方路線影響加算
      if (shape.sideRoad && shape.sideRoadCorrection) {
        correctedPrice *= (1 + shape.sideRoadCorrection);
      }

      // 二方路線影響加算
      if (shape.twoRoads && shape.twoRoadsCorrection) {
        correctedPrice *= (1 + shape.twoRoadsCorrection);
      }
    }

    let effectiveArea = land.area;

    // セットバック部分の控除
    if (land.landShape?.setback) {
      effectiveArea -= land.landShape.setback;
    }

    baseValue = Math.floor(correctedPrice * effectiveArea);

    // 借地権割合の適用
    if (land.landShape?.borrowedLandRatio) {
      baseValue = Math.floor(baseValue * land.landShape.borrowedLandRatio);
    }
  } else {
    // 倍率方式: 固定資産税評価額 × 倍率
    baseValue = Math.floor(land.fixedAssetTaxValue * land.multiplier);
  }

  // 小規模宅地等の特例
  if (land.useSpecialLand && land.specialUse) {
    const { reductionRate, applicableArea, maxArea } = land.specialUse;
    const actualApplicableArea = Math.min(applicableArea, maxArea, land.area);
    const reductionRatio = actualApplicableArea / land.area;
    const reduction = Math.floor(baseValue * reductionRatio * reductionRate);
    baseValue -= reduction;
  }

  return Math.max(0, baseValue);
}

/**
 * 建物の評価額を計算
 */
export function calculateBuildingValue(building: BuildingAsset): number {
  let value = building.fixedAssetTaxValue;
  if (building.rentalReduction) {
    // 貸家: 固定資産税評価額 × (1 - 借家権割合)
    value = Math.floor(value * (1 - building.borrowedHouseRatio));
  }
  return value;
}

/**
 * 現金預金の評価額を計算
 */
export function calculateCashValue(cash: CashDepositAsset): number {
  return cash.balance + cash.accruedInterest;
}

/**
 * 上場株式の評価額を計算（4つの価格のうち最低額を選択）
 */
export function calculateListedStockValue(stock: ListedStockAsset): { selectedPrice: number; totalValue: number } {
  const prices = [
    stock.deathDatePrice,
    stock.monthlyAvgDeath,
    stock.monthlyAvgPrev1,
    stock.monthlyAvgPrev2,
  ].filter(p => p > 0);

  if (prices.length === 0) return { selectedPrice: 0, totalValue: 0 };

  const selectedPrice = Math.min(...prices);
  return {
    selectedPrice,
    totalValue: Math.floor(selectedPrice * stock.shares),
  };
}

/**
 * 非上場株式の評価額を計算
 */
export function calculateUnlistedStockValue(stock: UnlistedStockAsset): number {
  return Math.floor(stock.sharesOwned * stock.pricePerShare);
}

/**
 * その他財産の評価額を計算
 */
export function calculateOtherAssetValue(asset: OtherAsset): number {
  return Math.floor(asset.quantity * asset.unitPrice);
}

/**
 * 保険金の非課税枠を計算
 */
export function calculateInsuranceExemption(
  insurances: InsuranceAsset[],
  legalHeirCount: number
): { totalAmount: number; exemption: number; taxableAmount: number } {
  const totalAmount = insurances
    .filter(i => i.isDeathBenefit)
    .reduce((sum, i) => sum + i.amount, 0);
  const exemption = Math.min(totalAmount, 5_000_000 * legalHeirCount);
  return {
    totalAmount,
    exemption,
    taxableAmount: Math.max(0, totalAmount - exemption),
  };
}

/**
 * 退職金の非課税枠を計算
 */
export function calculateRetirementExemption(
  benefits: RetirementBenefit[],
  legalHeirCount: number
): { totalAmount: number; exemption: number; taxableAmount: number } {
  const totalAmount = benefits.reduce((sum, b) => sum + b.amount, 0);
  const exemption = Math.min(totalAmount, RETIREMENT_EXEMPTION_PER_HEIR * legalHeirCount);
  return {
    totalAmount,
    exemption,
    taxableAmount: Math.max(0, totalAmount - exemption),
  };
}

/**
 * 葬式費用の控除対象合計を計算
 */
export function calculateDeductibleFuneralExpenses(expenses: FuneralExpense[]): number {
  return expenses
    .filter(e => e.isDeductible)
    .reduce((sum, e) => sum + e.amount, 0);
}
