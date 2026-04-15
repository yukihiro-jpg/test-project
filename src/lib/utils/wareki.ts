/**
 * 和暦⇔西暦変換ユーティリティ
 *
 * MJS会計大将のCSVでは伝票日付が和暦（R07/09/01 など）で出力されるため、
 * パース時に西暦に変換する必要があります。
 */

const ERA_MAP: Record<string, number> = {
  R: 2018, // 令和元年 = 2019年 なので 2018 + N年
  H: 1988, // 平成元年 = 1989年 なので 1988 + N年
  S: 1925, // 昭和元年 = 1926年 なので 1925 + N年
  T: 1911, // 大正元年 = 1912年 なので 1911 + N年
  M: 1867, // 明治元年 = 1868年 なので 1867 + N年
}

/**
 * 和暦文字列を Date に変換
 * @param wareki 例: "R07/09/01"
 * @returns Date オブジェクト、解析失敗時は null
 */
export function parseWareki(wareki: string): Date | null {
  const trimmed = wareki.trim()
  const match = trimmed.match(/^([RHSTM])(\d+)\/(\d{1,2})\/(\d{1,2})$/)
  if (!match) return null

  const [, era, yearStr, monthStr, dayStr] = match
  const baseYear = ERA_MAP[era]
  if (baseYear === undefined) return null

  const year = baseYear + parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)
  const day = parseInt(dayStr, 10)

  if (month < 1 || month > 12 || day < 1 || day > 31) return null

  const date = new Date(year, month - 1, day)
  // 不正な日付（2月30日など）の検知
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null
  }
  return date
}

/**
 * Date を和暦文字列に変換
 * @param date 日付
 * @returns 例: "R07/09/01"
 */
export function formatWareki(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  if (year >= 2019) {
    return `R${String(year - 2018).padStart(2, '0')}/${month}/${day}`
  } else if (year >= 1989) {
    return `H${String(year - 1988).padStart(2, '0')}/${month}/${day}`
  } else if (year >= 1926) {
    return `S${String(year - 1925).padStart(2, '0')}/${month}/${day}`
  }
  return date.toISOString().split('T')[0]
}
