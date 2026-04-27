import ExcelJS from 'exceljs'
import type { AssetMovementTable, DepositRow, ParsedPassbook } from '@/types'
import { toWareki } from './wareki'

const NUMBER_FORMAT = '#,##0;△#,##0;""'
const FONT_NAME = 'Noto Sans JP'
const SOLID_DARK = 'FF333333'
const DOTTED_GRAY = 'FF888888'
const HEADER_INNER_WHITE = 'FFFFFFFF'

const HEADER_FILL: ExcelJS.FillPattern = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1F3A5F' }
}
const SUBHEADER_FILL: ExcelJS.FillPattern = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF2E5984' }
}

// 表データ部分: 縦線=実線、横線=細い点線
function bodyBorder(): Partial<ExcelJS.Borders> {
  return {
    top: { style: 'hair', color: { argb: DOTTED_GRAY } },
    bottom: { style: 'hair', color: { argb: DOTTED_GRAY } },
    left: { style: 'thin', color: { argb: SOLID_DARK } },
    right: { style: 'thin', color: { argb: SOLID_DARK } }
  }
}

// ヘッダ罫線: 内部・外周ともに白線で統一（背景色とのコントラストで境界が分かるため）
// ヘッダと表本体の境界（ヘッダの最下段の bottom）のみ実線で明示する。
function headerBorder(pos: {
  isTopRow: boolean
  isBottomRow: boolean
  isLeftCol: boolean
  isRightCol: boolean
}): Partial<ExcelJS.Borders> {
  const w = (): ExcelJS.Border => ({ style: 'thin', color: { argb: HEADER_INNER_WHITE } })
  const sep = (): ExcelJS.Border => ({ style: 'medium', color: { argb: SOLID_DARK } })
  return {
    top: w(),
    bottom: pos.isBottomRow ? sep() : w(),
    left: w(),
    right: w()
  }
}

function applyHeaderStyle(
  cell: ExcelJS.Cell,
  pos: { isTopRow: boolean; isBottomRow: boolean; isLeftCol: boolean; isRightCol: boolean },
  fill: ExcelJS.FillPattern = HEADER_FILL
) {
  cell.fill = fill
  cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: FONT_NAME }
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  cell.border = headerBorder(pos)
}

function applyDataStyle(cell: ExcelJS.Cell, opts: { numeric?: boolean } = {}) {
  cell.font = { name: FONT_NAME, size: 10 }
  cell.border = bodyBorder()
  cell.alignment = { vertical: 'middle', wrapText: true, horizontal: opts.numeric ? 'right' : 'left' }
  if (opts.numeric) cell.numFmt = NUMBER_FORMAT
}

