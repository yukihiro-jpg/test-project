export interface ExtractedInsuranceData {
  /** 保険会社名 */
  insuranceCompanyName: string;
  /** 証券番号 */
  policyNumber: string;
  /** 契約者氏名 */
  contractHolder: string;
  /** 被保険者氏名 */
  insuredPerson: string;
  /** 受取人氏名 */
  beneficiary: string | null;
  /** 保険種類 (例: 終身保険, 定期保険, 養老保険, 個人年金保険, 損害保険) */
  insuranceType: string;
  /** 生命保険かどうか */
  isLifeInsurance: boolean;
  /** 年金保険かどうか */
  isAnnuity: boolean;
  /** 死亡保険金額 */
  deathBenefitAmount: number | null;
  /** 満期保険金額 */
  maturityBenefitAmount: number | null;
  /** 年金年額 */
  annualAnnuityAmount: number | null;
  /** 年金支払期間（年数） */
  annuityPaymentPeriodYears: number | null;
  /** 年金支払開始日 (YYYY-MM-DD) */
  annuityStartDate: string | null;
  /** 年金支払開始済みか */
  hasAnnuityPaymentStarted: boolean | null;
  /** 保証期間（年数） */
  guaranteePeriodYears: number | null;
  /** 契約日 (YYYY-MM-DD) */
  contractDate: string;
  /** 満期日 (YYYY-MM-DD) */
  maturityDate: string | null;
  /** 払込保険料総額 */
  totalPremiumsPaid: number | null;
  /** 解約返戻金額 */
  surrenderValue: number | null;
  /** 一時金受取可能額 */
  lumpSumOptionAmount: number | null;
  /** 予定利率 (例: 0.015 = 1.5%) */
  assumedInterestRate: number | null;
  /** 実際に支払われた金額 */
  paidOutAmount: number | null;
  /** 支払事由 (例: '死亡', '満期', '年金') */
  paymentReason: string | null;
  /** 書類種類 */
  documentType: '保険証券' | '支払通知書' | 'その他';
  /** その他特記事項 */
  rawNotes: string | null;
  /** 給付金の種類 ('死亡' | '入院' | '手術' | '通院' | '高度障害' | '満期' | '年金' | 'その他') */
  insuranceProceedsType: string | null;
  /** 入院給付金・手術給付金・通院給付金等の医療系給付金かどうか */
  isMedicalBenefit: boolean;
  /** 受取人が被保険者本人として指定されているか */
  isBeneficiaryInsuredPerson: boolean | null;
}
