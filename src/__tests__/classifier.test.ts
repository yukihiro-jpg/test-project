import { describe, it, expect } from 'vitest';
import { classify } from '@/lib/classifier';
import { AssetCategory } from '@/types/asset';
import type { DecedentInfo } from '@/types/decedent';
import type { ExtractedInsuranceData } from '@/types/extracted';

const baseDecedent: DecedentInfo = {
  name: '山田太郎',
  dateOfDeath: '2024-01-15',
  contractHolder: '山田太郎',
  insuredPerson: '山田太郎',
  numberOfLegalHeirs: 3,
};

function makeExtracted(overrides: Partial<ExtractedInsuranceData>): ExtractedInsuranceData {
  return {
    insuranceCompanyName: 'テスト生命',
    policyNumber: '12345',
    contractHolder: '山田太郎',
    insuredPerson: '山田太郎',
    beneficiary: '山田花子',
    insuranceType: '終身保険',
    isLifeInsurance: true,
    isAnnuity: false,
    deathBenefitAmount: null,
    maturityBenefitAmount: null,
    annualAnnuityAmount: null,
    annuityPaymentPeriodYears: null,
    annuityStartDate: null,
    hasAnnuityPaymentStarted: null,
    guaranteePeriodYears: null,
    contractDate: '2010-04-01',
    maturityDate: null,
    totalPremiumsPaid: null,
    surrenderValue: null,
    lumpSumOptionAmount: null,
    assumedInterestRate: null,
    paidOutAmount: null,
    paymentReason: null,
    documentType: '保険証券',
    rawNotes: null,
    insuranceProceedsType: null,
    isMedicalBenefit: false,
    isBeneficiaryInsuredPerson: null,
    ...overrides,
  };
}

