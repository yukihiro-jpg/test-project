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

/**
 * 複合仕訳の最終行の金額を997貸借一致で自動計算して適用する
 * CSV出力前、学習前に呼び出して金額を確定する
 */
export function applyCompoundAutoAmounts(entries: JournalEntry[]): JournalEntry[] {
  // グループ化
  const groupMembers: Record<string, JournalEntry[]> = {}
  for (const e of entries) {
    const hasChildren = entries.some((c) => c.parentId === e.id)
    const groupKey = e.parentId || (hasChildren ? e.id : null)
    if (groupKey) {
      if (!groupMembers[groupKey]) groupMembers[groupKey] = []
      groupMembers[groupKey].push(e)
    }
  }

  // 最終行の金額を自動計算して反映
  const updatedIds = new Map<string, number>()
  for (const [, members] of Object.entries(groupMembers)) {
    if (members.length === 0) continue
    const lastEntry = members[members.length - 1]

    let debit997Total = 0
    let credit997Total = 0
    for (const m of members) {
      if (m.id === lastEntry.id) continue
      const amt = m.debitAmount || m.creditAmount || 0
      if (m.debitCode === '997') debit997Total += amt
      if (m.creditCode === '997') credit997Total += amt
    }

    let autoAmount = 0
    if (lastEntry.debitCode === '997') {
      autoAmount = credit997Total - debit997Total
    } else if (lastEntry.creditCode === '997') {
      autoAmount = debit997Total - credit997Total
    }

    if (autoAmount !== 0) {
      updatedIds.set(lastEntry.id, autoAmount)
    }
  }

  // 新しいentries配列を返す
  return entries.map((e) => {
    const autoAmount = updatedIds.get(e.id)
    if (autoAmount != null) {
      return { ...e, debitAmount: autoAmount, creditAmount: autoAmount }
    }
    return e
  })
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
  // 複合仕訳の997自動計算金額を反映してからCSV化
  const appliedEntries = applyCompoundAutoAmounts(entries)
  const csvContent = generateCsv(appliedEntries)

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
