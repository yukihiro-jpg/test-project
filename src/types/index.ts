// ============================================================
// 相続税シミュレーションアプリ - 型定義
// ============================================================

// --- 共通型 ---
export type RelationshipType =
  | 'spouse'           // 配偶者
  | 'child'            // 子
  | 'adopted'          // 養子
  | 'grandchild_proxy' // 代襲相続人（孫）
  | 'grandchild'       // 孫（通常）
  | 'parent'           // 父母
  | 'grandparent'      // 祖父母
  | 'sibling';         // 兄弟姉妹

export const RELATIONSHIP_LABELS: Record<RelationshipType, string> = {
  spouse: '配偶者',
  child: '子',
  adopted: '養子',
  grandchild_proxy: '代襲相続人（孫）',
  grandchild: '孫',
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
  workflow?: CaseWorkflow;
  fundsMovement?: FundsMovement;
  createdAt: string;
  updatedAt: string;
}

// --- 被相続人 ---
export interface Decedent {
  name: string;
  birthDate: string;            // YYYY-MM-DD
  deathDate?: string;           // YYYY-MM-DD（任意）
  address: string;
  phone?: string;
  occupation?: string;          // 職業
}

// --- 相続人 ---
export interface Heir {
  id: string;
  name: string;
  birthDate: string;            // YYYY-MM-DD
  address: string;
  phone?: string;
  relationship: RelationshipType;
  customRelationship?: string;  // 手入力の続柄（表示優先）
  occupation?: string;          // 職業
  isDisabled: boolean;
  disabilityType?: 'general' | 'special';
}

/** 表示用の続柄を取得（手入力があればそちらを優先） */
export function getDisplayRelationship(heir: Heir): string {
  return heir.customRelationship || RELATIONSHIP_LABELS[heir.relationship];
}

// --- 財産 ---
export interface Assets {
  lands: LandAsset[];
  buildings: BuildingAsset[];
  cashDeposits: CashDepositAsset[];
  listedStocks: ListedStockAsset[];
  unlistedStocks: UnlistedStockAsset[];
  insurances: InsuranceAsset[];
  retirementBenefits: RetirementBenefit[];
  others: OtherAsset[];
  debts: DebtItem[];
  funeralExpenses: FuneralExpense[];
  compensationPayments: CompensationPayment[];
}

// --- 退職金 ---
export interface RetirementBenefit {
  id: string;
  payerName: string;              // 支給者名
  beneficiaryHeirId: string;      // 受取人
  amount: number;                 // 金額
  note: string;
}

// --- 土地 ---
export type LandCategory = '宅地' | '田' | '畑' | '山林' | '原野' | '牧場' | '池沼' | '鉱泉地' | '雑種地';
export type EvaluationMethod = 'rosenka' | 'bairitsu';
export type SpecialLandUseType = 'residence' | 'business' | 'rental';
export type LandUsageType = '自用' | '貸家' | '貸家建付地' | '貸地' | '借地' | '私道' | '使用貸借';

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
  // 所在・識別
  location: string;                  // 所在地
  landNumber: string;                // 地番
  referenceNote?: string;            // 参照・備考
  // 持分
  ownershipRatio?: string;           // 持分（例: "1/2"）
  // 地目
  landCategory: LandCategory;        // 登記地目
  registeredCategory?: string;       // 登記地目（評価証明）
  taxCategory?: string;              // 課税地目（評価証明）
  currentStatus?: string;            // 現況確認（実地調査）
  // 地積
  area: number;                      // 登記地積（謄本より）
  registeredArea?: number;           // 登記地積
  taxArea?: number;                  // 課税地積（評証より）
  // 評価
  evaluationMethod: EvaluationMethod;
  rosenkaPrice: number;              // 路線価
  landShape: LandShapeCorrection;
  fixedAssetTaxValue: number;        // 固定資産税評価額
  multiplier: number;                // 倍率
  evaluationArea?: string;           // 評価地域（路・倍）
  // 利用状況
  usage?: LandUsageType;             // 用途（自用/貸家/貸家建付地/貸地/私道/使用貸借）
  tenantName?: string;               // 借主
  borrowingRightRatio?: number;      // 借地権割合
  sideTwoRoads?: string;             // 側方・二方
  // 都市計画
  cityPlanningZone?: string;         // 都市計画区分
  // 建物紐づけ（貸家建付地評価用）
  linkedBuildingId?: string;         // 紐づく建物のID
  // 特例
  useSpecialLand: boolean;
  specialUse: SpecialLandUse;
  // 備考
  note: string;
  confirmationNote?: string;         // 確認すること
}