describe('classify - 資産区分の自動判��', () => {
  describe('1. 生命保険金等（死亡保険金）', () => {
    it('被保険者=被相続人 AND 死亡による支払い', () => {
      const extracted = makeExtracted({
        insuredPerson: '山田太郎',
        deathBenefitAmount: 30000000,
        paidOutAmount: 30000000,
        paymentReason: '死亡',
      });
      expect(classify(extracted, baseDecedent)).toBe(
        AssetCategory.DEATH_INSURANCE_PROCEEDS,
      );
    });

    it('全角スペースを含む氏名でもマッチする', () => {
      const extracted = makeExtracted({
        insuredPerson: '山田　太郎',
        paidOutAmount: 10000000,
        paymentReason: '死亡',
      });
      expect(classify(extracted, baseDecedent)).toBe(
        AssetCategory.DEATH_INSURANCE_PROCEEDS,
      );
    });
  });

  describe('2. 有期定期金', () => {
    it('年金保険・給付事由発生済み・支払期間あり', () => {
      const extracted = makeExtracted({
        isAnnuity: true,
        hasAnnuityPaymentStarted: true,
        annuityPaymentPeriodYears: 10,
        annualAnnuityAmount: 1200000,
      });
      expect(classify(extracted, baseDecedent)).toBe(
        AssetCategory.FIXED_TERM_ANNUITY,
      );
    });
  });

  describe('3. 無期定期金', () => {
    it('年金保険・給付事由発生済み・終身でも有期でもない', () => {
      const extracted = makeExtracted({
        isAnnuity: true,
        hasAnnuityPaymentStarted: true,
        insuranceType: '個人年金保険',
        annualAnnuityAmount: 600000,
      });
      expect(classify(extracted, baseDecedent)).toBe(
        AssetCategory.PERPETUAL_ANNUITY,
      );
    });
  });

  describe('4. 終身定期金', () => {
    it('年金保険・給付事由発生済み・終身型', () => {
      const extracted = makeExtracted({
        isAnnuity: true,
        hasAnnuityPaymentStarted: true,
        insuranceType: '終身年金保険',
        annualAnnuityAmount: 1000000,
      });
      expect(classify(extracted, baseDecedent)).toBe(
        AssetCategory.LIFETIME_ANNUITY,
      );
    });
  });

  describe('5. 定期金（給付事由未発生）', () => {
    it('年金保険・給付事由未発生・契約者=被相続人', () => {
      const extracted = makeExtracted({
        isAnnuity: true,
        hasAnnuityPaymentStarted: false,
        contractHolder: '山田太郎',
        totalPremiumsPaid: 5000000,
      });
      expect(classify(extracted, baseDecedent)).toBe(
        AssetCategory.PRE_EVENT_ANNUITY,
      );
    });
  });

  describe('6. 保証期間付定期金', () => {
    it('年金保険・給付事由発生済み・保証期間あり', () => {
      const extracted = makeExtracted({
        isAnnuity: true,
        hasAnnuityPaymentStarted: true,
        guaranteePeriodYears: 15,
        annualAnnuityAmount: 1200000,
      });
      expect(classify(extracted, baseDecedent)).toBe(
        AssetCategory.GUARANTEED_PERIOD_ANNUITY,
      );
    });
  });

  describe('8. 生命保険契約に関する権利', () => {
    it('契約者=被相続人、被保険者≠被相続人、生命保険', () => {
      const extracted = makeExtracted({
        contractHolder: '山田太郎',
        insuredPerson: '山田花子',
        isLifeInsurance: true,
        surrenderValue: 3000000,
      });
      expect(classify(extracted, baseDecedent)).toBe(
        AssetCategory.LIFE_INSURANCE_CONTRACT_RIGHTS,
      );
    });
  });

  describe('9. 損害保険契約に関する権利', () => {
    it('契約者=被相続人、被保険者≠被相続人、損害保険', () => {
      const extracted = makeExtracted({
        contractHolder: '山田太郎',
        insuredPerson: '山田花子',
        isLifeInsurance: false,
        insuranceType: '火災保険',
        surrenderValue: 500000,
      });
      expect(classify(extracted, baseDecedent)).toBe(
        AssetCategory.NON_LIFE_INSURANCE_CONTRACT_RIGHTS,
      );
    });
  });

  describe('10. 入院給付金等（受取人=被相続人）', () => {
    it('isMedicalBenefitフラグで判定、受取人=被相続人', () => {
      const extracted = makeExtracted({
        isMedicalBenefit: true,
        paymentReason: '入院',
        paidOutAmount: 300000,
        beneficiary: '山田太郎',
        isBeneficiaryInsuredPerson: true,
      });
      expect(classify(extracted, baseDecedent)).toBe(
        AssetCategory.HOSPITALIZATION_BENEFITS_DECEDENT,
      );
    });

    it('paymentReasonに「手術」を含む場合も医療系と判定', () => {
      const extracted = makeExtracted({
        isMedicalBenefit: false,
        paymentReason: '手術給付',
        paidOutAmount: 200000,
        beneficiary: '山田太郎',
      });
      expect(classify(extracted, baseDecedent)).toBe(
        AssetCategory.HOSPITALIZATION_BENEFITS_DECEDENT,
      );
    });

    it('全角スペースを含む受取人名でもマッチする', () => {
      const extracted = makeExtracted({
        isMedicalBenefit: true,
        paymentReason: '通院',
        paidOutAmount: 50000,
        beneficiary: '山田　太郎',
      });
      expect(classify(extracted, baseDecedent)).toBe(
        AssetCategory.HOSPITALIZATION_BENEFITS_DECEDENT,
      );
    });

    it('受取人がnullで被保険者=被相続人の場合は本人受取とみなす', () => {
      const extracted = makeExtracted({
        isMedicalBenefit: true,
        insuredPerson: '山田太郎',
        beneficiary: null,
        paidOutAmount: 100000,
      });
      expect(classify(extracted, baseDecedent)).toBe(
        AssetCategory.HOSPITALIZATION_BENEFITS_DECEDENT,
      );
    });
  });

  describe('11. 入院給付金等（受取人=相���人）', () => {
    it('医療系給付金で受取人が相続人の場合', () => {
      const extracted = makeExtracted({
        isMedicalBenefit: true,
        paymentReason: '入院',
        paidOutAmount: 300000,
        beneficiary: '山田花子',
        isBeneficiaryInsuredPerson: false,
      });
      expect(classify(extracted, baseDecedent)).toBe(
        AssetCategory.HOSPITALIZATION_BENEFITS_HEIR,
      );
    });

    it('insuranceProceedsTypeで判定', () => {
      const extracted = makeExtracted({
        isMedicalBenefit: false,
        insuranceProceedsType: '高度障害',
        paidOutAmount: 5000000,
        beneficiary: '山田花子',
      });
      expect(classify(extracted, baseDecedent)).toBe(
        AssetCategory.HOSPITALIZATION_BENEFITS_HEIR,
      );
    });
  });

  describe('医療系給付金は死亡保険金より優先される', () => {
    it('isMedicalBenefit=trueの場合、死亡保険金フラグがあっても入院給付金として分類', () => {
      const extracted = makeExtracted({
        isMedicalBenefit: true,
        paymentReason: '入院',
        paidOutAmount: 500000,
        deathBenefitAmount: null,
        beneficiary: '山田太郎',
      });
      expect(classify(extracted, baseDecedent)).toBe(
        AssetCategory.HOSPITALIZATION_BENEFITS_DECEDENT,
      );
    });
  });
});
