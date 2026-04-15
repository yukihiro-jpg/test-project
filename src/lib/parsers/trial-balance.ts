/**
 * MJS会計大将「月次試算表」CSV パーサー
 *
 * 期待するフォーマット：
 *   帳票種別,コード,科　　　　　目,前月残高,借方,貸方,当月残高,構成比
 *
 * 帳票種別: "貸借対照表" または "損益計算書"
 * 集計行: コードが 9000 番台、科目名が 【】〔〕（）で囲まれる
 */

import type { TrialBalanceRow } from '../types'

export interface TrialBalanceParseResult {
  rows: TrialBalanceRow[]
  warnings: string[]
}

/**
 * 月次試算表 CSV をパースする
 * @param csvText UTF-8 にデコード済みの CSV 文字列
 */
export function parseTrialBalance(csvText: string): TrialBalanceParseResult {
  const rows: TrialBalanceRow[] = []
  const warnings: string[] = []

  const lines = csvText.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length === 0) {
    return { rows, warnings: ['CSVが空です'] }
  }

  // 1行目はヘッダ
  const header = parseCsvLine(lines[0])
  if (!validateHeader(header)) {
    warnings.push(`ヘッダー形式が期待と異なります: ${header.join('|')}`)
  }

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i])
    if (cols.length < 7) continue

    const [reportTypeStr, code, name, previous, debit, credit, current, composition] = cols
    const reportType =
      reportTypeStr === '貸借対照表' ? 'BS' : reportTypeStr === '損益計算書' ? 'PL' : null

    if (!reportType) {
      warnings.push(`帳票種別が不明（行 ${i + 1}）: ${reportTypeStr}`)
      continue
    }

    rows.push({
      reportType,
      accountCode: code.trim(),
      accountName: name.trim(),
      previousBalance: parseNumber(previous),
      debit: parseNumber(debit),
      credit: parseNumber(credit),
      currentBalance: parseNumber(current),
      compositionRatio: composition?.trim() ? parseFloat(composition) : undefined,
    })
  }

  return { rows, warnings }
}

function validateHeader(header: string[]): boolean {
  const expected = ['帳票種別', 'コード', '前月残高', '借方', '貸方', '当月残高']
  return expected.every((key) => header.some((h) => h.includes(key)))
}

/**
 * CSV の1行をパース（ダブルクォート対応）
 */
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
