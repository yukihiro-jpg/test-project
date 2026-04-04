import Decimal from 'decimal.js';
import { AssetCategory } from '@/types/asset';

/** 死亡保険金の非課税枠: 1人あたり500万円 */
export const NON_TAXABLE_PER_HEIR = new Decimal(5_000_000);

/** 資産区分の日本語ラベル */
export const ASSET_CATEGORY_LABELS: Record<AssetCategory, string> = {
  [AssetCategory.DEATH_INSURANCE_PROCEEDS]: '生命保険金等（死亡保険金）',
  [AssetCategory.FIXED_TERM_ANNUITY]: '有期定期金',
  [AssetCategory.PERPETUAL_ANNUITY]: '無期定期金',
  [AssetCategory.LIFETIME_ANNUITY]: '終身定期金',
  [AssetCategory.PRE_EVENT_ANNUITY]: '定期金に関する権利（給付事由未発生）',
  [AssetCategory.GUARANTEED_PERIOD_ANNUITY]: '保証期間付定期金に関する権利',
  [AssetCategory.NON_CONTRACTUAL_ANNUITY]: '契約に基づかない定期金に関する権利',
  [AssetCategory.LIFE_INSURANCE_CONTRACT_RIGHTS]: '生命保険契約に関する権利',
  [AssetCategory.NON_LIFE_INSURANCE_CONTRACT_RIGHTS]: '損害保険契約に関する権利',
};

/** 資産区分の法的根拠 */
export const ASSET_CATEGORY_LAW_REFS: Record<AssetCategory, string> = {
  [AssetCategory.DEATH_INSURANCE_PROCEEDS]: '相続税法第3条第1項第1号',
  [AssetCategory.FIXED_TERM_ANNUITY]: '相続税法第3条第1項第3号',
  [AssetCategory.PERPETUAL_ANNUITY]: '相続税法第3条第1項第3号',
  [AssetCategory.LIFETIME_ANNUITY]: '相続税法第3条第1項第3号',
  [AssetCategory.PRE_EVENT_ANNUITY]: '相続税法第3条第1項第4号',
  [AssetCategory.GUARANTEED_PERIOD_ANNUITY]: '相続税法第3条第1項第5号',
  [AssetCategory.NON_CONTRACTUAL_ANNUITY]: '相続税法第3条第1項第6号',
  [AssetCategory.LIFE_INSURANCE_CONTRACT_RIGHTS]: '相続税法第26条',
  [AssetCategory.NON_LIFE_INSURANCE_CONTRACT_RIGHTS]: '相続税法第26条',
};

/**
 * 有期定期金の残存期間に応じた割合
 * 財産評価基本通達に基づく
 */
export function remainingYearsRatio(years: number): Decimal {
  if (years <= 5) return new Decimal('0.70');
  if (years <= 10) return new Decimal('0.80');
  if (years <= 15) return new Decimal('0.85');
  if (years <= 25) return new Decimal('0.90');
  if (years <= 35) return new Decimal('0.95');
  return new Decimal('1.00');
}
