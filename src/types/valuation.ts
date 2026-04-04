export interface ValuationResult {
  /** 最終評価額（円、文字列表現） */
  assessedValue: string;
  breakdown: ValuationBreakdown;
}

export type ValuationBreakdown =
  | DeathInsuranceBreakdown
  | AnnuityThreeWayBreakdown
  | PerpetualAnnuityBreakdown
  | PreEventAnnuityBreakdown
  | ContractRightsBreakdown
  | HospitalizationBenefitBreakdown;

export interface DeathInsuranceBreakdown {
  type: 'death_insurance';
  /** 受取保険金総額 */
  grossAmount: string;
  /** 非課税限度額 (500万円 × 法定相続人数) */
  nonTaxableLimit: string;
  /** 課税価格 */
  taxableAmount: string;
}

export interface AnnuityThreeWayBreakdown {
  type: 'annuity_three_way';
  /** 解約返戻金相当額 */
  surrenderValue: string | null;
  /** 一時金相当額 */
  lumpSumAmount: string | null;
  /** 年額 × 複利年金現価率 */
  presentValueCalc: string | null;
  /** 3つのうち最大の値 */
  selectedMax: string;
}

export interface PerpetualAnnuityBreakdown {
  type: 'perpetual_annuity';
  /** 年間給付額 */
  annualAmount: string;
  /** 予定利率 */
  assumedRate: string;
  /** 年額 ÷ 予定利率 */
  calculatedValue: string;
}

export interface PreEventAnnuityBreakdown {
  type: 'pre_event_annuity';
  /** 払込保険料総額 */
  totalPremiumsPaid: string;
}

export interface ContractRightsBreakdown {
  type: 'contract_rights';
  /** 解約返戻金相当額 */
  surrenderValue: string;
}

export interface HospitalizationBenefitBreakdown {
  type: 'hospitalization_benefit';
  /** 支払金額 */
  paidOutAmount: string;
  /** 受取人の種別 */
  beneficiaryType: 'decedent' | 'heir';
  /** 相続税の課税対象かどうか */
  isTaxable: boolean;
}
