import type { PatternEntry } from './types'

const STORAGE_KEY = 'bank-statement-patterns'

export function getPatterns(): PatternEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored)
  } catch { /* ignore */ }
  return []
}

export function savePatterns(patterns: PatternEntry[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(patterns))
}

/**
 * 摘要キーワードからパターンを検索する
 */
export function findPattern(
  patterns: PatternEntry[],
  description: string,
): PatternEntry | null {
  if (!description) return null
  const desc = description.toLowerCase()

  // 完全一致
  const exact = patterns
    .filter((p) => p.keyword.toLowerCase() === desc)
    .sort((a, b) => b.useCount - a.useCount)
  if (exact.length > 0) return exact[0]

  // 部分一致
  const partial = patterns
    .filter((p) =>
      desc.includes(p.keyword.toLowerCase()) ||
      p.keyword.toLowerCase().includes(desc),
    )
    .sort((a, b) => b.useCount - a.useCount)
  if (partial.length > 0) return partial[0]

  return null
}

/**
 * パターン学習
 * originalDescription: 通帳から読み取った元の摘要
 * convertedDescription: ユーザーが修正した後の摘要
 */
export function learnPattern(
  originalDescription: string,
  convertedDescription: string,
  debitCode: string,
  debitName: string,
  creditCode: string,
  creditName: string,
  taxCode: string,
  taxCategory: string,
  businessType: string,
): void {
  const patterns = getPatterns()
  const existing = patterns.find(
    (p) => p.keyword.toLowerCase() === originalDescription.toLowerCase(),
  )

  if (existing) {
    existing.useCount++
    existing.convertedDescription = convertedDescription
    existing.debitCode = debitCode
    existing.debitName = debitName
    existing.creditCode = creditCode
    existing.creditName = creditName
    existing.taxCode = taxCode
    existing.taxCategory = taxCategory
    existing.businessType = businessType
  } else {
    patterns.push({
      keyword: originalDescription,
      convertedDescription,
      debitCode,
      debitName,
      creditCode,
      creditName,
      taxCode,
      taxCategory,
      businessType,
      useCount: 1,
    })
  }

  savePatterns(patterns)
}

export function clearPatterns(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}

/**
 * パターンをJSON文字列としてエクスポート
 */
export function exportPatterns(): string {
  return JSON.stringify(getPatterns(), null, 2)
}

/**
 * パターンをJSONからインポート
 */
export function importPatterns(json: string): number {
  const imported: PatternEntry[] = JSON.parse(json)
  if (!Array.isArray(imported)) return 0
  savePatterns(imported)
  return imported.length
}
