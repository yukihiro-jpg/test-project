import { describe, it, expect } from 'vitest';
import { calculate } from '@/lib/valuator';
import { AssetCategory } from '@/types/asset';
import type { DecedentInfo } from '@/types/decedent';
import type { ExtractedInsuranceData } from '@/types/extracted';

const decedent: DecedentInfo = {
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
    ...overrides,
  };
}

describe('valuator - 評価額計算', () => {
  describe('死亡保険金', () => {
    it('非課税枠を差し引いた課税価格を計算する', () => {
      const extracted = makeExtracted({ paidOutAmount: 30000000 });
      const result = calculate(extracted, AssetCategory.DEATH_INSURANCE_PROCEEDS, decedent);

      expect(result.breakdown.type).toBe('death_insurance');
      if (result.breakdown.type === 'death_insurance') {
        expect(result.breakdown.grossAmount).toBe('30000000');
        // 500万 × 3人 = 1500万
        expect(result.breakdown.nonTaxableLimit).toBe('15000000');
        // 3000万 - 1500万 = 1500万
        expect(result.breakdown.taxableAmount).toBe('15000000');
      }
      expect(result.assessedValue).toBe('15000000');
    });

    it('受取額が非課税枠以下の場合は課税額0', () => {
      const extracted = makeExtracted({ paidOutAmount: 10000000 });
      const result = calculate(extracted, AssetCategory.DEATH_INSURANCE_PROCEEDS, decedent);

      expect(result.assessedValue).toBe('0');
    });

    it('1億円以上の大きな金額でも精度を保つ', () => {
      const extracted = makeExtracted({ paidOutAmount: 200000000 });
      const result = calculate(extracted, AssetCategory.DEATH_INSURANCE_PROCEEDS, decedent);

      // 2億 - 1500万 = 1億8500万
      expect(result.assessedValue).toBe('185000000');
    });
  });

  describe('無期定期金', () => {
    it('年額 ÷ 予定利率 を計算する', () => {
      const extracted = makeExtracted({
        annualAnnuityAmount: 1200000,
        assumedInterestRate: 0.02,
      });
      const result = calculate(extracted, AssetCategory.PERPETUAL_ANNUITY, decedent);

      // 120万 ÷ 0.02 = 6000万
      expect(result.assessedValue).toBe('60000000');
    });

    it('予定利率が0の場合は評価額0', () => {
      const extracted = makeExtracted({
        annualAnnuityAmount: 1200000,
        assumedInterestRate: 0,
      });
      const result = calculate(extracted, AssetCategory.PERPETUAL_ANNUITY, decedent);
      expect(result.assessedValue).toBe('0');
    });
  });

  describe('給付事由未発生', () => {
    it('払込保険料総額をそのまま返す', () => {
      const extracted = makeExtracted({ totalPremiumsPaid: 5000000 });
      const result = calculate(extracted, AssetCategory.PRE_EVENT_ANNUITY, decedent);

      expect(result.assessedValue).toBe('5000000');
      expect(result.breakdown.type).toBe('pre_event_annuity');
    });
  });

  describe('生命保険契約に関する権利', () => {
    it('解約返戻金をそのまま返す', () => {
      const extracted = makeExtracted({ surrenderValue: 3500000 });
      const result = calculate(
        extracted,
        AssetCategory.LIFE_INSURANCE_CONTRACT_RIGHTS,
        decedent,
      );

      expect(result.assessedValue).toBe('3500000');
      expect(result.breakdown.type).toBe('contract_rights');
    });
  });

  describe('損害保険契約に関する権利', () => {
    it('解約返戻金をそのまま返す', () => {
      const extracted = makeExtracted({ surrenderValue: 800000 });
      const result = calculate(
        extracted,
        AssetCategory.NON_LIFE_INSURANCE_CONTRACT_RIGHTS,
        decedent,
      );

      expect(result.assessedValue).toBe('800000');
    });
  });

  describe('有期定期金（三方最大値）', () => {
    it('3つの値の最大値を評価額とする', () => {
      const extracted = makeExtracted({
        annualAnnuityAmount: 1200000,
        annuityPaymentPeriodYears: 10,
        surrenderValue: 8000000,
        lumpSumOptionAmount: 9000000,
        assumedInterestRate: 0.015,
      });
      const result = calculate(extracted, AssetCategory.FIXED_TERM_ANNUITY, decedent);

      expect(result.breakdown.type).toBe('annuity_three_way');
      // 解約返戻金 800万, 一時金 900万, PV計算値 ≈ 120万 × 9.2222 ≈ 1106.6万
      // 最大は PV計算値 ≈ 1106万
      const assessed = parseInt(result.assessedValue);
      expect(assessed).toBeGreaterThan(9000000);
    });
  });
});
