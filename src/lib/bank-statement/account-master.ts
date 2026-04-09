import type { AccountItem } from './types'

const STORAGE_KEY = 'bank-statement-account-master'

export function loadAccountMaster(): AccountItem[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored)
  } catch {
    // ignore
  }
  return []
}

export function saveAccountMaster(items: AccountItem[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

export function parseAccountMasterCsv(csvText: string): AccountItem[] {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim())
  if (lines.length === 0) return []

  // ヘッダー行をスキップ（最初の行がヘッダーかどうか判定）
  const firstLine = lines[0]
  const isHeader =
    firstLine.includes('コード') ||
    firstLine.includes('科目') ||
    firstLine.includes('code') ||
    firstLine.includes('name')
  const startIndex = isHeader ? 1 : 0

  const items: AccountItem[] = []
  for (let i = startIndex; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i])
    if (cells.length >= 2) {
      items.push({
        code: cells[0].trim(),
        name: cells[1].trim(),
        subCode: cells[2]?.trim() || '',
        subName: cells[3]?.trim() || '',
        taxCode: cells[4]?.trim() || '',
        taxCategory: cells[5]?.trim() || '',
      })
    }
  }
  return items
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        cells.push(current)
        current = ''
      } else {
        current += ch
      }
    }
  }
  cells.push(current)
  return cells
}

export function findAccountByCode(
  master: AccountItem[],
  code: string,
): AccountItem | undefined {
  return master.find((item) => item.code === code)
}

export function searchAccounts(
  master: AccountItem[],
  query: string,
): AccountItem[] {
  if (!query) return master
  const lower = query.toLowerCase()
  return master.filter(
    (item) =>
      item.code.includes(lower) ||
      item.name.toLowerCase().includes(lower),
  )
}
