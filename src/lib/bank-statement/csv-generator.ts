import type { JournalEntry } from './types'

const CSV_HEADERS = [
  '伝票日付',
  '借方科目コード',
  '借方科目名',
  '借方補助コード',
  '借方補助名',
  '借方税売仕区分',
  '借方業種',
  '借方税込抜区分',
  '借方金額',
  '借方消費税額',
  '借方税コード',
  '借方税率',
  '借方事業者区分',
  '貸方科目コード',
  '貸方科目名',
  '貸方補助コード',
  '貸方補助名',
  '貸方税売仕区分',
  '貸方業種',
  '貸方税込抜区分',
  '貸方金額',
  '貸方消費税額',
  '貸方税コード',
  '貸方税率',
  '貸方事業者区分',
  '摘要',
]

function entryToRow(entry: JournalEntry): string[] {
  return [
    entry.date,
    entry.debitCode,
    entry.debitName,
    entry.debitSubCode,
    entry.debitSubName,
    entry.debitTaxType,
    entry.debitIndustry,
    entry.debitTaxInclude,
    entry.debitAmount ? String(entry.debitAmount) : '',
    entry.debitTaxAmount ? String(entry.debitTaxAmount) : '',
    entry.debitTaxCode,
    entry.debitTaxRate,
    entry.debitBusinessType,
    entry.creditCode,
    entry.creditName,
    entry.creditSubCode,
    entry.creditSubName,
    entry.creditTaxType,
    entry.creditIndustry,
    entry.creditTaxInclude,
    entry.creditAmount ? String(entry.creditAmount) : '',
    entry.creditTaxAmount ? String(entry.creditTaxAmount) : '',
    entry.creditTaxCode,
    entry.creditTaxRate,
    entry.creditBusinessType,
    entry.description,
  ]
}

function escapeCsvField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`
  }
  return field
}

export function generateCsv(entries: JournalEntry[]): string {
  const lines: string[] = []

  // ヘッダー行
  lines.push(CSV_HEADERS.map(escapeCsvField).join(','))

  // データ行
  for (const entry of entries) {
    const row = entryToRow(entry)
    lines.push(row.map(escapeCsvField).join(','))
  }

  return lines.join('\r\n')
}

export function downloadCsv(entries: JournalEntry[], fileName?: string): void {
  const csvContent = generateCsv(entries)

  // UTF-8 BOM付き（Excel互換）
  const bom = '\uFEFF'
  const blob = new Blob([bom + csvContent], {
    type: 'text/csv;charset=utf-8',
  })

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName || `仕訳データ_${formatDateForFileName()}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function formatDateForFileName(): string {
  const now = new Date()
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
}
