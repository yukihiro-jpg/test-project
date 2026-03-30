// 和暦⇔西暦変換ユーティリティ

interface EraDefinition {
  name: string;
  shortName: string;
  startDate: Date;
  startYear: number;
}

const ERAS: EraDefinition[] = [
  { name: '令和', shortName: 'R', startDate: new Date(2019, 4, 1), startYear: 2019 },
  { name: '平成', shortName: 'H', startDate: new Date(1989, 0, 8), startYear: 1989 },
  { name: '昭和', shortName: 'S', startDate: new Date(1926, 11, 25), startYear: 1926 },
  { name: '大正', shortName: 'T', startDate: new Date(1912, 6, 30), startYear: 1912 },
  { name: '明治', shortName: 'M', startDate: new Date(1868, 0, 25), startYear: 1868 },
];

/**
 * 西暦日付から和暦文字列を生成
 * @param dateStr YYYY-MM-DD形式
 * @returns 例: "令和6年1月15日"
 */
export function toWareki(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return '';

  const date = new Date(year, month - 1, day);

  for (const era of ERAS) {
    if (date >= era.startDate) {
      const eraYear = year - era.startYear + 1;
      const eraYearStr = eraYear === 1 ? '元' : String(eraYear);
      return `${era.name}${eraYearStr}年${month}月${day}日`;
    }
  }
  return `${year}年${month}月${day}日`;
}

/**
 * 和暦文字列から西暦日付を生成
 * @param wareki 例: "令和6年1月15日" or "R6.1.15"
 * @returns YYYY-MM-DD形式
 */
export function fromWareki(wareki: string): string {
  if (!wareki) return '';

  // "令和6年1月15日" パターン
  const fullMatch = wareki.match(/^(明治|大正|昭和|平成|令和)(元|\d+)年(\d+)月(\d+)日$/);
  if (fullMatch) {
    const [, eraName, eraYearStr, month, day] = fullMatch;
    const era = ERAS.find(e => e.name === eraName);
    if (!era) return '';
    const eraYear = eraYearStr === '元' ? 1 : parseInt(eraYearStr);
    const year = era.startYear + eraYear - 1;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // "R6.1.15" パターン
  const shortMatch = wareki.match(/^([MTSHR])(\d+)\.(\d+)\.(\d+)$/);
  if (shortMatch) {
    const [, shortName, eraYearStr, month, day] = shortMatch;
    const era = ERAS.find(e => e.shortName === shortName);
    if (!era) return '';
    const year = era.startYear + parseInt(eraYearStr) - 1;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  return '';
}

/**
 * 基準日時点の年齢を計算
 */
export function calculateAge(birthDateStr: string, referenceDateStr: string): number {
  if (!birthDateStr || !referenceDateStr) return 0;
  const [by, bm, bd] = birthDateStr.split('-').map(Number);
  const [ry, rm, rd] = referenceDateStr.split('-').map(Number);

  let age = ry - by;
  if (rm < bm || (rm === bm && rd < bd)) {
    age--;
  }
  return Math.max(0, age);
}

/**
 * 和暦の元号一覧を取得
 */
export function getEraList(): { name: string; shortName: string }[] {
  return ERAS.map(e => ({ name: e.name, shortName: e.shortName }));
}

/**
 * 日付文字列のバリデーション
 */
export function isValidDate(dateStr: string): boolean {
  if (!dateStr) return false;
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return false;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}
