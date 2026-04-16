import ExcelJS from 'exceljs'
import type { CashLedgerMonth, BankBookMonth } from '../src/app/lib/types'

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF4472C4' },
}

const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: 'FFFFFFFF' },
  size: 11,
}

const BORDER_STYLE: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
}

const AMOUNT_FORMAT = '#,##0'

function formatMonthLabel(month: string): string {
  const [y, m] = month.split('-')
  return `${y}年${parseInt(m)}月`
}

/**
 * 現金出納帳をExcelファイルに出力
 */
export async function exportCashLedgerExcel(
  data: CashLedgerMonth,
  companyName: string,
  filePath: string
): Promise<void> {
  const wb = new ExcelJS.Workbook()
  wb.creator = '帳簿管理アプリ'
  const ws = wb.addWorksheet(`現金出納帳_${formatMonthLabel(data.month)}`)

  // タイトル行
  ws.mergeCells('A1:F1')
  const titleCell = ws.getCell('A1')
  titleCell.value = `${companyName}　現金出納帳　${formatMonthLabel(data.month)}`
  titleCell.font = { bold: true, size: 14 }
  titleCell.alignment = { horizontal: 'center' }

  // ヘッダー行
  const headers = ['日付', '摘要', '取引先', '収入金額', '支出金額', '残高']
  const headerRow = ws.addRow(headers)
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL
    cell.font = HEADER_FONT
    cell.border = BORDER_STYLE
    cell.alignment = { horizontal: 'center' }
  })

  // 前月繰越行
  const carryOverRow = ws.addRow([
    '',
    '前月繰越',
    '',
    '',
    '',
    data.carryOver,
  ])
  carryOverRow.font = { bold: true }
  carryOverRow.eachCell((cell) => {
    cell.border = BORDER_STYLE
  })
  carryOverRow.getCell(6).numFmt = AMOUNT_FORMAT

  // データ行
  let totalIncome = 0
  let totalExpense = 0

  for (const entry of data.entries) {
    totalIncome += entry.income ?? 0
    totalExpense += entry.expense ?? 0

    const row = ws.addRow([
      entry.date,
      entry.description,
      entry.counterparty || '',
      entry.income || '',
      entry.expense || '',
      entry.balance,
    ])
    row.eachCell((cell, colNumber) => {
      cell.border = BORDER_STYLE
      if (colNumber >= 4) {
        cell.numFmt = AMOUNT_FORMAT
        cell.alignment = { horizontal: 'right' }
      }
    })
  }

  // 合計行
  const closingBalance = data.entries.length > 0
    ? data.entries[data.entries.length - 1].balance
    : data.carryOver

  const totalRow = ws.addRow([
    '',
    '合計 / 次月繰越',
    '',
    totalIncome,
    totalExpense,
    closingBalance,
  ])
  totalRow.font = { bold: true }
  totalRow.eachCell((cell, colNumber) => {
    cell.border = BORDER_STYLE
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF2F2F2' },
    }
    if (colNumber >= 4) {
      cell.numFmt = AMOUNT_FORMAT
      cell.alignment = { horizontal: 'right' }
    }
  })

  // 列幅設定
  ws.columns = [
    { width: 14 },  // 日付
    { width: 30 },  // 摘要
    { width: 20 },  // 取引先
    { width: 15 },  // 収入金額
    { width: 15 },  // 支出金額
    { width: 15 },  // 残高
  ]

  await wb.xlsx.writeFile(filePath)
}

/**
 * 通帳記録をExcelファイルに出力
 */
export async function exportBankBookExcel(
  data: BankBookMonth,
  companyName: string,
  accountName: string,
  filePath: string
): Promise<void> {
  const wb = new ExcelJS.Workbook()
  wb.creator = '帳簿管理アプリ'
  const ws = wb.addWorksheet(`通帳_${formatMonthLabel(data.month)}`)

  // タイトル行
  ws.mergeCells('A1:F1')
  const titleCell = ws.getCell('A1')
  titleCell.value = `${companyName}　通帳記録　${accountName}　${formatMonthLabel(data.month)}`
  titleCell.font = { bold: true, size: 14 }
  titleCell.alignment = { horizontal: 'center' }

  // ヘッダー行
  const headers = ['日付', '摘要（通帳記載）', '取引内容', 'お預り金額', 'お引出金額', '残高']
  const headerRow = ws.addRow(headers)
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL
    cell.font = HEADER_FONT
    cell.border = BORDER_STYLE
    cell.alignment = { horizontal: 'center' }
  })

  // 前月繰越行
  const carryOverRow = ws.addRow([
    '',
    '前月繰越',
    '',
    '',
    '',
    data.carryOver,
  ])
  carryOverRow.font = { bold: true }
  carryOverRow.eachCell((cell) => {
    cell.border = BORDER_STYLE
  })
  carryOverRow.getCell(6).numFmt = AMOUNT_FORMAT

  // データ行
  let totalDeposit = 0
  let totalWithdrawal = 0

  for (const entry of data.entries) {
    totalDeposit += entry.deposit ?? 0
    totalWithdrawal += entry.withdrawal ?? 0

    const row = ws.addRow([
      entry.date,
      entry.passbookDescription,
      entry.transactionType,
      entry.deposit || '',
      entry.withdrawal || '',
      entry.balance,
    ])
    row.eachCell((cell, colNumber) => {
      cell.border = BORDER_STYLE
      if (colNumber >= 4) {
        cell.numFmt = AMOUNT_FORMAT
        cell.alignment = { horizontal: 'right' }
      }
    })
  }

  // 合計行
  const closingBalance = data.entries.length > 0
    ? data.entries[data.entries.length - 1].balance
    : data.carryOver

  const totalRow = ws.addRow([
    '',
    '合計 / 次月繰越',
    '',
    totalDeposit,
    totalWithdrawal,
    closingBalance,
  ])
  totalRow.font = { bold: true }
  totalRow.eachCell((cell, colNumber) => {
    cell.border = BORDER_STYLE
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF2F2F2' },
    }
    if (colNumber >= 4) {
      cell.numFmt = AMOUNT_FORMAT
      cell.alignment = { horizontal: 'right' }
    }
  })

  // 列幅設定
  ws.columns = [
    { width: 14 },  // 日付
    { width: 25 },  // 摘要（通帳記載）
    { width: 20 },  // 取引内容
    { width: 15 },  // お預り金額
    { width: 15 },  // お引出金額
    { width: 15 },  // 残高
  ]

  await wb.xlsx.writeFile(filePath)
}