// --- 建物 ---
export interface BuildingAsset {
  id: string;
  name?: string;                    // 建物名（貸家の場合に表示）
  location: string;                 // 所在地
  houseNumber?: string;             // 家屋番号
  registrationStatus?: 'registered' | 'unregistered'; // 登記有/未登記
  ownershipRatio?: string;          // 持分（例: "1/2"）
  structureType: string;            // 構造
  usage: string;                    // 用途
  floors?: number;                  // 階数
  floorAreas?: number[];            // 各階の床面積
  fixedAssetTaxValue: number;       // 固定資産税評価額
  rentalReduction: boolean;         // 貸家フラグ
  borrowedHouseRatio: number;       // 借家権割合（標準0.3）
  tenantName?: string;
  rooms?: BuildingRoom[];           // 部屋ごとの賃貸情報
  note: string;
}

// 建物の部屋（賃貸割合計算用）
export interface BuildingRoom {
  id: string;
  roomNumber: string;               // 部屋番号
  tenantName: string;               // 借主
  area: number;                     // 専有面積（㎡）
  occupancy: RoomOccupancy;         // 月別の入居状況
  deposit?: number;                 // 預り敷金
  note?: string;                    // 備考（賃料等）
}

export interface RoomOccupancy {
  jan: boolean;
  feb: boolean;
  mar: boolean;
  apr: boolean;
  may: boolean;
  jun: boolean;
  jul: boolean;
  aug: boolean;
  sep: boolean;
  oct: boolean;
  nov: boolean;
  dec: boolean;
}

// --- 現金預金 ---
export interface CashDepositAsset {
  id: string;
  institutionName: string;        // 銀行名
  branchName?: string;            // 支店名
  accountType: string;            // 種類（普通預金/定期預金等）
  accountNumber?: string;         // 口座番号
  balance: number;                // 金額
  accruedInterest: number;        // 経過利息
  hasBalanceCertificate?: boolean; // 残高証明書の有無
  note: string;                   // 備考
}

// --- 預金移動表 ---
export interface FundsMovement {
  id: string;
  caseId: string;                 // 紐づく案件ID（将来拡張用）
  movements: FundsMovementEntry[];
}

export interface FundsMovementEntry {
  id: string;
  date: string;                   // 日付（YYYY-MM-DD）
  transactions: FundsMovementTransaction[]; // 口座ごとの入出金
  inheritanceAmount: number;      // 結論（相続財産計上額）
  note: string;                   // 備考
}

