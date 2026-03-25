/**
 * 相続税概算計算モジュール
 *
 * 仮仕様:
 * - 基礎控除: 3,000万円 + 600万円 × 法定相続人数
 * - 生命保険非課税: 500万円 × 法定相続人数
 * - 退職手当金非課税: 500万円 × 法定相続人数（プレースホルダ）
 * - 税率は速算表ベース
 * - 配偶者の税額軽減（簡易版）
 * - 未成年者控除（簡易版）
 * - 障害者控除（簡易版）
 * - 暦年課税贈与税額控除
 * - 相次相続控除: プレースホルダ
 * - 外国税額控除: プレースホルダ
 * - 相続時精算課税制度: プレースホルダ
 */

// --- 型定義 ---

export interface HeirInfo {
  id: string;
  name: string;
  relationship: string;
  taxLegalShareNum: number;
  taxLegalShareDen: number;
  twentyPercentAdd: boolean;
  isDisabled: boolean;
  disabilityType: string | null; // "一般障害者" | "特別障害者"
  birthDate: string | null;
  isSpouse: boolean;
}

export interface AssetSummary {
  landTotal: number;
  buildingTotal: number;
  securityTotal: number;
  depositTotal: number;
  insuranceTotal: number;
  otherAssetTotal: number;
  liabilityTotal: number;
  // 仮仕様: 退職手当金はプレースホルダ
  retirementTotal: number;
}

export interface GiftInfo {
  recipientName: string | null;
  giftValue: number;
  paidGiftTax: number;
  isAddBack: boolean;
}

export interface PartitionAllocationInfo {
  heirId: string;
  amount: number; // 各相続人の取得額（正味）
}

export interface TaxEstimateInput {
  heirs: HeirInfo[];
  assets: AssetSummary;
  gifts: GiftInfo[];
  allocations: PartitionAllocationInfo[];
  baseDate: string;
  legalHeirCount: number;
}

export interface HeirTaxDetail {
  heirId: string;
  heirName: string;
  acquiredAmount: number;       // 取得財産価額
  giftAddBack: number;          // 生前贈与加算額
  taxablePrice: number;         // 課税価格
  taxShare: number;             // 按分後税額
  twentyPercentAddAmount: number; // 2割加算額
  spouseDeduction: number;      // 配偶者税額軽減
  minorDeduction: number;       // 未成年者控除
  disabilityDeduction: number;  // 障害者控除
  giftTaxCredit: number;        // 贈与税額控除
  // 仮仕様: プレースホルダ
  successionDeduction: number;  // 相次相続控除
  foreignTaxCredit: number;     // 外国税額控除
  finalTax: number;             // 納付すべき税額
  legalShareRatio: number;      // 法定相続分
  acquisitionRatio: number;     // 取得割合
  afterTaxAmount: number;       // 税引後金額
}

export interface TaxEstimateResult {
  grossAssets: number;           // 財産総額
  insuranceExemption: number;    // 生命保険非課税額
  retirementExemption: number;   // 退職手当金非課税額（プレースホルダ）
  netAssets: number;             // 純資産額
  giftAddBackTotal: number;      // 生前贈与加算額合計
  totalTaxableAmount: number;    // 課税価格合計
  basicDeduction: number;        // 基礎控除
  taxableInheritance: number;    // 課税遺産総額
  totalTax: number;              // 相続税の総額
  heirDetails: HeirTaxDetail[];  // 各人明細
}

// --- 税率速算表 ---
// 仮仕様: 2015年以降の税率表
interface TaxBracket {
  limit: number;   // 上限（円）
  rate: number;    // 税率（小数）
  deduction: number; // 控除額（円）
}

const TAX_BRACKETS: TaxBracket[] = [
  { limit: 10_000_000, rate: 0.10, deduction: 0 },
  { limit: 30_000_000, rate: 0.15, deduction: 500_000 },
  { limit: 50_000_000, rate: 0.20, deduction: 2_000_000 },
  { limit: 100_000_000, rate: 0.30, deduction: 7_000_000 },
  { limit: 200_000_000, rate: 0.40, deduction: 17_000_000 },
  { limit: 300_000_000, rate: 0.45, deduction: 27_000_000 },
  { limit: 600_000_000, rate: 0.50, deduction: 42_000_000 },
  { limit: Infinity, rate: 0.55, deduction: 72_000_000 },
];

// --- 独立関数群 ---

/**
 * 基礎控除計算
 * 仮仕様: 3,000万円 + 600万円 × 法定相続人の数
 */
export function calcBasicDeduction(legalHeirCount: number): number {
  return 30_000_000 + 6_000_000 * legalHeirCount;
}

/**
 * 生命保険非課税限度額
 * 仮仕様: 500万円 × 法定相続人の数
 */
export function calcInsuranceExemption(legalHeirCount: number): number {
  return 5_000_000 * legalHeirCount;
}

/**
 * 退職手当金非課税限度額（プレースホルダ）
 * 仮仕様: 500万円 × 法定相続人の数
 */
