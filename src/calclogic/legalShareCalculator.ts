/**
 * 法定相続分簡易計算ユーティリティ
 *
 * 仮仕様:
 * - 配偶者 + 子の場合: 配偶者1/2, 子は残り1/2を均等分割
 * - 配偶者 + 直系尊属: 配偶者2/3, 直系尊属1/3を均等分割
 * - 配偶者 + 兄弟姉妹: 配偶者3/4, 兄弟姉妹1/4を均等分割
 * - 子のみ: 均等分割
 * - 代襲相続・養子・非嫡出子等の複雑なケースは未対応
 */

interface HeirInput {
  relationship: string;
}

interface LegalShareResult {
  civilShareNum: number;
  civilShareDen: number;
  taxShareNum: number;
  taxShareDen: number;
  twentyPercentAdd: boolean;
}

const CHILD_RELATIONSHIPS = ["長男", "長女", "次男", "次女", "三男", "三女", "孫"];
const PARENT_RELATIONSHIPS = ["父", "母"];
const SIBLING_RELATIONSHIPS = ["兄弟姉妹", "甥姪"];

function isSpouse(rel: string): boolean {
  return rel === "配偶者";
}

function isChild(rel: string): boolean {
  return CHILD_RELATIONSHIPS.includes(rel);
}

function isParent(rel: string): boolean {
  return PARENT_RELATIONSHIPS.includes(rel);
}

function isSibling(rel: string): boolean {
  return SIBLING_RELATIONSHIPS.includes(rel);
}

/**
 * 最大公約数
 */
function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    [a, b] = [b, a % b];
  }
  return a;
}

/**
 * 分数を約分する
 */
function simplifyFraction(num: number, den: number): [number, number] {
  if (den === 0) return [0, 1];
  if (num === 0) return [0, 1];
  const g = gcd(num, den);
  return [num / g, den / g];
}

export function calculateLegalShares(heirs: HeirInput[]): LegalShareResult[] {
  const hasSpouse = heirs.some(h => isSpouse(h.relationship));
  const children = heirs.filter(h => isChild(h.relationship));
  const parents = heirs.filter(h => isParent(h.relationship));
  const siblings = heirs.filter(h => isSibling(h.relationship));
  const others = heirs.filter(h =>
    !isSpouse(h.relationship) && !isChild(h.relationship) &&
    !isParent(h.relationship) && !isSibling(h.relationship)
  );

  const results: LegalShareResult[] = [];

  for (const heir of heirs) {
    let civilShareNum = 0;
    let civilShareDen = 1;
    let twentyPercentAdd = false;

    if (isSpouse(heir.relationship)) {
      if (children.length > 0) {
        civilShareNum = 1;
        civilShareDen = 2;
      } else if (parents.length > 0) {
        civilShareNum = 2;
        civilShareDen = 3;
      } else if (siblings.length > 0) {
        civilShareNum = 3;
        civilShareDen = 4;
      } else {
        civilShareNum = 1;
        civilShareDen = 1;
      }
    } else if (isChild(heir.relationship)) {
      const childCount = children.length;
      if (hasSpouse) {
        // 1/2 を子の人数で分割
        civilShareNum = 1;
        civilShareDen = 2 * childCount;
      } else {
        civilShareNum = 1;
        civilShareDen = childCount;
      }
    } else if (isParent(heir.relationship)) {
      if (children.length === 0) {
        const parentCount = parents.length;
        if (hasSpouse) {
          civilShareNum = 1;
          civilShareDen = 3 * parentCount;
        } else {
          civilShareNum = 1;
          civilShareDen = parentCount;
        }
      }
    } else if (isSibling(heir.relationship)) {
      if (children.length === 0 && parents.length === 0) {
        const siblingCount = siblings.length;
        if (hasSpouse) {
          civilShareNum = 1;
          civilShareDen = 4 * siblingCount;
        } else {
          civilShareNum = 1;
          civilShareDen = siblingCount;
        }
        twentyPercentAdd = true;
      }
    } else {
      // その他: 仮仕様として2割加算対象, 相続分0
      twentyPercentAdd = true;
    }

    const [sNum, sDen] = simplifyFraction(civilShareNum, civilShareDen);

    results.push({
      civilShareNum: sNum,
      civilShareDen: sDen,
      // 仮仕様: 民法上＝税法上として同期
      taxShareNum: sNum,
      taxShareDen: sDen,
      twentyPercentAdd,
    });
  }

  return results;
}