export interface FundsMovementTransaction {
  accountId: string;              // CashDepositAssetのID
  deposit: number;                // 入金
  withdrawal: number;             // 出金
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
export type DebtCategory = '公租公課' | '未払金' | '借入金' | '預り敷金' | 'その他';

/** 複数負担者の割合情報 */
export interface PayerShare {
  heirId: string;
  ratio: number;                    // 負担割合（0〜1）
}

export interface DebtItem {
  id: string;
  category?: DebtCategory;          // 種類
  subCategory?: string;             // 細目（例: 固定資産税、市民税、医療費）
  creditor: string;                 // 債権者名
  creditorAddress?: string;         // 債権者住所
  description: string;              // 内容
  debtDate?: string;                // 債務発生年月日（YYYY-MM-DD）
  dueDate?: string;                 // 弁済期日（YYYY-MM-DD）
  payerHeirId?: string;             // 支払者（旧: 単一）※後方互換
  payers?: PayerShare[];            // 支払者（複数対応）
  amount: number;
  note: string;
}

// --- 葬式費用 ---
export interface FuneralExpense {
  id: string;
  description: string;              // 内容
  payee?: string;                   // 支払先名称
  payeeAddress?: string;            // 支払先住所
  paymentDate?: string;             // 支払年月日
  amount: number;                   // 請求金額（実際支払額）
  nonDeductibleAmount?: number;     // 葬式費用にならない金額
  bearers?: PayerShare[];           // 負担者（複数対応）
  isDeductible: boolean;            // 控除対象フラグ（旧機能、互換維持）
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
  retirementExemption: number;        // 退職金非課税枠
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

// ============================================================
// 業務フロー管理（ワークフロー）
// ============================================================

export type WorkflowPhase =
  | 'reception'         // 1. 受任・初回面談
  | 'document_request'  // 2. 資料依頼
  | 'document_collect'  // 3. 資料収集・確認
  | 'evaluation'        // 4. 財産評価・申告書作成
  | 'report'            // 5. 報告・分割協議
  | 'agreement'         // 6. 分割協議書作成
  | 'filing'            // 7. 電子申告
  | 'delivery';         // 8. 納品・完了

export const WORKFLOW_PHASE_LABELS: Record<WorkflowPhase, string> = {
  reception: '受任・初回面談',
  document_request: '資料依頼',
  document_collect: '資料収集・確認',
  evaluation: '財産評価・申告書作成',
  report: '報告・分割協議',
  agreement: '分割協議書作成',
  filing: '電子申告',
  delivery: '納品・完了',
};

export const WORKFLOW_PHASES: WorkflowPhase[] = [
  'reception', 'document_request', 'document_collect',
  'evaluation', 'report', 'agreement', 'filing', 'delivery',
];

export interface CaseWorkflow {
  currentPhase: WorkflowPhase;
  phases: Record<WorkflowPhase, PhaseStatus>;
  documents: DocumentRequest[];
  schedule: ScheduleItem[];
  notes: WorkflowNote[];
}

export interface PhaseStatus {
  status: 'not_started' | 'in_progress' | 'completed';
  startedAt?: string;
  completedAt?: string;
  memo?: string;
}

// --- 資料依頼チェックリスト ---
export type DocumentCategory =
  | 'identity'       // 身分関係
  | 'real_estate'    // 不動産
  | 'financial'      // 金融資産
  | 'insurance'      // 保険
  | 'debt'           // 債務
  | 'other';         // その他

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  identity: '身分関係書類',
  real_estate: '不動産関係書類',
  financial: '金融資産関係書類',
  insurance: '保険関係書類',
  debt: '債務関係書類',
  other: 'その他',
};

export interface DocumentRequest {
  id: string;
  category: DocumentCategory;
  name: string;                    // 資料名
  description?: string;            // 補足説明
  required: boolean;               // 必須かどうか
  status: 'not_requested' | 'requested' | 'received' | 'confirmed' | 'not_applicable';
  requestedAt?: string;
  receivedAt?: string;
  confirmedAt?: string;
  note?: string;
}

// --- スケジュール管理 ---
export interface ScheduleItem {
  id: string;
  title: string;
  dueDate: string;                 // YYYY-MM-DD
  description?: string;
  completed: boolean;
  completedAt?: string;
  category: 'deadline' | 'meeting' | 'task' | 'milestone';
}

// --- 業務メモ ---
export interface WorkflowNote {
  id: string;
  date: string;
  author: string;
  content: string;
}

// --- 資料依頼テンプレート ---
export const DOCUMENT_TEMPLATES: Omit<DocumentRequest, 'id' | 'status' | 'requestedAt' | 'receivedAt' | 'confirmedAt' | 'note'>[] = [
  // 身分関係
  { category: 'identity', name: '被相続人の戸籍謄本（出生から死亡まで）', required: true },
  { category: 'identity', name: '被相続人の住民票の除票', required: true },
  { category: 'identity', name: '相続人全員の戸籍謄本', required: true },
  { category: 'identity', name: '相続人全員の住民票', required: true },
  { category: 'identity', name: '相続人全員の印鑑証明書', required: true },
  { category: 'identity', name: '相続人全員のマイナンバー確認書類', required: true },
  { category: 'identity', name: '遺言書（ある場合）', required: false },
  { category: 'identity', name: '死亡診断書のコピー', required: false },
  // 不動産
  { category: 'real_estate', name: '固定資産税の課税明細書（名寄帳）', required: true },
  { category: 'real_estate', name: '登記簿謄本（全部事項証明書）', required: true },
  { category: 'real_estate', name: '固定資産税評価証明書', required: true },
  { category: 'real_estate', name: '公図・地積測量図', required: true },
  { category: 'real_estate', name: '住宅地図', required: false },
  { category: 'real_estate', name: '賃貸借契約書（賃貸の場合）', required: false },
  { category: 'real_estate', name: '路線価図', description: '税理士側で取得可', required: false },
  // 金融資産
  { category: 'financial', name: '預貯金の残高証明書（死亡日現在）', required: true },
  { category: 'financial', name: '預貯金の既経過利息計算書', required: true },
  { category: 'financial', name: '過去5年分の通帳コピー', required: true, description: '名義預金・生前贈与の確認用' },
  { category: 'financial', name: '証券会社の残高証明書（死亡日現在）', required: true },
  { category: 'financial', name: '配当金の支払通知書', required: false },
  { category: 'financial', name: '投資信託の取引残高報告書', required: false },
  { category: 'financial', name: '非上場株式の決算書（3期分）', required: false },
  // 保険
  { category: 'insurance', name: '生命保険金の支払通知書', required: true },
  { category: 'insurance', name: '保険証券のコピー', required: true },
  { category: 'insurance', name: '解約返戻金の証明書（解約していない保険）', required: false },
  // 債務
  { category: 'debt', name: '借入金の残高証明書', required: true },
  { category: 'debt', name: '未払いの医療費の領収書', required: true },
  { category: 'debt', name: '未払いの税金の通知書', required: true },
  { category: 'debt', name: '葬式費用の領収書一式', required: true },
  { category: 'debt', name: '香典帳', required: false },
  // その他
  { category: 'other', name: '確定申告書（過去3年分）', required: true },
  { category: 'other', name: '贈与税の申告書（過去分）', required: false },
  { category: 'other', name: '生前贈与の契約書・振込記録', required: false },
  { category: 'other', name: '自動車の車検証', required: false },
  { category: 'other', name: '貴金属・美術品等の鑑定書', required: false },
  { category: 'other', name: '退職手当金の支払通知書', required: false },
];
