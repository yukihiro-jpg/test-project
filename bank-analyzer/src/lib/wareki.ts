type Era = { name: string; start: Date }

const ERAS: Era[] = [
  { name: '令和', start: new Date(2019, 4, 1) },
  { name: '平成', start: new Date(1989, 0, 8) },
  { name: '昭和', start: new Date(1926, 11, 25) },
  { name: '大正', start: new Date(1912, 6, 30) },
  { name: '明治', start: new Date(1868, 0, 25) }
]

// 解析対象とする最古の年（西暦）。これより前は 2桁年表記でも採用しない。
// 平成20年 = 2008年 を既定の下限とする（環境変数で上書き可）。
const MIN_YEAR =
  typeof process !== 'undefined' && process.env?.PASSBOOK_MIN_YEAR
    ? Number(process.env.PASSBOOK_MIN_YEAR) || 2008
    : 2008

export function toWareki(input: string | Date): string {
  const date = typeof input === 'string' ? parseLooseDate(input) : input
  if (!date || isNaN(date.getTime())) return typeof input === 'string' ? input : ''

  for (const era of ERAS) {
    if (date.getTime() >= era.start.getTime()) {
      const year = date.getFullYear() - era.start.getFullYear() + 1
      const yearStr = year === 1 ? '元' : String(year)
      return `${era.name}${yearStr}年${date.getMonth() + 1}月${date.getDate()}日`
    }
  }
  return date.toLocaleDateString('ja-JP')
}

export function toWarekiShort(input: string | Date): string {
  const date = typeof input === 'string' ? parseLooseDate(input) : input
  if (!date || isNaN(date.getTime())) return typeof input === 'string' ? input : ''

  for (const era of ERAS) {
    if (date.getTime() >= era.start.getTime()) {
      const initial = era.name === '令和' ? 'R' : era.name === '平成' ? 'H' : era.name === '昭和' ? 'S' : era.name === '大正' ? 'T' : 'M'
      const year = date.getFullYear() - era.start.getFullYear() + 1
      const m = String(date.getMonth() + 1).padStart(2, '0')
      const d = String(date.getDate()).padStart(2, '0')
      return `${initial}${year}.${m}.${d}`
    }
  }
  return date.toLocaleDateString('ja-JP')
}

export function parseLooseDate(input: string, opts?: { rangeStart?: string; rangeEnd?: string }): Date | null {
  if (!input) return null
  const trimmed = input.trim()

  const warekiMatch = trimmed.match(/^(令和|平成|昭和|大正|明治|R|H|S|T|M)\s*(元|\d+)[年.\-/]\s*(\d+)[月.\-/]\s*(\d+)/)
  if (warekiMatch) {
    const eraKey = warekiMatch[1]
    const eraName =
      eraKey === 'R' ? '令和' : eraKey === 'H' ? '平成' : eraKey === 'S' ? '昭和' : eraKey === 'T' ? '大正' : eraKey === 'M' ? '明治' : eraKey
    const era = ERAS.find((e) => e.name === eraName)
    if (era) {
      const yearOffset = warekiMatch[2] === '元' ? 1 : Number(warekiMatch[2])
      const year = era.start.getFullYear() + yearOffset - 1
      const month = Number(warekiMatch[3]) - 1
      const day = Number(warekiMatch[4])
      return new Date(year, month, day)
    }
  }

  const isoMatch = trimmed.match(/^(\d{4})[\-/.年]\s*(\d{1,2})[\-/.月]\s*(\d{1,2})/)
  if (isoMatch) {
    return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]))
  }

  const twoDigitMatch = trimmed.match(/^(\d{1,2})[\-/.年]\s*(\d{1,2})[\-/.月]\s*(\d{1,2})/)
  if (twoDigitMatch) {
    const yy = Number(twoDigitMatch[1])
    const mm = Number(twoDigitMatch[2]) - 1
    const dd = Number(twoDigitMatch[3])
    const rangeStart = opts?.rangeStart ? new Date(opts.rangeStart) : null
    const rangeEnd = opts?.rangeEnd ? new Date(opts.rangeEnd) : null

    const candidates: Date[] = []
    for (const era of ERAS) {
      const year = era.start.getFullYear() + yy - 1
      // 平成20年(2008)未満や昭和以前は解析対象外（OCR誤読の温床になるため）
      if (year < MIN_YEAR) continue
      const cand = new Date(year, mm, dd)
      if (cand.getTime() >= era.start.getTime()) candidates.push(cand)
    }

    if (rangeStart && rangeEnd && !isNaN(rangeStart.getTime()) && !isNaN(rangeEnd.getTime())) {
      const inRange = candidates.find(
        (c) => c.getTime() >= rangeStart.getTime() && c.getTime() <= rangeEnd.getTime()
      )
      if (inRange) return inRange
    }

    return candidates[0] || null
  }

  const fallback = new Date(trimmed)
  return isNaN(fallback.getTime()) ? null : fallback
}

export function toIsoDate(input: string | Date): string {
  const date = typeof input === 'string' ? parseLooseDate(input) : input
  if (!date || isNaN(date.getTime())) return ''
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
