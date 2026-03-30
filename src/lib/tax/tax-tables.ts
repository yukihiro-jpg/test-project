// 相続税・贈与税 税率テーブル（速算表）

export interface TaxBracket {
  threshold: number;   // 上限金額（円）
  rate: number;        // 税率（0〜1）
  deduction: number;   // 控除額（円）
}

// --- 相続税速算表 ---
export const INHERITANCE_TAX_BRACKETS: TaxBracket[] = [
  { threshold: 10_000_000, rate: 0.10, deduction: 0 },
  { threshold: 30_000_000, rate: 0.15, deduction: 500_000 },
  { threshold: 50_000_000, rate: 0.20, deduction: 2_000_000 },
  { threshold: 100_000_000, rate: 0.30, deduction: 7_000_000 },
  { threshold: 200_000_000, rate: 0.40, deduction: 17_000_000 },
  { threshold: 300_000_000, rate: 0.45, deduction: 27_000_000 },
  { threshold: 600_000_000, rate: 0.50, deduction: 42_000_000 },
  { threshold: Infinity, rate: 0.55, deduction: 72_000_000 },
];

// --- 贈与税速算表（一般税率） ---
export const GIFT_TAX_GENERAL_BRACKETS: TaxBracket[] = [
  { threshold: 2_000_000, rate: 0.10, deduction: 0 },
  { threshold: 3_000_000, rate: 0.15, deduction: 100_000 },
  { threshold: 4_000_000, rate: 0.20, deduction: 250_000 },
  { threshold: 6_000_000, rate: 0.30, deduction: 650_000 },
  { threshold: 10_000_000, rate: 0.40, deduction: 1_250_000 },
  { threshold: 15_000_000, rate: 0.45, deduction: 1_750_000 },
  { threshold: 30_000_000, rate: 0.50, deduction: 2_500_000 },
  { threshold: Infinity, rate: 0.55, deduction: 4_000_000 },
];

// --- 贈与税速算表（特例税率：直系尊属から18歳以上） ---
export const GIFT_TAX_SPECIAL_BRACKETS: TaxBracket[] = [
  { threshold: 2_000_000, rate: 0.10, deduction: 0 },
  { threshold: 4_000_000, rate: 0.15, deduction: 100_000 },
  { threshold: 6_000_000, rate: 0.20, deduction: 300_000 },
  { threshold: 10_000_000, rate: 0.30, deduction: 900_000 },
  { threshold: 15_000_000, rate: 0.40, deduction: 1_900_000 },
  { threshold: 30_000_000, rate: 0.45, deduction: 2_650_000 },
  { threshold: 45_000_000, rate: 0.50, deduction: 4_150_000 },
  { threshold: Infinity, rate: 0.55, deduction: 6_400_000 },
];

// --- 定数 ---
/** 基礎控除の定額部分 */
export const BASIC_DEDUCTION_BASE = 30_000_000;
/** 基礎控除の法定相続人1人あたり加算額 */
export const BASIC_DEDUCTION_PER_HEIR = 6_000_000;

/** 保険金の非課税枠（1人あたり） */
export const INSURANCE_EXEMPTION_PER_HEIR = 5_000_000;
/** 退職手当金の非課税枠（1人あたり） */
export const RETIREMENT_EXEMPTION_PER_HEIR = 5_000_000;

/** 配偶者の税額軽減の上限 */
export const SPOUSE_DEDUCTION_LIMIT = 160_000_000;

/** 未成年者控除: (18歳-年齢)×10万円 */
export const MINOR_DEDUCTION_PER_YEAR = 100_000;
/** 未成年者控除の年齢上限 */
export const MINOR_AGE_LIMIT = 18;

/** 障害者控除（一般）: (85歳-年齢)×10万円 */
export const DISABILITY_DEDUCTION_GENERAL_PER_YEAR = 100_000;
/** 障害者控除（特別）: (85歳-年齢)×20万円 */
export const DISABILITY_DEDUCTION_SPECIAL_PER_YEAR = 200_000;
/** 障害者控除の年齢上限 */
export const DISABILITY_AGE_LIMIT = 85;

/** 贈与税の基礎控除 */
export const GIFT_TAX_BASIC_DEDUCTION = 1_100_000;

/** 相続時精算課税の特別控除（累計上限） */
export const SETTLEMENT_SPECIAL_DEDUCTION = 25_000_000;
/** 相続時精算課税の基礎控除（2024年改正後、年間） */
export const SETTLEMENT_BASIC_DEDUCTION = 1_100_000;
/** 相続時精算課税の税率 */
export const SETTLEMENT_TAX_RATE = 0.20;

/** 暦年贈与の相続財産加算期間（年） - 2024年改正後は段階的に7年に延長 */
export const GIFT_ADDITION_YEARS = 7;

/**
 * 速算表による税額計算
 */
export function calculateTaxFromBrackets(taxableAmount: number, brackets: TaxBracket[]): number {
  if (taxableAmount <= 0) return 0;
  for (const bracket of brackets) {
    if (taxableAmount <= bracket.threshold) {
      return Math.floor(taxableAmount * bracket.rate - bracket.deduction);
    }
  }
  // Should not reach here if brackets include Infinity
  const last = brackets[brackets.length - 1];
  return Math.floor(taxableAmount * last.rate - last.deduction);
}