export function calcRetirementExemption(legalHeirCount: number): number {
  return 5_000_000 * legalHeirCount;
}

/**
 * 速算表による税額計算
 */
export function calcTaxByBracket(taxableAmount: number): number {
  if (taxableAmount <= 0) return 0;
  for (const bracket of TAX_BRACKETS) {
    if (taxableAmount <= bracket.limit) {
      return Math.floor(taxableAmount * bracket.rate - bracket.deduction);
    }
  }
  const last = TAX_BRACKETS[TAX_BRACKETS.length - 1];
  return Math.floor(taxableAmount * last.rate - last.deduction);
}

/**
 * 課税価格計算
 * 各人の取得額 + 生前贈与加算額
 */
export function calcTaxablePrice(acquiredAmount: number, giftAddBack: number): number {
  const total = acquiredAmount + giftAddBack;
  // 仮仕様: 1,000円未満切捨て
  return Math.floor(total / 1000) * 1000;
}

/**
 * 相続税の総額計算
 * 課税遺産総額を法定相続分で按分し、各人の仮税額を合計
 */
export function calcTotalTax(taxableInheritance: number, heirs: HeirInfo[]): number {
  if (taxableInheritance <= 0) return 0;

  let totalTax = 0;
  for (const heir of heirs) {
    const share = heir.taxLegalShareDen > 0
      ? heir.taxLegalShareNum / heir.taxLegalShareDen
      : 0;
    // 仮仕様: 法定相続分に応じた取得金額（1,000円未満切捨て）
    const heirTaxable = Math.floor((taxableInheritance * share) / 1000) * 1000;
    totalTax += calcTaxByBracket(heirTaxable);
  }
  return totalTax;
}

/**
 * 各人按分計算
 * 相続税の総額 × (各人の課税価格 / 課税価格合計)
 */
export function calcProportionalTax(
  totalTax: number,
  heirTaxablePrice: number,
  totalTaxablePrice: number
): number {
  if (totalTaxablePrice <= 0) return 0;
  // 仮仕様: 100円未満切捨て
  return Math.floor((totalTax * heirTaxablePrice / totalTaxablePrice) / 100) * 100;
}

/**
 * 2割加算
 */
export function calcTwentyPercentAdd(tax: number, isTarget: boolean): number {
  if (!isTarget) return 0;
  return Math.floor(tax * 0.2);
}

/**
 * 配偶者の税額軽減（簡易版）
 * 仮仕様: 配偶者の取得額が法定相続分以下 or 1億6千万円以下なら全額控除
 */
export function calcSpouseDeduction(
  spouseTax: number,
  spouseAcquiredAmount: number,
  totalTaxableAmount: number,
  spouseLegalShareNum: number,
  spouseLegalShareDen: number,
  totalTax: number
): number {
  const legalShareAmount = spouseLegalShareDen > 0
    ? totalTaxableAmount * spouseLegalShareNum / spouseLegalShareDen
    : 0;
  const limit = Math.max(legalShareAmount, 160_000_000);

  if (spouseAcquiredAmount <= limit) {
    return spouseTax; // 全額控除
  }

  // 仮仕様: 限度額超過時は按分で計算
  const deduction = Math.floor(totalTax * Math.min(limit, spouseAcquiredAmount) / totalTaxableAmount / 100) * 100;
  return Math.min(deduction, spouseTax);
}

/**
 * 未成年者控除（簡易版）
 * 仮仕様: (18歳 - 年齢) × 10万円
 * 2022年4月1日以降は18歳
 */
export function calcMinorDeduction(birthDate: string | null, baseDate: string): number {
  if (!birthDate) return 0;
  const birth = new Date(birthDate);
  const base = new Date(baseDate);
  let age = base.getFullYear() - birth.getFullYear();
  const m = base.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && base.getDate() < birth.getDate())) age--;

  if (age >= 18) return 0;
  return (18 - age) * 100_000;
}

/**
 * 障害者控除（簡易版）
 * 仮仕様:
 *   一般障害者: (85歳 - 年齢) × 10万円
 *   特別障害者: (85歳 - 年齢) × 20万円
 */
export function calcDisabilityDeduction(
  birthDate: string | null,
  baseDate: string,
  isDisabled: boolean,
  disabilityType: string | null
): number {
  if (!isDisabled || !birthDate) return 0;
  const birth = new Date(birthDate);
  const base = new Date(baseDate);
  let age = base.getFullYear() - birth.getFullYear();
  const m = base.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && base.getDate() < birth.getDate())) age--;

  if (age >= 85) return 0;
  const perYear = disabilityType === "特別障害者" ? 200_000 : 100_000;
  return (85 - age) * perYear;
}

/**
 * 贈与税額控除
 * 仮仕様: 加算対象の贈与に係る納付済贈与税額を控除
 */
export function calcGiftTaxCredit(gifts: GiftInfo[], heirName: string | null): number {
  if (!heirName) return 0;
  return gifts
    .filter(g => g.isAddBack && g.recipientName === heirName)
    .reduce((sum, g) => sum + g.paidGiftTax, 0);
}

