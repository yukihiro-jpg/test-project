import type { ExtractedInsuranceData } from './extracted';
import type { ValuationResult } from './valuation';

export enum AssetCategory {
  /** 1. 生命保険金等（死亡保険金）- 相続税法第3条1項1号 */
  DEATH_INSURANCE_PROCEEDS = 'DEATH_INSURANCE_PROCEEDS',
  /** 2. 有期定期金 - 相続税法第3条1項3号 */
  FIXED_TERM_ANNUITY = 'FIXED_TERM_ANNUITY',
  /** 3. 無期定期金 - 相続税法第3条1項3号 */
  PERPETUAL_ANNUITY = 'PERPETUAL_ANNUITY',
  /** 4. 終身定期金 - 相続税法第3条1項3号 */
  LIFETIME_ANNUITY = 'LIFETIME_ANNUITY',
  /** 5. 定期金（給付事由未発生）- 相続税法第3条1項4号 */
  PRE_EVENT_ANNUITY = 'PRE_EVENT_ANNUITY',
  /** 6. 保証期間付定期金 - 相続税法第3条1項5号 */
  GUARANTEED_PERIOD_ANNUITY = 'GUARANTEED_PERIOD_ANNUITY',
  /** 7. 契約に基づかない定期金 - 相続税法第3条1項6号 */
  NON_CONTRACTUAL_ANNUITY = 'NON_CONTRACTUAL_ANNUITY',
  /** 8. 生命保険契約に関する権利 */
  LIFE_INSURANCE_CONTRACT_RIGHTS = 'LIFE_INSURANCE_CONTRACT_RIGHTS',
  /** 9. 損害保険契約に関する権利 */
  NON_LIFE_INSURANCE_CONTRACT_RIGHTS = 'NON_LIFE_INSURANCE_CONTRACT_RIGHTS',
  /** 10. 入院給付金等（受取人=被相続人）- 本来の相続財産 */
  HOSPITALIZATION_BENEFITS_DECEDENT = 'HOSPITALIZATION_BENEFITS_DECEDENT',
  /** 11. 入院給付金等（受取人=相続人）- 相続税対象外 */
  HOSPITALIZATION_BENEFITS_HEIR = 'HOSPITALIZATION_BENEFITS_HEIR',
}

export interface ClassifiedAsset {
  id: string;
  extracted: ExtractedInsuranceData;
  category: AssetCategory;
  /** 自動分類か手動修正か */
  categoryConfidence: 'auto' | 'manual';
  valuation: ValuationResult;
  fileName: string;
}
