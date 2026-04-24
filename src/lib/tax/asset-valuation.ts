// 財産評価計算

import type {
  LandAsset,
  BuildingAsset,
  BuildingRoom,
  RoomOccupancy,
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
 * linkedBuilding: 紐づく建物（貸家建付地の減額計算用）
 * referenceDate: 基準日（賃貸割合計算用）
 */
export function calculateLandValue(
  land: LandAsset,
  linkedBuilding?: BuildingAsset,
  referenceDate?: string
): number {
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

  // 貸家建付地の減額（紐づく建物が貸家の場合）
  if (linkedBuilding && linkedBuilding.rentalReduction &&
      (land.usage === '貸家建付地' || land.usage === '貸家')) {
    const borrowingRight = land.borrowingRightRatio || 0.6;
    const borrowedHouseRatio = linkedBuilding.borrowedHouseRatio || 0.3;
    const rentalRatio = calculateBuildingRentalRatio(linkedBuilding, referenceDate);
    const reduction = baseValue * borrowingRight * borrowedHouseRatio * rentalRatio;
    baseValue = Math.floor(baseValue - reduction);
  }

  return Math.max(0, baseValue);
}

/** 建物の賃貸割合を計算（基準日月の入居率） */
function calculateBuildingRentalRatio(building: BuildingAsset, referenceDate?: string): number {
  const rooms = building.rooms || [];
  if (rooms.length === 0) return 1;
  const totalArea = rooms.reduce((s, r) => s + (r.area || 0), 0);
  if (totalArea === 0) return 1;

  const refMonth = referenceDate ? new Date(referenceDate).getMonth() : new Date().getMonth();
  const monthKeys = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'] as const;
  const key = monthKeys[refMonth];

  const rentedArea = rooms.reduce((s, r) => {
    return s + (r.occupancy?.[key] ? (r.area || 0) : 0);
  }, 0);
  return rentedArea / totalArea;
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
  benefits: RetirementBenefit[] | undefined,
  legalHeirCount: number
): { totalAmount: number; exemption: number; taxableAmount: number } {
  const safeBenefits = benefits || [];
  const totalAmount = safeBenefits.reduce((sum, b) => sum + b.amount, 0);
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
