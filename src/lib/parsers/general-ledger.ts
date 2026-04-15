/**
 * MJS会計大将「総勘定元帳」CSV パーサー
 *
 * 特徴：
 * - 1列目に "CODE 科目名" の勘定科目ヘッダ行が現れ、以降の仕訳がその科目に属する
 * - 月計行（摘要が "※※月計※※"）は集計値として別扱い
 * - 前期より繰越行は期首残高として取り込む
 * - 複合仕訳（相手科目 997）は仕訳の中継科目
 * - 消費税仕訳（相手科目 8000/8001）は自動起票
 * - 日付は和暦（R07/09/01 等）
 */

import { parseWareki } from '../utils/wareki'

export interface LedgerEntry {
  accountCode: string               // 現在処理中の勘定科目コード
  accountName: string
  searchNo?: string
  voucherNo?: string
  date: Date
  counterAccountCode: string
  counterAccountName: string
  description: string
  taxCode?: string
  taxRate?: number
  debit: number
  credit: number
  balance: number                   // 差引金額（当該科目の累計残高）
  isReducedTaxRate: boolean         // 税率区分の # で判定
}

export interface LedgerMonthlyTotal {
  accountCode: string
  accountName: string
  yearMonth: string                 // "2025-09" 形式
  debit: number
  credit: number
}

export interface LedgerOpeningBalance {
  accountCode: string
  accountName: string
  balance: number
}

export interface GeneralLedgerParseResult {
  entries: LedgerEntry[]
  monthlyTotals: LedgerMonthlyTotal[]
  openingBalances: LedgerOpeningBalance[]
  warnings: string[]
}

export function parseGeneralLedger(csvText: string): GeneralLedgerParseResult {
  const entries: LedgerEntry[] = []
  const monthlyTotals: LedgerMonthlyTotal[] = []
  const openingBalances: LedgerOpeningBalance[] = []
  const warnings: string[] = []

  const lines = csvText.split(/\r?\n/)
  let currentAccountCode = ''
  let currentAccountName = ''
  let currentYearMonth = ''

  for (let i = 1; i < lines.length; i++) {
    // ヘッダ行（1行目）はスキップ済み
    const line = lines[i]
    if (!line.trim()) continue

    const cols = parseCsvLine(line)

    // 勘定科目ヘッダ行の検出：1列目が "CODE SPACE 科目名" パターン
    const headerMatch = cols[0]?.trim().match(/^(\d+)\s+(.+)$/)
    if (headerMatch) {
      currentAccountCode = headerMatch[1]
      currentAccountName = headerMatch[2].trim()

      // 前期より繰越行の処理（同じ行に "前期より繰越" と残高が入っている）
      const description = cols[6]?.trim() ?? ''
      if (description === '前期より繰越') {
        openingBalances.push({
          accountCode: currentAccountCode,
          accountName: currentAccountName,
          balance: parseNumber(cols[11]),
        })
      }
      continue
    }

    const description = cols[6]?.trim() ?? ''

    // 月計行の検出
    if (description === '※※月計※※') {
      if (currentYearMonth) {
        monthlyTotals.push({
          accountCode: currentAccountCode,
          accountName: currentAccountName,
          yearMonth: currentYearMonth,
          debit: parseNumber(cols[9]),
          credit: parseNumber(cols[10]),
        })
      }
      continue
    }

    // 通常仕訳
    const dateStr = cols[3]?.trim()
    if (!dateStr) continue

    const date = parseWareki(dateStr)
    if (!date) {
      warnings.push(`日付パース失敗: ${dateStr}（行 ${i + 1}）`)
      continue
    }
    currentYearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

    entries.push({
      accountCode: currentAccountCode,
      accountName: currentAccountName,
      searchNo: cols[1]?.trim() || undefined,
      voucherNo: cols[2]?.trim() || undefined,
      date,
      counterAccountCode: cols[4]?.trim() ?? '',
      counterAccountName: cols[5]?.trim() ?? '',
      description,
      taxCode: cols[7]?.trim() || undefined,
      taxRate: cols[8]?.trim() ? parseFloat(cols[8]) : undefined,
      debit: parseNumber(cols[9]),
      credit: parseNumber(cols[10]),
      balance: parseNumber(cols[11]),
      isReducedTaxRate: cols[12]?.trim() === '#',
    })
  }

  return { entries, monthlyTotals, openingBalances, warnings }
}

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result
}

function parseNumber(s: string | undefined): number {
  if (!s) return 0
  const trimmed = s.trim().replace(/,/g, '')
  if (!trimmed) return 0
  const n = Number(trimmed)
  return isNaN(n) ? 0 : n
}
