import type { AccountItem, SubAccountItem } from './types'

const ACCOUNT_STORAGE_KEY = 'bank-statement-account-master'
const SUB_ACCOUNT_STORAGE_KEY = 'bank-statement-sub-account-master'

// --- 科目マスタ ---

export function loadAccountMaster(): AccountItem[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(ACCOUNT_STORAGE_KEY)
    if (stored) return JSON.parse(stored)
  } catch { /* ignore */ }
  return []
}

export function saveAccountMaster(items: AccountItem[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(items))
}

/**
 * 科目チェックリストTSV/CSVをパース
 * 列: コード, 正式科目名, 簡略科目名, 連想, ..., 正残区分, BS/PL区分, ...
 */
export function parseAccountMasterFile(text: string): AccountItem[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim())
  if (lines.length === 0) return []

  const delimiter = detectDelimiter(lines[0])
  const startIndex = isHeaderLine(lines[0], ['コード', '科目', 'code']) ? 1 : 0

  const items: AccountItem[] = []
  for (let i = startIndex; i < lines.length; i++) {
    const cells = splitLine(lines[i], delimiter)
    if (cells.length < 2) continue
    const code = cells[0].trim()
    if (!code || !/^\d+$/.test(code)) continue // コードが数字でない行はスキップ

    items.push({
      code,
      name: cells[1]?.trim() || '',
      shortName: cells[2]?.trim() || cells[1]?.trim() || '',
      association: cells[3]?.trim() || '',
      normalBalance: cells[8]?.trim() || '',
      bsPl: cells[9]?.trim() || '',
    })
  }
  return items
}

// --- 補助科目マスタ ---

export function loadSubAccountMaster(): SubAccountItem[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(SUB_ACCOUNT_STORAGE_KEY)
    if (stored) return JSON.parse(stored)
  } catch { /* ignore */ }
  return []
}

export function saveSubAccountMaster(items: SubAccountItem[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(SUB_ACCOUNT_STORAGE_KEY, JSON.stringify(items))
}

/**
 * 補助科目チェックリストTSV/CSVをパース
 * 列: 科目ｺｰﾄﾞ, 科目簡略名称, 科目別補助ｺｰﾄﾞ, 正式科目名, 簡略科目名, 連想, ...
 */
export function parseSubAccountMasterFile(text: string): SubAccountItem[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim())
  if (lines.length === 0) return []

  const delimiter = detectDelimiter(lines[0])
  const startIndex = isHeaderLine(lines[0], ['科目', 'ｺｰﾄﾞ', '補助', 'code']) ? 1 : 0

  const items: SubAccountItem[] = []
  for (let i = startIndex; i < lines.length; i++) {
    const cells = splitLine(lines[i], delimiter)
    if (cells.length < 4) continue
    const parentCode = cells[0].trim()
    if (!parentCode || !/^\d+$/.test(parentCode)) continue

    items.push({
      parentCode,
      parentName: cells[1]?.trim() || '',
      subCode: cells[2]?.trim() || '0',
      name: cells[3]?.trim() || '',
      shortName: cells[4]?.trim() || cells[3]?.trim() || '',
      association: cells[5]?.trim() || '',
    })
  }
  return items
}

// --- 検索 ---

export function searchAccounts(master: AccountItem[], query: string): AccountItem[] {
  if (!query) return master.slice(0, 20)
  const q = query.toLowerCase()
  return master
    .filter((item) =>
      item.code.includes(q) ||
      item.name.toLowerCase().includes(q) ||
      item.shortName.toLowerCase().includes(q) ||
      (item.association || '').toLowerCase().includes(q),
    )
    .slice(0, 15)
}

export function findAccountByCode(master: AccountItem[], code: string): AccountItem | undefined {
  return master.find((item) => item.code === code)
}

export function getSubAccountsForCode(subMaster: SubAccountItem[], parentCode: string): SubAccountItem[] {
  return subMaster.filter((item) => item.parentCode === parentCode)
}

// --- ユーティリティ ---

function detectDelimiter(line: string): string {
  const tabCount = (line.match(/\t/g) || []).length
  const commaCount = (line.match(/,/g) || []).length
  return tabCount >= commaCount ? '\t' : ','
}

function splitLine(line: string, delimiter: string): string[] {
  if (delimiter === '\t') return line.split('\t')
  // CSV: ダブルクォート対応
  const cells: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++ }
      else if (ch === '"') inQuotes = false
      else current += ch
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === ',') { cells.push(current); current = '' }
      else current += ch
    }
  }
  cells.push(current)
  return cells
}

function isHeaderLine(line: string, keywords: string[]): boolean {
  const lower = line.toLowerCase()
  return keywords.some((k) => lower.includes(k.toLowerCase()))
}
