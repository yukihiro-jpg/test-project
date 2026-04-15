/**
 * MJS会計大将「3期比較推移表」CSV パーサー
 *
 * 期待するフォーマット：
 *   タイトル,科目コード,科目名称,
 *   前々期月次実績(A)金額,(A)構成比,
 *   前期月次実績(B)金額,(B)構成比,
 *   当期月次実績(C)金額,(C)構成比,
 *   (B)-(A)増減額,(B)/(A)比率,
 *   (C)-(B)増減額,(C)/(B)比率,
 *   前々期累計実績金額,(A)構成比,
 *   前期累計実績金額,(B)構成比,
 *   当期累計実績金額,(C)構成比
 *
 * 注意点：
 * - `****` は比率計算不能（分母0等）→ undefined として扱う
 * - 比率列の空欄も undefined
 */

export interface ThreePeriodRow {
  reportType: 'BS' | 'PL'
  accountCode: string
  accountName: string
  // 月次
  monthly: {
    twoYearsAgo: PeriodValue
    lastYear: PeriodValue
    current: PeriodValue
    lastYearVsTwoAgoDiff: number
    lastYearVsTwoAgoRatio?: number
    currentVsLastYearDiff: number
    currentVsLastYearRatio?: number
  }
  // 累計
  cumulative: {
    twoYearsAgo: PeriodValue
    lastYear: PeriodValue
    current: PeriodValue
  }
}

export interface PeriodValue {
  amount: number
  ratio?: number
}

export interface ThreePeriodParseResult {
  rows: ThreePeriodRow[]
  warnings: string[]
}

export function parseThreePeriod(csvText: string): ThreePeriodParseResult {
  const rows: ThreePeriodRow[] = []
  const warnings: string[] = []

  const lines = csvText.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length === 0) {
    return { rows, warnings: ['CSVが空です'] }
  }

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i])
    if (cols.length < 18) continue

    const reportTypeStr = cols[0]
    const reportType =
      reportTypeStr === '貸借対照表' ? 'BS' : reportTypeStr === '損益計算書' ? 'PL' : null
    if (!reportType) continue

    rows.push({
      reportType,
      accountCode: cols[1].trim(),
      accountName: cols[2].trim(),
      monthly: {
        twoYearsAgo: { amount: parseNumber(cols[3]), ratio: parseRatio(cols[4]) },
        lastYear: { amount: parseNumber(cols[5]), ratio: parseRatio(cols[6]) },
        current: { amount: parseNumber(cols[7]), ratio: parseRatio(cols[8]) },
        lastYearVsTwoAgoDiff: parseNumber(cols[9]),
        lastYearVsTwoAgoRatio: parseRatio(cols[10]),
        currentVsLastYearDiff: parseNumber(cols[11]),
        currentVsLastYearRatio: parseRatio(cols[12]),
      },
      cumulative: {
        twoYearsAgo: { amount: parseNumber(cols[13]), ratio: parseRatio(cols[14]) },
        lastYear: { amount: parseNumber(cols[15]), ratio: parseRatio(cols[16]) },
        current: { amount: parseNumber(cols[17]), ratio: parseRatio(cols[18]) },
      },
    })
  }

  return { rows, warnings }
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

/**
 * 比率のパース。`****` や空欄は undefined を返す
 */
function parseRatio(s: string | undefined): number | undefined {
  if (!s) return undefined
  const trimmed = s.trim()
  if (!trimmed || trimmed === '****') return undefined
  const n = parseFloat(trimmed)
  return isNaN(n) ? undefined : n
}
