import type { JournalEntry } from './types'

const CSV_HEADERS = [
  '伝票日付',                    // 1
  '(借方)勘定科目コード',          // 2
  '(借方)勘定科目名称',           // 3
  '(借方)科目別補助コード',        // 4
  '(借方)科目別補助名称',         // 5
  '(借方)消費税売上/仕入区分',     // 6
  '(借方)業種コード',             // 7
  '(借方)税込/税抜区分',          // 8
  '(貸方)勘定科目コード',          // 9
  '(貸方)勘定科目名称',           // 10
  '(貸方)科目別補助コード',        // 11
  '(貸方)科目別補助名称',         // 12
  '(貸方)消費税売上/仕入区分',     // 13
  '(貸方)業種コード',             // 14
  '(貸方)税込/税抜区分',          // 15
  '消費税コード',                 // 16
  '消費税率',                    // 17
  '事業者取引区分',               // 18
  '金額(入力金額)',               // 19
  '摘要',                       // 20
]

function entryToRow(entry: JournalEntry): string[] {
  return [
    entry.date,                                           // 1 伝票日付
    entry.debitCode,                                      // 2 借方勘定科目コード
    entry.debitName,                                      // 3 借方勘定科目名称
    entry.debitSubCode,                                   // 4 借方科目別補助コード
    entry.debitSubName,                                   // 5 借方科目別補助名称
    entry.debitTaxType,                                   // 6 借方消費税売上/仕入区分
    entry.debitIndustry,                                  // 7 借方業種コード
    entry.debitTaxInclude,                                // 8 借方税込/税抜区分
    entry.creditCode,                                     // 9 貸方勘定科目コード
    entry.creditName,                                     // 10 貸方勘定科目名称
    entry.creditSubCode,                                  // 11 貸方科目別補助コード
    entry.creditSubName,                                  // 12 貸方科目別補助名称
    entry.creditTaxType,                                  // 13 貸方消費税売上/仕入区分
    entry.creditIndustry,                                 // 14 貸方業種コード
    entry.creditTaxInclude,                               // 15 貸方税込/税抜区分
    entry.debitTaxCode,                                   // 16 消費税コード
    entry.debitTaxRate,                                   // 17 消費税率
    entry.debitBusinessType,                              // 18 事業者取引区分
    entry.debitAmount ? String(entry.debitAmount) : '',    // 19 金額
    entry.description,                                    // 20 摘要
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
