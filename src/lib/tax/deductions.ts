// 各種控除計算

import type { Heir, RelationshipType } from '@/types';
import { calculateAge } from '@/lib/dates/wareki';
import {
  SPOUSE_DEDUCTION_LIMIT,
  MINOR_DEDUCTION_PER_YEAR,
  MINOR_AGE_LIMIT,
  DISABILITY_DEDUCTION_GENERAL_PER_YEAR,
  DISABILITY_DEDUCTION_SPECIAL_PER_YEAR,
  DISABILITY_AGE_LIMIT,
} from './tax-tables';

/**
 * 法定相続人の数を計算（養子の数の制限を適用）
 */
export function countLegalHeirs(heirs: Heir[]): number {
  const hasRealChild = heirs.some(h => h.relationship === 'child' || h.relationship === 'grandchild_proxy');
  const adoptedCount = heirs.filter(h => h.relationship === 'adopted').length;

  // 養子の数の制限：実子がいる場合1人、いない場合2人まで
  const maxAdopted = hasRealChild ? 1 : 2;
  const countedAdopted = Math.min(adoptedCount, maxAdopted);

  const otherHeirs = heirs.filter(h => h.relationship !== 'adopted').length;
  return otherHeirs + countedAdopted;
}

/**
 * 法定相続分を計算
 */
export function calculateLegalShareRatios(heirs: Heir[]): Map<string, number> {
  const ratios = new Map<string, number>();
  if (heirs.length === 0) return ratios;

  const hasSpouse = heirs.some(h => h.relationship === 'spouse');
  const children = heirs.filter(h =>
    h.relationship === 'child' || h.relationship === 'adopted' || h.relationship === 'grandchild_proxy'
  );
  const parents = heirs.filter(h => h.relationship === 'parent' || h.relationship === 'grandparent');
  const siblings = heirs.filter(h => h.relationship === 'sibling');

  if (hasSpouse) {
    const spouse = heirs.find(h => h.relationship === 'spouse')!;

    if (children.length > 0) {
      // 配偶者1/2、子1/2を等分
      ratios.set(spouse.id, 1 / 2);
      const childShare = 1 / 2 / children.length;
      children.forEach(c => ratios.set(c.id, childShare));
    } else if (parents.length > 0) {
      // 配偶者2/3、直系尊属1/3を等分
      ratios.set(spouse.id, 2 / 3);
      const parentShare = 1 / 3 / parents.length;
      parents.forEach(p => ratios.set(p.id, parentShare));
    } else if (siblings.length > 0) {
      // 配偶者3/4、兄弟姉妹1/4を等分
      ratios.set(spouse.id, 3 / 4);
      const siblingShare = 1 / 4 / siblings.length;
      siblings.forEach(s => ratios.set(s.id, siblingShare));
    } else {
      // 配偶者のみ
      ratios.set(spouse.id, 1);
    }
  } else {
    // 配偶者なし
    let eligibleHeirs: Heir[] = [];
    if (children.length > 0) {
      eligibleHeirs = children;
    } else if (parents.length > 0) {
      eligibleHeirs = parents;
    } else if (siblings.length > 0) {
      eligibleHeirs = siblings;
    }

    const share = eligibleHeirs.length > 0 ? 1 / eligibleHeirs.length : 0;
    eligibleHeirs.forEach(h => ratios.set(h.id, share));
  }

  return ratios;
}

/**
 * 配偶者の税額軽減を計算
 */
export function calculateSpouseDeduction(
  totalInheritanceTax: number,
  spouseTaxablePrice: number,
  totalTaxablePrice: number,
  legalShareRatio: number,
  netTaxableValue: number
): number {
  if (totalTaxablePrice === 0) return 0;

  // 法定相続分相当額と1億6千万円のいずれか大きい額
  const legalShareAmount = netTaxableValue * legalShareRatio;
  const limit = Math.max(SPOUSE_DEDUCTION_LIMIT, legalShareAmount);

  // 実際の取得額が上限以下であれば全額控除
  if (spouseTaxablePrice <= limit) {
    return Math.floor(totalInheritanceTax * (spouseTaxablePrice / totalTaxablePrice));
  }

  // 上限を超える場合は上限分のみ控除
  return Math.floor(totalInheritanceTax * (limit / totalTaxablePrice));
}

/**
 * 未成年者控除を計算
 */
export function calculateMinorDeduction(heir: Heir, referenceDate: string): number {
  const age = calculateAge(heir.birthDate, referenceDate);
  if (age >= MINOR_AGE_LIMIT) return 0;
  if (!['child', 'adopted', 'grandchild_proxy'].includes(heir.relationship)) return 0;

  return (MINOR_AGE_LIMIT - age) * MINOR_DEDUCTION_PER_YEAR;
}

/**
 * 障害者控除を計算
 */
export function calculateDisabilityDeduction(heir: Heir, referenceDate: string): number {
  if (!heir.isDisabled) return 0;

  const age = calculateAge(heir.birthDate, referenceDate);
  if (age >= DISABILITY_AGE_LIMIT) return 0;

  const perYear = heir.disabilityType === 'special'
    ? DISABILITY_DEDUCTION_SPECIAL_PER_YEAR
    : DISABILITY_DEDUCTION_GENERAL_PER_YEAR;

  return (DISABILITY_AGE_LIMIT - age) * perYear;
}
