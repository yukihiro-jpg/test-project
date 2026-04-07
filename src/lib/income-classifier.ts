/**
 * 所得・年齢に基づく扶養控除区分の自動判定（令和7年税制改正対応）
 *
 * 令和7年改正での主な変更:
 * - 扶養親族・同一生計配偶者の所得要件: 48万円 → 58万円（給与収入123万円以下）
 * - 配偶者特別控除の対象: 58万円超〜133万円以下（給与収入123万円超〜201.6万円以下）
 * - 特定親族特別控除（新設）: 19〜22歳で給与収入123万円超〜188万円以下を段階的控除
 * - 勤労学生: 給与収入150万円以下（所得85万円以下）
 */

// 扶養親族・配偶者の所得上限（給与収入ベース）
export const DEPENDENT_INCOME_LIMIT = 1_230_000 // 123万円
export const SPOUSE_SPECIAL_LIMIT = 2_016_000 // 201.6万円
export const SPECIFIC_RELATIVE_SPECIAL_LIMIT = 1_880_000 // 188万円（特定親族特別控除上限）
export const WORKING_STUDENT_LIMIT = 1_500_000 // 150万円（勤労学生）

/**
 * 配偶者の控除区分
 */
export type SpouseDeductionType =
  | '控除対象配偶者'
  | '配偶者特別控除対象'
  | '控除対象外'

/**
 * 給与年収から配偶者の控除区分を判定
 */
export function classifySpouse(annualIncomeYen: number): SpouseDeductionType {
  if (annualIncomeYen <= DEPENDENT_INCOME_LIMIT) {
    return '控除対象配偶者'
  }
  if (annualIncomeYen <= SPOUSE_SPECIAL_LIMIT) {
    return '配偶者特別控除対象'
  }
  return '控除対象外'
}

/**
 * 扶養親族の控除区分
 */
export type DependentDeductionType =
  | '16歳未満（住民税控除のみ）'
  | '一般の控除対象扶養親族'
  | '特定扶養親族'
  | '特定親族特別控除対象'
  | '同居老親等'
  | '老人扶養親族'
  | '控除対象外'

/**
 * 生年月日から年齢を計算（年末調整は12月31日時点で判定）
 */
export function calcAgeAtYearEnd(birthday: string, fiscalYear: number): number {
  const m = birthday.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (!m) return 0
  const birthYear = parseInt(m[1])
  const birthMonth = parseInt(m[2])
  const birthDay = parseInt(m[3])

  // 12月31日時点の年齢
  const yearEnd = new Date(fiscalYear, 11, 31)
  const birthDate = new Date(birthYear, birthMonth - 1, birthDay)
  let age = yearEnd.getFullYear() - birthDate.getFullYear()
  const md = yearEnd.getMonth() - birthDate.getMonth()
  if (md < 0 || (md === 0 && yearEnd.getDate() < birthDate.getDate())) {
    age--
  }
  return age
}

/**
 * 扶養親族の控除区分を判定
 */
export function classifyDependent(
  birthday: string,
  annualIncomeYen: number,
  livesTogether: boolean,
  fiscalYear: number,
): DependentDeductionType {
  const age = calcAgeAtYearEnd(birthday, fiscalYear)

  // 16歳未満（住民税の扶養控除のみ。所得税は対象外）
  if (age < 16) {
    return '16歳未満（住民税控除のみ）'
  }

  // 19〜22歳: 特定扶養親族 or 特定親族特別控除（新設）
  if (age >= 19 && age <= 22) {
    if (annualIncomeYen <= DEPENDENT_INCOME_LIMIT) {
      return '特定扶養親族'
    }
    if (annualIncomeYen <= SPECIFIC_RELATIVE_SPECIAL_LIMIT) {
      return '特定親族特別控除対象'
    }
    return '控除対象外'
  }

  // 70歳以上: 老人扶養
  if (age >= 70) {
    if (annualIncomeYen <= DEPENDENT_INCOME_LIMIT) {
      return livesTogether ? '同居老親等' : '老人扶養親族'
    }
    return '控除対象外'
  }

  // 16〜18歳, 23〜69歳: 一般
  if (annualIncomeYen <= DEPENDENT_INCOME_LIMIT) {
    return '一般の控除対象扶養親族'
  }
  return '控除対象外'
}

/**
 * 勤労学生の年収要件チェック
 */
export function isEligibleWorkingStudent(annualIncomeYen: number): boolean {
  return annualIncomeYen <= WORKING_STUDENT_LIMIT
}
