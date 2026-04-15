/**
 * MJS会計大将「推移試算表」CSV パーサー
 *
 * 期待するフォーマット：
 *   帳票種別,コード,科目,当月迄累計/金額,当月迄累計/構成比,
 *   月次推移/9月,月次推移/10月,...,月次推移/8月
 *
 * 月の並びは期首月始まり（決算月が8月なら 9月スタート）
 * 未到来月は 0 で埋められる
 */

export interface TransitionRow {
  reportType: 'BS' | 'PL'
  accountCode: string
  accountName: string
  cumulativeAmount: number
  cumulativeRatio?: number
  monthlyAmounts: MonthlyAmount[]        // 各月の金額（期首から順）
}

export interface MonthlyAmount {
  month: number                          // 1-12
  amount: number
}

export interface TransitionParseResult {
  rows: TransitionRow[]
  fiscalYearStartMonth: number            // ヘッダから推定される期首月
  warnings: string[]
}

export function parseTransition(csvText: string): TransitionParseResult {
  const rows: TransitionRow[] = []
  const warnings: string[] = []

  const lines = csvText.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length === 0) {
    return { rows, fiscalYearStartMonth: 1, warnings: ['CSVが空です'] }
  }

  // ヘッダから月の並びを解析
  const header = parseCsvLine(lines[0])
  const monthlyColumns: { colIndex: number; month: number }[] = []
  header.forEach((h, idx) => {
    const m = h.match(/月次推移\/(\d+)月/)
    if (m) {
      monthlyColumns.push({ colIndex: idx, month: parseInt(m[1], 10) })
    }
  })

  const fiscalYearStartMonth = monthlyColumns[0]?.month ?? 1

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i])
    if (cols.length < 5) continue

    const reportTypeStr = cols[0]
    const reportType =
      reportTypeStr === '貸借対照表' ? 'BS' : reportTypeStr === '損益計算書' ? 'PL' : null
    if (!reportType) continue

    const monthlyAmounts: MonthlyAmount[] = monthlyColumns.map(({ colIndex, month }) => ({
      month,
      amount: parseNumber(cols[colIndex]),
    }))

    rows.push({
      reportType,
      accountCode: cols[1].trim(),
      accountName: cols[2].trim(),
      cumulativeAmount: parseNumber(cols[3]),
      cumulativeRatio: cols[4]?.trim() ? parseFloat(cols[4]) : undefined,
      monthlyAmounts,
    })
  }

  return { rows, fiscalYearStartMonth, warnings }
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
