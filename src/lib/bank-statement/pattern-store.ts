import type { PatternEntry, PatternLine, JournalEntry } from './types'

const STORAGE_KEY = 'bank-statement-patterns'

let idCounter = 0
function generatePatternId(): string {
  return `pat-${Date.now()}-${++idCounter}`
}

export function getPatterns(): PatternEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      // 旧形式からの変換
      return parsed.map((p: PatternEntry) => {
        if (!p.id) p.id = generatePatternId()
        if (!p.lines) {
          p.lines = [{
            debitCode: p.debitCode || '',
            debitName: p.debitName || '',
            creditCode: p.creditCode || '',
            creditName: p.creditName || '',
            taxCode: p.taxCode || '',
            taxCategory: p.taxCategory || '',
            businessType: p.businessType || '',
            description: p.convertedDescription || '',
            amount: 0,
          }]
        }
        // 旧データでamountが無い行に0を設定
        p.lines = p.lines.map((l) => ({ ...l, amount: l.amount ?? 0 }))
        if (p.amountMin === undefined) p.amountMin = null
        if (p.amountMax === undefined) p.amountMax = null
        return p
      })
    }
  } catch { /* ignore */ }
  return []
}

export function savePatterns(patterns: PatternEntry[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(patterns))
}

/**
 * 摘要と金額からパターンを検索
 */
export function findPattern(
  patterns: PatternEntry[],
  description: string,
  amount?: number,
): PatternEntry | null {
  if (!description) return null
  const desc = description.toLowerCase()

  // 完全一致 + 金額範囲チェック
  const matches = patterns
    .filter((p) => {
      const keyMatch = p.keyword.toLowerCase() === desc ||
        desc.includes(p.keyword.toLowerCase()) ||
        p.keyword.toLowerCase().includes(desc)
      if (!keyMatch) return false
      // 金額範囲チェック
      if (amount != null) {
        if (p.amountMin != null && amount < p.amountMin) return false
        if (p.amountMax != null && amount > p.amountMax) return false
      }
      return true
    })
    .sort((a, b) => {
      // 完全一致を優先
      const aExact = a.keyword.toLowerCase() === desc ? 1 : 0
      const bExact = b.keyword.toLowerCase() === desc ? 1 : 0
      if (aExact !== bExact) return bExact - aExact
      // 金額範囲が狭い方を優先（より具体的）
      const aRange = (a.amountMax ?? Infinity) - (a.amountMin ?? 0)
      const bRange = (b.amountMax ?? Infinity) - (b.amountMin ?? 0)
      if (aRange !== bRange) return aRange - bRange
      return b.useCount - a.useCount
    })

  return matches.length > 0 ? matches[0] : null
}

/**
 * 仕訳行からパターンを学習（金額範囲指定版）
 */
export function learnFromEntriesWithRange(
  originalDescription: string,
  entries: JournalEntry[],
  amountMin: number | null,
  amountMax: number | null,
): string {
  if (!originalDescription || entries.length === 0) return ''

  const patterns = getPatterns()
  const lines: PatternLine[] = entries.map((e) => ({
    debitCode: e.debitCode,
    debitName: e.debitName,
    creditCode: e.creditCode,
    creditName: e.creditName,
    taxCode: e.debitTaxCode,
    taxCategory: e.debitTaxType,
    businessType: e.debitBusinessType,
    description: e.description,
    amount: e.debitAmount || e.creditAmount || 0,
  }))

  // 同じキーワード+金額範囲のパターンがあれば更新、なければ新規
  const existing = patterns.find(
    (p) => p.keyword.toLowerCase() === originalDescription.toLowerCase() &&
      p.amountMin === amountMin && p.amountMax === amountMax,
  )

  if (existing) {
    existing.useCount++
    existing.lines = lines
    savePatterns(patterns)
    return existing.id
  } else {
    const id = generatePatternId()
    patterns.push({
      id,
      keyword: originalDescription,
      amountMin,
      amountMax,
      lines,
      useCount: 1,
    })
    savePatterns(patterns)
    return id
  }
}

/**
 * 仕訳行からパターンを学習（1行 or 複合仕訳の複数行）
 */
export function learnFromEntries(
  originalDescription: string,
  entries: JournalEntry[],
  amount: number,
): void {
  if (!originalDescription || entries.length === 0) return

  const patterns = getPatterns()

  const lines: PatternLine[] = entries.map((e) => ({
    debitCode: e.debitCode,
    debitName: e.debitName,
    creditCode: e.creditCode,
    creditName: e.creditName,
    taxCode: e.debitTaxCode,
    taxCategory: e.debitTaxType,
    businessType: e.debitBusinessType,
    description: e.description,
    amount: e.debitAmount || e.creditAmount || 0,
  }))

  // 同じキーワードで金額範囲が重なるパターンがあれば更新
  const existing = patterns.find(
    (p) => p.keyword.toLowerCase() === originalDescription.toLowerCase() &&
      isAmountInRange(amount, p.amountMin, p.amountMax),
  )

  if (existing) {
    existing.useCount++
    existing.lines = lines
  } else {
    patterns.push({
      id: generatePatternId(),
      keyword: originalDescription,
      amountMin: null,
      amountMax: null,
      lines,
      useCount: 1,
    })
  }

  savePatterns(patterns)
}

/**
 * CSV出力時に全仕訳を一括パターン学習
 */
export function learnAllFromEntries(entries: JournalEntry[]): number {
  let learnedCount = 0

  // transactionIdでグループ化（複合仕訳対応）
  const groups: Record<string, JournalEntry[]> = {}
  for (const e of entries) {
    const groupId = e.parentId || e.id
    if (!groups[groupId]) groups[groupId] = []
    groups[groupId].push(e)
  }

  for (const [, group] of Object.entries(groups)) {
    const primary = group[0]
    const originalDesc = primary.originalDescription
    if (!originalDesc) continue
    const amount = primary.debitAmount || primary.creditAmount || 0

    learnFromEntries(originalDesc, group, amount)
    learnedCount++
  }

  return learnedCount
}

// 旧互換: learnPattern関数
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

  const line: PatternLine = {
    debitCode, debitName, creditCode, creditName,
    taxCode, taxCategory, businessType,
    description: convertedDescription,
    amount: 0,
  }

  if (existing) {
    existing.useCount++
    existing.lines = [line]
  } else {
    patterns.push({
      id: generatePatternId(),
      keyword: originalDescription,
      amountMin: null,
      amountMax: null,
      lines: [line],
      useCount: 1,
    })
  }

  savePatterns(patterns)
}

export function deletePattern(id: string): void {
  const patterns = getPatterns().filter((p) => p.id !== id)
  savePatterns(patterns)
}

export function updatePatternAmountRange(
  id: string,
  amountMin: number | null,
  amountMax: number | null,
): void {
  const patterns = getPatterns()
  const p = patterns.find((p) => p.id === id)
  if (p) {
    p.amountMin = amountMin
    p.amountMax = amountMax
    savePatterns(patterns)
  }
}

export function clearPatterns(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}

export function exportPatterns(): string {
  return JSON.stringify(getPatterns(), null, 2)
}

export function importPatterns(json: string): number {
  const imported: PatternEntry[] = JSON.parse(json)
  if (!Array.isArray(imported)) return 0
  savePatterns(imported)
  return imported.length
}

function isAmountInRange(amount: number, min: number | null, max: number | null): boolean {
  if (min != null && amount < min) return false
  if (max != null && amount > max) return false
  return true
}
