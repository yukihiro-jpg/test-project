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
