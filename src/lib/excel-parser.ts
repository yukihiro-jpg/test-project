import * as XLSX from 'xlsx'
import type { MonthlyData, FiscalYearData } from '@/types/report'

// 月次推移財務報告書の行キーワード定義
const ROW_KEYWORDS: Record<keyof MonthlyData, string[]> = {
  month: [],
  netSales: ['純売上高', '純売上'],
  cogs: ['売上原価'],
  grossProfit: ['売上総利益', '粗利益'],
  sgaExpense: ['販売費及び一般管理費', '販管費合計', '販売費・一般管理費'],
  operatingProfit: ['営業利益'],
  ordinaryIncome: ['営業外収益合計', '営業外収益'],
  interestExpense: ['支払利息'],
  ordinaryProfit: ['経常利益'],
  currentAssets: ['流動資産合計', '流動資産'],
  currentLiabilities: ['流動負債合計', '流動負債'],
  longTermDebt: ['長期借入金'],
  leaseLiabilities: ['リース債務'],
  depreciation: ['減価償却費'],
}

// 月ラベル（期首9月の場合）→ 列インデックスのマッピング
const FISCAL_MONTHS_START9 = ['9月', '10月', '11月', '12月', '1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月']
const FISCAL_MONTHS_START4 = ['4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月', '1月', '2月', '3月']

function toNumber(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0
  if (typeof val === 'number') return val
  const s = String(val).replace(/,/g, '').replace(/△/g, '-').replace(/▲/g, '-')
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}

function findRowIndex(data: unknown[][], keywords: string[]): number {
  for (let r = 0; r < data.length; r++) {
    const cell = String(data[r][0] ?? '').trim()
    if (keywords.some(kw => cell.includes(kw))) return r
  }
  return -1
}

// ヘッダー行から月列のインデックスを取得
function findMonthColumns(data: unknown[][]): { monthOrder: string[]; colMap: Record<string, number> } {
  for (let r = 0; r < Math.min(20, data.length); r++) {
    const row = data[r].map(c => String(c ?? '').trim())
    // 月ラベルを含む行を探す
    const has9 = row.some(c => c === '9月' || c === '９月')
    const has4 = row.some(c => c === '4月' || c === '４月')
    if (has9 || has4) {
      const monthOrder = has9 ? FISCAL_MONTHS_START9 : FISCAL_MONTHS_START4
      const colMap: Record<string, number> = {}
      for (let c = 0; c < row.length; c++) {
        const normalized = row[c].replace(/[０-９]/g, m => String.fromCharCode(m.charCodeAt(0) - 0xFEE0))
        if (monthOrder.includes(normalized)) {
          colMap[normalized] = c
        }
      }
      if (Object.keys(colMap).length >= 6) {
        return { monthOrder, colMap }
      }
    }
  }
  // フォールバック: 列を順番に割り当て（2列目から月データと仮定）
  return { monthOrder: FISCAL_MONTHS_START9, colMap: Object.fromEntries(FISCAL_MONTHS_START9.map((m, i) => [m, i + 1])) }
}

function getRowValues(data: unknown[][], rowIdx: number, colMap: Record<string, number>, monthOrder: string[]): number[] {
  if (rowIdx < 0) return monthOrder.map(() => 0)
  return monthOrder.map(m => {
    const col = colMap[m]
    if (col === undefined) return 0
    return toNumber(data[rowIdx][col])
  })
}

// Excelシートから全データを2D配列として取得
function sheetToArray(sheet: XLSX.WorkSheet): unknown[][] {
  const ref = sheet['!ref']
  if (!ref) return []
  const range = XLSX.utils.decode_range(ref)
  const data: unknown[][] = []
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row: unknown[] = []
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c })
      row.push(sheet[addr]?.v ?? null)
    }
    data.push(row)
  }
  return data
}

// 月インデックスを実際の月番号に変換（期首月から）
function monthIndexToNumber(idx: number, monthOrder: string[]): number {
  const label = monthOrder[idx]
  const m = parseInt(label.replace('月', ''))
  return isNaN(m) ? idx + 1 : m
}

