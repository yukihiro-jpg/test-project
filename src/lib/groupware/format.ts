/** 和暦・金額などの表示ユーティリティ */

export function formatDateJP(iso?: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return `${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`
}

export function formatDateWareki(iso?: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  // 令和 = 2019-05-01 以降
  if (y > 2019 || (y === 2019 && m >= 5)) {
    const reiwa = y - 2018
    return `令和${reiwa}.${m}.${d}`
  }
  return `${y}/${m}/${d}`
}

export function formatYen(n?: number): string {
  if (n === undefined || n === null || isNaN(n)) return ''
  return `¥${n.toLocaleString('ja-JP')}`
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}
