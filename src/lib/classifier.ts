import { AssetCategory } from '@/types/asset';
import type { DecedentInfo } from '@/types/decedent';
import type { ExtractedInsuranceData } from '@/types/extracted';

/**
 * 氏名の正規化（全角/半角スペース除去、全角→半角変換）
 */
function normalizeName(name: string): string {
  return name
    .replace(/[\s\u3000]+/g, '')
    .normalize('NFKC')
    .toLowerCase();
}

/**
 * 2つの氏名が一致するか判定
 */
function namesMatch(a: string, b: string): boolean {
  return normalizeName(a) === normalizeName(b);
}

/**
 * 抽出データと被相続人情報から保険資産区分を自動判定する
 *
 * 決定木（上から順に判定、最初に一致した区分を採用）
 */
export function classify(
  extracted: ExtractedInsuranceData,
  decedent: DecedentInfo,
): AssetCategory {
  const decedentIsInsured = namesMatch(
    extracted.insuredPerson,
    decedent.name,
  );
  const decedentIsContractHolder = namesMatch(
    extracted.contractHolder,
    decedent.contractHolder,
  );

  // 0. 入院給付金等の医療系給付金: 受取人により取扱いが異なる
  if (isMedicalBenefitPayment(extracted)) {
    const beneficiaryIsDecedent = isBeneficiaryDecedent(extracted, decedent);
    if (beneficiaryIsDecedent) {
      return AssetCategory.HOSPITALIZATION_BENEFITS_DECEDENT;
    }
    return AssetCategory.HOSPITALIZATION_BENEFITS_HEIR;
  }

  // 1. 死亡保険金: 被保険者=被相続人 AND 死亡による支払い
  const isDeathPayout =
    extracted.paymentReason?.includes('死亡') ||
    (extracted.paidOutAmount !== null && extracted.deathBenefitAmount !== null);

  if (decedentIsInsured && isDeathPayout) {
    return AssetCategory.DEATH_INSURANCE_PROCEEDS;
  }

  // 2. 年金保険の場合
  if (extracted.isAnnuity) {
    if (extracted.hasAnnuityPaymentStarted) {
      // 給付事由発生済み
      if (
        extracted.guaranteePeriodYears !== null &&
        extracted.guaranteePeriodYears > 0
      ) {
        return AssetCategory.GUARANTEED_PERIOD_ANNUITY;
      }
      if (
        extracted.annuityPaymentPeriodYears !== null &&
        extracted.annuityPaymentPeriodYears > 0
      ) {
        return AssetCategory.FIXED_TERM_ANNUITY;
      }
      if (
        extracted.insuranceType.includes('終身')
      ) {
        return AssetCategory.LIFETIME_ANNUITY;
      }
      return AssetCategory.PERPETUAL_ANNUITY;
    }

    // 給付事由未発生
    if (decedentIsContractHolder) {
      return AssetCategory.PRE_EVENT_ANNUITY;
    }
  }

  // 3. 契約者=被相続人 AND 被保険者≠被相続人（保険事故未発生）
  if (decedentIsContractHolder && !decedentIsInsured) {
    if (extracted.isLifeInsurance) {
      return AssetCategory.LIFE_INSURANCE_CONTRACT_RIGHTS;
    }
    return AssetCategory.NON_LIFE_INSURANCE_CONTRACT_RIGHTS;
  }

  // 4. フォールバック
  return AssetCategory.NON_CONTRACTUAL_ANNUITY;
}

const MEDICAL_PAYMENT_REASONS = ['入院', '手術', '通院', '高度障害', '先進医療'];

/**
 * 医療系給付金の支払いかどうかを判定
 */
function isMedicalBenefitPayment(extracted: ExtractedInsuranceData): boolean {
  if (extracted.isMedicalBenefit) return true;
  if (extracted.insuranceProceedsType !== null) {
    return MEDICAL_PAYMENT_REASONS.some((r) =>
      extracted.insuranceProceedsType!.includes(r),
    );
  }
  if (extracted.paymentReason !== null) {
    return MEDICAL_PAYMENT_REASONS.some((r) =>
      extracted.paymentReason!.includes(r),
    );
  }
  return false;
}

/**
 * 受取人が被相続人（被保険者本人）かどうかを判定
 * - isBeneficiaryInsuredPerson フラグがある場合はそれを使用
 * - なければ beneficiary と被相続人名を比較
 * - 受取人情報がない場合は被保険者=被相続人なら本人受取とみなす
 */
function isBeneficiaryDecedent(
  extracted: ExtractedInsuranceData,
  decedent: DecedentInfo,
): boolean {
  if (extracted.isBeneficiaryInsuredPerson !== null) {
    return extracted.isBeneficiaryInsuredPerson;
  }
  if (extracted.beneficiary !== null) {
    return namesMatch(extracted.beneficiary, decedent.name);
  }
  // 入院給付金等は通常、被保険者本人が受取人
  return namesMatch(extracted.insuredPerson, decedent.name);
}
