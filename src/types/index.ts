// ============================================================
// 相続税シミュレーションアプリ - 型定義
// ============================================================

// --- 共通型 ---
export type RelationshipType =
  | 'spouse'           // 配偶者
  | 'child'            // 子
  | 'adopted'          // 養子
  | 'grandchild_proxy' // 代襲相続人（孫）
  | 'parent'           // 父母
  | 'grandparent'      // 祖父母
  | 'sibling';         // 兄弟姉妹

export const RELATIONSHIP_LABELS: Record<RelationshipType, string> = {
  spouse: '配偶者',
  child: '子',
  adopted: '養子',
  grandchild_proxy: '代襲相続人（孫）',
  parent: '父母',
  grandparent: '祖父母',
  sibling: '兄弟姉妹',
};

// --- 案件 ---
export interface Case {
  id: string;
  name: string;                 // 案件名（被相続人名等）
  referenceDate: string;        // 基準日（YYYY-MM-DD）
  decedent: Decedent;
  heirs: Heir[];
  assets: Assets;
  division: DivisionPlan;
  giftSimulation?: GiftPlan;
  secondaryConfig?: SecondaryInheritanceConfig;
  taxSavingStrategies?: TaxSavingStrategy[];
  createdAt: string;
  updatedAt: string;
}

// --- 被相続人 ---
export interface Decedent {
  name: string;
  birthDate: string;            // YYYY-MM-DD
  deathDate?: string;           // YYYY-MM-DD（任意）
  address: string;
}

// --- 相続人 ---
export interface Heir {
  id: string;
  name: string;
  birthDate: string;            // YYYY-MM-DD
  address: string;
  relationship: RelationshipType;
  isDisabled: boolean;
  disabilityType?: 'general' | 'special';
}

// --- 財産 ---
export interface Assets {
  lands: LandAsset[];
  buildings: BuildingAsset[];
  cashDeposits: CashDepositAsset[];
  listedStocks: ListedStockAsset[];
  unlistedStocks: UnlistedStockAsset[];
  insurances: InsuranceAsset[];
  others: OtherAsset[];
  debts: DebtItem[];
  funeralExpenses: FuneralExpense[];
  compensationPayments: CompensationPayment[];
}

// --- 土地 ---
export type LandCategory = '宅地' | '田' | '畑' | '山林' | '原野' | '牧場' | '池沼' | '鉱泉地' | '雑種地';
export type EvaluationMethod = 'rosenka' | 'bairitsu';
export type SpecialLandUseType = 'residence' | 'business' | 'rental';

export interface LandShapeCorrection {
  frontageDistance: number;
  depth: number;
  depthCorrection: number;
  irregularShape: boolean;
  irregularCorrection: number;
  sideRoad: boolean;
  sideRoadCorrection: number;
  twoRoads: boolean;
  twoRoadsCorrection: number;
  setback: number;
  borrowedLandRatio: number;
}

export interface SpecialLandUse {
  type: SpecialLandUseType;
  reductionRate: number;
  applicableArea: number;
  maxArea: number;
}

export interface LandAsset {
  id: string;
  location: string;
  landNumber: string;
  landCategory: LandCategory;
  area: number;
  evaluationMethod: EvaluationMethod;
  rosenkaPrice: number;
  landShape: LandShapeCorrection;
  fixedAssetTaxValue: number;
  multiplier: number;
  useSpecialLand: boolean;
  specialUse: SpecialLandUse;
  note: string;
}

// --- 建物 ---
export interface BuildingAsset {
  id: string;
  location: string;
  structureType: string;
  usage: string;
  fixedAssetTaxValue: number;
  rentalReduction: boolean;
  borrowedHouseRatio: number;
  note: string;
}

// --- 現金預金 ---
export interface CashDepositAsset {
  id: string;
  institutionName: string;
  accountType: string;
  balance: number;
  accruedInterest: number;
  note: string;
}

// --- 上場株式 ---
export interface ListedStockAsset {
  id: string;
  companyName: string;
  stockCode: string;
  shares: number;
  deathDatePrice: number;
  monthlyAvgDeath: number;
  monthlyAvgPrev1: number;
  monthlyAvgPrev2: number;
  note: string;
}

// --- 非上場株式 ---
export interface UnlistedStockAsset {
  id: string;
  companyName: string;
  sharesOwned: number;
  totalShares: number;
  pricePerShare: number;
  note: string;
}

// --- 保険金 ---
export interface InsuranceAsset {
  id: string;
  insuranceCompany: string;
  policyNumber: string;
  beneficiaryHeirId: string;
  amount: number;
  isDeathBenefit: boolean;
  note: string;
}

// --- その他財産 ---
export interface OtherAsset {
  id: string;
  category: string;
  description: string;
  quantity: number;
  unitPrice: number;
  note: string;
}

// --- 債務 ---
export interface DebtItem {
  id: string;
  creditor: string;
  description: string;
  amount: number;
  note: string;
}

// --- 葬式費用 ---
export interface FuneralExpense {
  id: string;
  description: string;
  amount: number;
  isDeductible: boolean;
  note: string;
}

// --- 代償分割金 ---
export interface CompensationPayment {
  id: string;
  payerHeirId: string;
  receiverHeirId: string;
  amount: number;
  note: string;
}

// --- 遺産分割 ---
export interface DivisionEntry {
  heirId: string;
  assetId: string;
  assetType: keyof Assets;
  ratio: number;           // 0〜1の割合
  amount?: number;         // 固定額指定時
}