export async function buildExcelWorkbook(
  passbooks: ParsedPassbook[],
  assetTable: AssetMovementTable,
  summaryText?: string,
  depositRows: DepositRow[] = [],
  referenceDate?: string
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Bank Analyzer'
  wb.created = new Date()

  for (const pb of passbooks) {
    const sheet = wb.addWorksheet(`${pb.label || pb.fileName}`.slice(0, 31))
    const totalCols = 6
    sheet.columns = [
      { width: 18 },
      { width: 32 },
      { width: 14 },
      { width: 14 },
      { width: 16 },
      { width: 28 }
    ]
    const titleRow = sheet.addRow([`${pb.bankName} ${pb.branchName}  口座番号: ${pb.accountNumber}`])
    sheet.mergeCells(titleRow.number, 1, titleRow.number, totalCols)
    titleRow.font = { bold: true, size: 13, name: FONT_NAME }
    titleRow.height = 22

    const header = sheet.addRow(['日付', '摘要', '入金額', '出金額', '残高', '備考'])
    header.eachCell((c, idx) =>
      applyHeaderStyle(c, {
        isTopRow: true,
        isBottomRow: true,
        isLeftCol: idx === 1,
        isRightCol: idx === totalCols
      })
    )
    header.height = 24

    const startRow = sheet.addRow(['', '開始残高', '', '', pb.startBalance ?? 0, ''])
    startRow.getCell(2).font = { italic: true, name: FONT_NAME }
    startRow.eachCell((c, idx) => applyDataStyle(c, { numeric: idx === 5 }))

    for (const tx of pb.transactions) {
      const row = sheet.addRow([
        toWareki(tx.date),
        tx.description,
        tx.deposit || '',
        tx.withdrawal || '',
        tx.balance,
        tx.remarks || ''
      ])
      row.eachCell((c, idx) => applyDataStyle(c, { numeric: idx === 3 || idx === 4 || idx === 5 }))
    }

    const endRow = sheet.addRow(['', '終了残高', '', '', pb.endBalance ?? 0, ''])
    endRow.getCell(2).font = { italic: true, name: FONT_NAME }
    endRow.eachCell((c, idx) => applyDataStyle(c, { numeric: idx === 5 }))

    sheet.views = [{ state: 'frozen', ySplit: 2 }]
  }

  const movement = wb.addWorksheet('金融資産異動一覧表')
  const passbookCount = assetTable.passbookOrder.length
  const passbookMap = new Map(passbooks.map((p) => [p.passbookId, p]))

  const colCount = 1 + passbookCount * 2 + 2
  const widths = [16]
  for (let i = 0; i < passbookCount; i++) widths.push(14, 14)
  // 結論列は「相続財産計上額の算出」(11文字) が省略されない幅にする
  widths.push(24, 36)
  movement.columns = widths.map((w) => ({ width: w }))

  const introRow = movement.addRow(['金融資産異動一覧表'])
  movement.mergeCells(introRow.number, 1, introRow.number, colCount)
  introRow.font = { bold: true, size: 14, name: FONT_NAME }
  introRow.alignment = { horizontal: 'left' }

  const noteRow = movement.addRow([
    'ATM出金（不明金）と利用者が手動で追加した取引を抽出。資金移動と思われるものは同一行に統合。'
  ])
  movement.mergeCells(noteRow.number, 1, noteRow.number, colCount)
  noteRow.font = { italic: true, color: { argb: 'FF555555' }, name: FONT_NAME }

  const finalSummary =
    summaryText ??
    '被相続人の預貯金等について調査・確認を行った結果、特筆すべき取引とそのお内容は以下の通りです。下記表以外の被相続人の預貯金等の取引については財産性があると考えられるものはありませんでした。'

  // 行高は段落数だけでなく、各段落が結合セル幅で何行に折り返されるかも考慮して算出する
  const totalUnitWidth = widths.reduce((a, b) => a + b, 0)
  // 全角文字 (Japanese) は概ね 1 セル幅単位 = 約 1 文字相当として扱う
  const charsPerLine = Math.max(40, Math.floor(totalUnitWidth * 0.95))
  const visualLines = finalSummary
    .split('\n')
    .reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / charsPerLine)), 0)
  const summaryRow = movement.addRow([finalSummary])
  movement.mergeCells(summaryRow.number, 1, summaryRow.number, colCount)
  summaryRow.font = { bold: true, size: 11, name: FONT_NAME, color: { argb: 'FF222222' } }
  summaryRow.alignment = { horizontal: 'left', vertical: 'top', wrapText: true }
  summaryRow.height = Math.max(28, visualLines * 18 + 8)

  const bankNameRow = movement.addRow([''])
  const accountRow = movement.addRow([''])
  const purposeRow = movement.addRow([''])
  const subColRow = movement.addRow([''])

  for (let i = 0; i < passbookCount; i++) {
    const pb = passbookMap.get(assetTable.passbookOrder[i])
    const startCol = 2 + i * 2
    bankNameRow.getCell(startCol).value = `${pb?.bankName || ''} ${pb?.branchName || ''}`.trim()
    movement.mergeCells(bankNameRow.number, startCol, bankNameRow.number, startCol + 1)
    accountRow.getCell(startCol).value = `口座番号: ${pb?.accountNumber || ''}`
    movement.mergeCells(accountRow.number, startCol, accountRow.number, startCol + 1)
    purposeRow.getCell(startCol).value = `用途: ${pb?.purpose || '-'}`
    movement.mergeCells(purposeRow.number, startCol, purposeRow.number, startCol + 1)
    subColRow.getCell(startCol).value = '入金'
    subColRow.getCell(startCol + 1).value = '出金'
  }
  const conclusionCol = 2 + passbookCount * 2
  const remarksCol = conclusionCol + 1
  bankNameRow.getCell(conclusionCol).value = '結論'
  movement.mergeCells(bankNameRow.number, conclusionCol, purposeRow.number, conclusionCol)
  bankNameRow.getCell(remarksCol).value = '備考'
  movement.mergeCells(bankNameRow.number, remarksCol, subColRow.number, remarksCol)
  subColRow.getCell(conclusionCol).value = '相続財産計上額の算出'

  bankNameRow.getCell(1).value = '日付'
  movement.mergeCells(bankNameRow.number, 1, subColRow.number, 1)

  const headerRows = [bankNameRow, accountRow, purposeRow, subColRow]
  headerRows.forEach((r, rowIdx) => {
    const isTopRow = rowIdx === 0
    const isBottomRow = rowIdx === headerRows.length - 1
    r.eachCell({ includeEmpty: true }, (c, colNumber) => {
      applyHeaderStyle(
        c,
        {
          isTopRow,
          isBottomRow,
          isLeftCol: colNumber === 1,
          isRightCol: colNumber === colCount
        },
        SUBHEADER_FILL
      )
    })
    r.height = 22
  })

  let conclusionTotal = 0
  for (const row of assetTable.rows) {
    const values: (string | number)[] = [toWareki(row.date)]
    for (const id of assetTable.passbookOrder) {
      const entry = row.passbookEntries[id] || { deposit: 0, withdrawal: 0 }
      values.push(entry.deposit || 0, entry.withdrawal ? -entry.withdrawal : 0)
    }
    values.push(row.conclusionAmount, row.remarks)
    conclusionTotal += row.conclusionAmount || 0

    const xRow = movement.addRow(values)
    xRow.eachCell({ includeEmpty: true }, (c, colNumber) => {
      const isNumeric = colNumber >= 2 && colNumber <= conclusionCol
      applyDataStyle(c, { numeric: isNumeric })
    })
    if (row.isFundTransfer) {
      xRow.eachCell({ includeEmpty: true }, (c) => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF3FB' } }
      })
    }
  }

  if (assetTable.rows.length > 0) {
    const totalLabelCols = 1 + passbookCount * 2
    // 全列を空文字で埋めて作成 → eachCell が remarksCol(G列) まで到達するよう保証
    const totalValues: (string | number)[] = new Array(remarksCol).fill('')
    totalValues[0] = '合計'
    totalValues[conclusionCol - 1] = conclusionTotal
    const totalRow = movement.addRow(totalValues)
    movement.mergeCells(totalRow.number, 1, totalRow.number, totalLabelCols)
    for (let col = 1; col <= remarksCol; col++) {
      const c = totalRow.getCell(col)
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }
      c.font = { bold: true, name: FONT_NAME }
      c.border = {
        top: { style: 'medium', color: { argb: SOLID_DARK } },
        left: { style: 'thin', color: { argb: SOLID_DARK } },
        right: { style: 'thin', color: { argb: SOLID_DARK } },
        bottom: { style: 'medium', color: { argb: SOLID_DARK } }
      }
      if (col === conclusionCol) {
        c.numFmt = NUMBER_FORMAT
        c.alignment = { horizontal: 'right', vertical: 'middle' }
      } else if (col === 1) {
        c.alignment = { horizontal: 'right', vertical: 'middle' }
      } else {
        c.alignment = { horizontal: 'center', vertical: 'middle' }
      }
    }
    totalRow.height = 24
  }

  movement.views = [{ state: 'frozen', ySplit: subColRow.number }]

  // ===== 預金一覧表シート =====
  if (depositRows.length > 0) {
    const ds = wb.addWorksheet('預金一覧表')
    ds.columns = [
      { width: 3 }, // A: 余白
      { width: 18 }, // B: 銀行名
      { width: 14 }, // C: 支店名
      { width: 14 }, // D: 種類
      { width: 22 }, // E: 口座番号
      { width: 16 }, // F: 金額
      { width: 14 }, // G: 経過利息
      { width: 11 }, // H: 残証有無
      { width: 30 } // I: 備考
    ]

    // タイトル
    const titleRow = ds.addRow(['', '預金一覧'])
    titleRow.getCell(2).font = { bold: true, size: 13, name: FONT_NAME }
    titleRow.height = 22

    // 基準日
    if (referenceDate) {
      const wareki = toWareki(referenceDate)
      const dateRow = ds.addRow(['', `基準日: ${wareki || referenceDate}`])
      ds.mergeCells(dateRow.number, 2, dateRow.number, 9)
      dateRow.getCell(2).font = { italic: true, size: 11, name: FONT_NAME, color: { argb: 'FF555555' } }
    }

    ds.addRow([])

    // ヘッダ
    const headerLabels = ['', '銀行名', '支店名', '種類', '口座番号', '金額', '経過利息', '残証有無', '備考']
    const dsHeader = ds.addRow(headerLabels)
    dsHeader.height = 26
    for (let col = 2; col <= 9; col++) {
      const cell = dsHeader.getCell(col)
      cell.fill = HEADER_FILL
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: FONT_NAME }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = {
        top: { style: 'thin', color: { argb: HEADER_INNER_WHITE } },
        bottom: { style: 'medium', color: { argb: SOLID_DARK } },
        left: { style: 'thin', color: { argb: HEADER_INNER_WHITE } },
        right: { style: 'thin', color: { argb: HEADER_INNER_WHITE } }
      }
    }

    // データ行
    let totalAmount = 0
    let totalInterest = 0
    for (const r of depositRows) {
      totalAmount += r.amount || 0
      totalInterest += r.accruedInterest || 0
      const dsRow = ds.addRow([
        '',
        r.bankName,
        r.branchName,
        r.accountType,
        r.accountNumber,
        r.amount || 0,
        r.accruedInterest || 0,
        r.hasCertificate ? '☑' : '☐',
        r.remarks
      ])
      dsRow.height = 22
      for (let col = 2; col <= 9; col++) {
        const c = dsRow.getCell(col)
        c.font = { name: FONT_NAME, size: 10 }
        c.border = bodyBorder()
        const isNumeric = col === 6 || col === 7
        const isCenter = col === 8
        c.alignment = {
          vertical: 'middle',
          wrapText: true,
          horizontal: isNumeric ? 'right' : isCenter ? 'center' : 'left'
        }
        if (isNumeric) c.numFmt = NUMBER_FORMAT
      }
    }

    // 計 行
    const sumRow = ds.addRow(['', '計', '', '', '', totalAmount, totalInterest, '', ''])
    sumRow.height = 22
    for (let col = 2; col <= 9; col++) {
      const c = sumRow.getCell(col)
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }
      c.font = { bold: true, name: FONT_NAME, size: 10 }
      c.border = {
        top: { style: 'medium', color: { argb: SOLID_DARK } },
        bottom: { style: 'medium', color: { argb: SOLID_DARK } },
        left: { style: 'thin', color: { argb: SOLID_DARK } },
        right: { style: 'thin', color: { argb: SOLID_DARK } }
      }
      const isNumeric = col === 6 || col === 7
      c.alignment = { vertical: 'middle', horizontal: isNumeric ? 'right' : 'left' }
      if (isNumeric) c.numFmt = NUMBER_FORMAT
    }

    // 合計（金額＋経過利息）
    ds.addRow([])
    const grandRow = ds.addRow(['', '', '', '', '', '', '合計', totalAmount + totalInterest, ''])
    grandRow.height = 22
    const gc1 = grandRow.getCell(7)
    const gc2 = grandRow.getCell(8)
    gc1.font = { bold: true, name: FONT_NAME, size: 11 }
    gc1.alignment = { horizontal: 'center', vertical: 'middle' }
    gc1.border = {
      top: { style: 'medium', color: { argb: SOLID_DARK } },
      bottom: { style: 'medium', color: { argb: SOLID_DARK } },
      left: { style: 'medium', color: { argb: SOLID_DARK } },
      right: { style: 'thin', color: { argb: SOLID_DARK } }
    }
    gc2.font = { bold: true, name: FONT_NAME, size: 12 }
    gc2.numFmt = NUMBER_FORMAT
    gc2.alignment = { horizontal: 'right', vertical: 'middle' }
    gc2.border = {
      top: { style: 'medium', color: { argb: SOLID_DARK } },
      bottom: { style: 'medium', color: { argb: SOLID_DARK } },
      left: { style: 'thin', color: { argb: SOLID_DARK } },
      right: { style: 'medium', color: { argb: SOLID_DARK } }
    }

    ds.views = [{ state: 'frozen', ySplit: dsHeader.number }]
  }

  const buf = await wb.xlsx.writeBuffer()
  return Buffer.from(buf)
}
