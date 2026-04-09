import type { PatternEntry } from './types'

const STORAGE_KEY = 'bank-statement-patterns'

export function getPatterns(): PatternEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored)
  } catch {
    // ignore
  }
  return []
}

export function savePatterns(patterns: PatternEntry[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(patterns))
}

/**
 * 摘要キーワードからパターンを検索する
 * 完全一致 > 部分一致 の優先度で、使用回数が多いものを優先
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

  // 部分一致（摘要にキーワードが含まれる）
  const partial = patterns
    .filter(
      (p) =>
        desc.includes(p.keyword.toLowerCase()) ||
        p.keyword.toLowerCase().includes(desc),
    )
    .sort((a, b) => b.useCount - a.useCount)
  if (partial.length > 0) return partial[0]

  return null
}

/**
 * 新しいパターンを保存する（既存パターンがあればuse countを更新）
 */
export function learnPattern(
  keyword: string,
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
    (p) =>
      p.keyword.toLowerCase() === keyword.toLowerCase() &&
      p.debitCode === debitCode &&
      p.creditCode === creditCode,
  )

  if (existing) {
    existing.useCount++
    existing.debitName = debitName
    existing.creditName = creditName
    existing.taxCode = taxCode
    existing.taxCategory = taxCategory
    existing.businessType = businessType
  } else {
    patterns.push({
      keyword,
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

/**
 * パターンを全削除
 */
export function clearPatterns(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}