export interface DivisionPlan {
  entries: DivisionEntry[];
}

// --- 贈与シミュレーション ---
export type GiftTaxSystem = 'calendar' | 'settlement';  // 暦年課税/相続時精算課税

export interface GiftPlanEntry {
  heirId: string;
  annualAmount: number;
  years: number;
  startYear: number;
  taxSystem: GiftTaxSystem;
}

export interface GiftPlan {
  entries: GiftPlanEntry[];
}

// --- 計算結果 ---
export interface TaxCalculationResult {
  totalAssetValue: number;            // 財産総額
  totalDeductions: number;            // 債務・葬式費用合計
  insuranceExemption: number;         // 保険金非課税枠
  netTaxableValue: number;            // 課税価格合計
  basicDeduction: number;             // 基礎控除額
  taxableAmount: number;              // 課税遺産総額
  totalInheritanceTax: number;        // 相続税の総額
  heirTaxDetails: HeirTaxDetail[];    // 各相続人の詳細
}

export interface HeirTaxDetail {
  heirId: string;
  heirName: string;
  acquiredValue: number;              // 取得財産額
  taxablePrice: number;               // 課税価格
  legalShareRatio: number;            // 法定相続分
  legalShareAmount: number;           // 法定相続分による取得金額
  taxOnLegalShare: number;            // 法定相続分に対する税額
  allocatedTax: number;               // 按分税額
  spouseDeduction: number;            // 配偶者控除
  minorDeduction: number;             // 未成年者控除
  disabilityDeduction: number;        // 障害者控除
  finalTax: number;                   // 最終税額
}

// --- 贈与税計算結果 ---
export interface GiftTaxResult {
  entries: GiftTaxResultEntry[];
  totalGiftTax: number;
  inheritanceTaxWithGift: number;
  totalTaxBurden: number;
  taxSaving: number;                  // 節税額
}

export interface GiftTaxResultEntry {
  heirId: string;
  year: number;
  giftAmount: number;
  taxSystem: GiftTaxSystem;
  giftTax: number;
  cumulativeGift: number;
  cumulativeGiftTax: number;
}

// --- 二次相続シミュレーション ---
export interface SecondaryInheritanceConfig {
  // 一次相続で配偶者が取得する割合（0-1）
  spouseAcquisitionRatio: number;
  // 配偶者の固有財産
  spouseOwnAssets: number;
  // 配偶者の推定死亡年齢（年齢）
  spouseExpectedDeathAge: number;
  // 二次相続時の推定財産増減（運用益や消費）
  estimatedAssetChangeRate: number; // 年率（例: -0.02 = 毎年2%減少）
  // 二次相続時の相続人（一次の子供たち、配偶者を除く）
  // 自動的に一次相続の子・養子・代襲相続人から判定
}

export interface SecondaryInheritanceResult {
  // 一次相続
  primaryTax: number;
  primarySpouseAcquired: number;
  primaryOtherHeirsTax: number;
  // 二次相続
  secondaryEstateValue: number;
  secondaryBasicDeduction: number;
  secondaryTaxableAmount: number;
  secondaryTotalTax: number;
  secondaryHeirDetails: SecondaryHeirDetail[];
  // 合計
  combinedTotalTax: number;
  // 比較用：配偶者取得割合を変えた場合のシミュレーション
  ratioSimulations: RatioSimulationResult[];
}

export interface SecondaryHeirDetail {
  heirId: string;
  heirName: string;
  acquiredValue: number;
  tax: number;
}

export interface RatioSimulationResult {
  spouseRatio: number; // 0, 0.25, 0.5 (法定), 0.75, 1.0 etc.
  label: string;
  primaryTotalTax: number;
  secondaryTotalTax: number;
  combinedTotalTax: number;
}

// --- 節税シミュレーション ---
export type TaxSavingStrategyType =
  | 'gift'                    // 生前贈与
  | 'life_insurance'          // 生命保険活用
  | 'real_estate'             // 不動産活用（賃貸建物建築等）
  | '養子縁組'                // 養子縁組
  | 'education_fund'          // 教育資金一括贈与
  | 'housing_fund'            // 住宅取得資金贈与
  | 'marriage_child_fund'     // 結婚・子育て資金一括贈与
  | 'small_land_special'      // 小規模宅地等の特例活用
  | 'spouse_deduction';       // 配偶者控除最大活用

export interface TaxSavingStrategy {
  id: string;
  type: TaxSavingStrategyType;
  enabled: boolean;
  // 生前贈与
  giftPlan?: GiftPlan;
  // 生命保険
  insurancePlan?: InsuranceSavingPlan;
  // その他は金額ベースで効果を指定
  estimatedReduction?: number;
  description?: string;
}

export interface InsuranceSavingPlan {
  // 新規加入する生命保険の死亡保険金額
  additionalDeathBenefit: number;
  // 保険料（一時払い等）- 現金からの移動
  premiumAmount: number;
  // 受取人
  beneficiaryHeirIds: string[];
}

export interface TaxSavingSimulationResult {
  // 対策前
  beforeTax: number;
  // 各対策の効果
  strategyResults: StrategyResult[];
  // 対策後
  afterTax: number;
  // 総節税額
  totalSaving: number;
  // 二次相続を含めた効果（二次相続設定がある場合）
  withSecondary?: {
    beforeCombined: number;
    afterCombined: number;
    combinedSaving: number;
  };
}

export interface StrategyResult {
  strategyId: string;
  type: TaxSavingStrategyType;
  label: string;
  saving: number;
  detail: string;
}