/**
 * 相次相続控除（プレースホルダ）
 * 仮仕様: 未実装、0を返す
 */
export function calcSuccessionDeduction(): number {
  // TODO: 相次相続控除の実装
  return 0;
}

/**
 * 外国税額控除（プレースホルダ）
 * 仮仕様: 未実装、0を返す
 */
export function calcForeignTaxCredit(): number {
  // TODO: 外国税額控除の実装
  return 0;
}

// --- メイン計算関数 ---

export function calculateInheritanceTax(input: TaxEstimateInput): TaxEstimateResult {
  const { heirs, assets, gifts, allocations, baseDate, legalHeirCount } = input;

  // 1. 財産総額
  const grossAssets =
    assets.landTotal +
    assets.buildingTotal +
    assets.securityTotal +
    assets.depositTotal +
    assets.insuranceTotal +
    assets.otherAssetTotal +
    assets.retirementTotal;

  // 2. 非課税額
  const insuranceExemption = Math.min(
    calcInsuranceExemption(legalHeirCount),
    assets.insuranceTotal
  );
  const retirementExemption = Math.min(
    calcRetirementExemption(legalHeirCount),
    assets.retirementTotal
  );

  // 3. 純資産額
  const netAssets = grossAssets - insuranceExemption - retirementExemption - assets.liabilityTotal;

  // 4. 生前贈与加算
  const addBackGifts = gifts.filter(g => g.isAddBack);
  const giftAddBackTotal = addBackGifts.reduce((sum, g) => sum + g.giftValue, 0);

  // 5. 課税価格合計
  const totalTaxableAmount = Math.max(0, netAssets + giftAddBackTotal);

  // 6. 基礎控除
  const basicDeduction = calcBasicDeduction(legalHeirCount);

  // 7. 課税遺産総額
  const taxableInheritance = Math.max(0, totalTaxableAmount - basicDeduction);

  // 8. 相続税の総額
  const totalTax = calcTotalTax(taxableInheritance, heirs);

  // 9. 各人の詳細計算
  const totalAllocated = allocations.reduce((sum, a) => sum + a.amount, 0);

  const heirDetails: HeirTaxDetail[] = heirs.map(heir => {
    const allocation = allocations.find(a => a.heirId === heir.id);
    const acquiredAmount = allocation?.amount ?? 0;

    // 生前贈与加算額（各人分）
    const giftAddBack = addBackGifts
      .filter(g => g.recipientName === heir.name)
      .reduce((sum, g) => sum + g.giftValue, 0);

    const taxablePrice = calcTaxablePrice(acquiredAmount, giftAddBack);

    // 按分税額
    const taxShare = calcProportionalTax(totalTax, taxablePrice, totalTaxableAmount > 0 ? totalTaxableAmount : 1);

    // 2割加算
    const twentyPercentAddAmount = calcTwentyPercentAdd(taxShare, heir.twentyPercentAdd);

    // 加算後税額
    const afterAddTax = taxShare + twentyPercentAddAmount;

    // 控除
    const spouseDeduction = heir.isSpouse
      ? calcSpouseDeduction(afterAddTax, acquiredAmount, totalTaxableAmount, heir.taxLegalShareNum, heir.taxLegalShareDen, totalTax)
      : 0;

    const minorDeduction = calcMinorDeduction(heir.birthDate, baseDate);
    const disabilityDeduction = calcDisabilityDeduction(heir.birthDate, baseDate, heir.isDisabled, heir.disabilityType);
    const giftTaxCredit = calcGiftTaxCredit(gifts, heir.name);
    const successionDeduction = calcSuccessionDeduction();
    const foreignTaxCredit = calcForeignTaxCredit();

    const totalDeductions = spouseDeduction + minorDeduction + disabilityDeduction + giftTaxCredit + successionDeduction + foreignTaxCredit;

    // 仮仕様: 100円未満切捨て
    const finalTax = Math.max(0, Math.floor((afterAddTax - totalDeductions) / 100) * 100);

    const legalShareRatio = heir.taxLegalShareDen > 0 ? heir.taxLegalShareNum / heir.taxLegalShareDen : 0;
    const acquisitionRatio = totalAllocated > 0 ? acquiredAmount / totalAllocated : 0;
    const afterTaxAmount = acquiredAmount - finalTax;

    return {
      heirId: heir.id,
      heirName: heir.name,
      acquiredAmount,
      giftAddBack,
      taxablePrice,
      taxShare,
      twentyPercentAddAmount,
      spouseDeduction,
      minorDeduction,
      disabilityDeduction,
      giftTaxCredit,
      successionDeduction,
      foreignTaxCredit,
      finalTax,
      legalShareRatio,
      acquisitionRatio,
      afterTaxAmount,
    };
  });

  return {
    grossAssets,
    insuranceExemption,
    retirementExemption,
    netAssets,
    giftAddBackTotal,
    totalTaxableAmount,
    basicDeduction,
    taxableInheritance,
    totalTax,
    heirDetails,
  };
}