// 年計列を探す
function findAnnualColumn(data: unknown[][], monthOrder: string[]): number {
  for (let r = 0; r < Math.min(20, data.length); r++) {
    const row = data[r].map(c => String(c ?? '').trim())
    for (let c = 0; c < row.length; c++) {
      if (row[c] === '年計' || row[c] === '合計' || row[c] === '年度合計') {
        // 月列の後にあるか確認
        const lastMonthCol = Math.max(...Object.values(monthOrder.reduce((acc, m) => {
          const found = row.indexOf(m)
          if (found >= 0) acc[m] = found
          return acc
        }, {} as Record<string, number>)).filter(v => v >= 0))
        if (c > lastMonthCol) return c
        return c
      }
    }
  }
  return -1
}

export function parseFinancialFile(buffer: Buffer, filename: string): FiscalYearData {
  const ext = filename.split('.').pop()?.toLowerCase()

  let workbook: XLSX.WorkBook
  if (ext === 'csv') {
    const text = buffer.toString('utf-8')
    workbook = XLSX.read(text, { type: 'string' })
  } else {
    workbook = XLSX.read(buffer, { type: 'buffer' })
  }

  // 最初のシートを使用
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const data = sheetToArray(sheet)

  const { monthOrder, colMap } = findMonthColumns(data)

  // 各財務項目の行インデックスを検索
  const rowIndices: Partial<Record<keyof MonthlyData, number>> = {}
  for (const [key, keywords] of Object.entries(ROW_KEYWORDS)) {
    if (keywords.length === 0) continue
    rowIndices[key as keyof MonthlyData] = findRowIndex(data, keywords)
  }

  // 各項目の月次値を取得
  const getVals = (key: keyof MonthlyData) => {
    const idx = rowIndices[key] ?? -1
    return getRowValues(data, idx, colMap, monthOrder)
  }

  const netSalesVals = getVals('netSales')
  const cogsVals = getVals('cogs')
  const grossProfitVals = getVals('grossProfit')
  const sgaVals = getVals('sgaExpense')
  const opProfitVals = getVals('operatingProfit')
  const ordIncomeVals = getVals('ordinaryIncome')
  const intExpVals = getVals('interestExpense')
  const ordProfitVals = getVals('ordinaryProfit')
  const currAssetsVals = getVals('currentAssets')
  const currLiabVals = getVals('currentLiabilities')
  const ltDebtVals = getVals('longTermDebt')
  const leaseVals = getVals('leaseLiabilities')
  const deprVals = getVals('depreciation')

  // 月次データを構築
  const months: MonthlyData[] = monthOrder.map((_, i) => ({
    month: monthIndexToNumber(i, monthOrder),
    netSales: netSalesVals[i],
    cogs: cogsVals[i],
    grossProfit: grossProfitVals[i],
    sgaExpense: sgaVals[i],
    operatingProfit: opProfitVals[i],
    ordinaryIncome: ordIncomeVals[i],
    interestExpense: intExpVals[i],
    ordinaryProfit: ordProfitVals[i],
    currentAssets: currAssetsVals[i],
    currentLiabilities: currLiabVals[i],
    longTermDebt: ltDebtVals[i],
    leaseLiabilities: leaseVals[i],
    depreciation: deprVals[i],
  }))

  // 年計（合計）
  const annualCol = findAnnualColumn(data, monthOrder)
  const getAnnual = (key: keyof MonthlyData) => {
    const idx = rowIndices[key] ?? -1
    if (idx < 0 || annualCol < 0) {
      // フォールバック: 全月の合計
      return getVals(key).reduce((a, b) => a + b, 0)
    }
    return toNumber(data[idx][annualCol])
  }

  return {
    label: '',  // 呼び出し元でセット
    startMonth: monthIndexToNumber(0, monthOrder),
    endMonth: monthIndexToNumber(monthOrder.length - 1, monthOrder),
    months,
    annual: {
      netSales: getAnnual('netSales'),
      cogs: getAnnual('cogs'),
      grossProfit: getAnnual('grossProfit'),
      sgaExpense: getAnnual('sgaExpense'),
      operatingProfit: getAnnual('operatingProfit'),
      ordinaryProfit: getAnnual('ordinaryProfit'),
    },
  }
}
