import type {
  BankTransaction,
  StatementPage,
  ParseResult,
  RawTableRow,
  ColumnMapping,
} from './types'
import { parsePdfText, renderPdfPageToImage } from './pdf-text-parser'
import { parseExcel } from './excel-parser'
import { updatePageBalances } from './balance-validator'

let idCounter = 0
function generateId(): string {
  return `tx-${Date.now()}-${++idCounter}`
}

// 日付パターン（和暦・西暦・年なし等）
const DATE_PATTERNS = [
  // R6.4.1, R06.04.01, H31.4.1
  /([RrHhSsTt]\d{1,2})[./年](\d{1,2})[./月](\d{1,2})日?/,
  // 令和6年4月1日, 平成31年4月1日
  /(令和|平成|昭和|大正)(\d{1,2})年(\d{1,2})月(\d{1,2})日?/,
  // 2024/4/1, 2024-04-01, 2024.4.1
  /(20\d{2})[/\-.](\d{1,2})[/\-.](\d{1,2})/,
  // 4/1, 04/01（年なし）
  /^(\d{1,2})[/.](\d{1,2})$/,
  // 0401（4桁の月日）
  /^(\d{2})(\d{2})$/,
]

// 金額パターン
const AMOUNT_PATTERN = /^[¥￥]?\s*[\d,]+$/

function parseDate(text: string, defaultYear?: number): string | null {
  const cleaned = text.trim()

  // 和暦略称: R6.4.1
  const m1 = cleaned.match(
    /^([RrHhSsTt])(\d{1,2})[./年](\d{1,2})[./月](\d{1,2})日?$/,
  )
  if (m1) {
    const year = eraToWestern(m1[1].toUpperCase(), parseInt(m1[2]))
    if (year) return formatDate(year, parseInt(m1[3]), parseInt(m1[4]))
  }

  // 和暦正式: 令和6年4月1日
  const m2 = cleaned.match(
    /^(令和|平成|昭和|大正)(\d{1,2})年(\d{1,2})月(\d{1,2})日?$/,
  )
  if (m2) {
    const eraMap: Record<string, string> = {
      令和: 'R',
      平成: 'H',
      昭和: 'S',
      大正: 'T',
    }
    const year = eraToWestern(eraMap[m2[1]], parseInt(m2[2]))
    if (year) return formatDate(year, parseInt(m2[3]), parseInt(m2[4]))
  }

  // 西暦: 2024/4/1
  const m3 = cleaned.match(/^(20\d{2})[/\-.](\d{1,2})[/\-.](\d{1,2})$/)
  if (m3) {
    return formatDate(parseInt(m3[1]), parseInt(m3[2]), parseInt(m3[3]))
  }

  // 月/日のみ
  const m4 = cleaned.match(/^(\d{1,2})[/.](\d{1,2})$/)
  if (m4) {
    const year = defaultYear || new Date().getFullYear()
    return formatDate(year, parseInt(m4[1]), parseInt(m4[2]))
  }

  // 4桁月日 0401
  const m5 = cleaned.match(/^(\d{2})(\d{2})$/)
  if (m5) {
    const month = parseInt(m5[1])
    const day = parseInt(m5[2])
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const year = defaultYear || new Date().getFullYear()
      return formatDate(year, month, day)
    }
  }

  return null
}

function eraToWestern(era: string, year: number): number | null {
  const bases: Record<string, number> = { R: 2018, H: 1988, S: 1925, T: 1911 }
  const base = bases[era]
  return base ? base + year : null
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function parseAmount(text: string): number | null {
  const cleaned = text.replace(/[¥￥,、\s]/g, '').replace(/▲|△|-/g, '-')
  if (!cleaned || cleaned === '-' || cleaned === '*') return null
  const num = parseInt(cleaned, 10)
  return isNaN(num) ? null : Math.abs(num)
}

function isDateCell(text: string): boolean {
  return DATE_PATTERNS.some((p) => p.test(text.trim()))
}

function isAmountCell(text: string): boolean {
  const cleaned = text.replace(/[¥￥,、\s▲△\-]/g, '')
  return /^\d+$/.test(cleaned) && cleaned.length > 0
}

/**
 * 列の役割を自動検出する
 */
function detectColumnMapping(rows: RawTableRow[]): ColumnMapping | null {
  if (rows.length < 2) return null

  const maxCols = Math.max(...rows.map((r) => r.cells.length))
  if (maxCols < 3) return null

  // 各列のスコアリング
  const dateScores = new Array(maxCols).fill(0)
  const amountScores = new Array(maxCols).fill(0)
  const textScores = new Array(maxCols).fill(0)

  for (const row of rows) {
    for (let col = 0; col < row.cells.length; col++) {
      const cell = row.cells[col]
      if (!cell) continue
      if (isDateCell(cell)) dateScores[col]++
      if (isAmountCell(cell)) amountScores[col]++
      if (cell.length > 2 && !isAmountCell(cell) && !isDateCell(cell))
        textScores[col]++
    }
  }

  // 日付列: dateScoreが最大の列
  const dateColumn = dateScores.indexOf(Math.max(...dateScores))
  if (dateScores[dateColumn] === 0) return null

  // 金額列を特定（dateColumn以外でamountScoreが高い列）
  const amountCols = amountScores
    .map((score, idx) => ({ idx, score }))
    .filter((c) => c.idx !== dateColumn && c.score > 0)
    .sort((a, b) => b.score - a.score)

  if (amountCols.length < 2) return null

  // 摘要列: textScoreが最大の列
  const descriptionColumn = textScores
    .map((score, idx) => ({ idx, score }))
    .filter((c) => c.idx !== dateColumn && !amountCols.some((a) => a.idx === c.idx))
    .sort((a, b) => b.score - a.score)[0]?.idx ?? -1

  // 金額列の割り当て: 入金、出金、残高
  // 一般的な通帳の列順: 日付, 摘要, 出金, 入金, 残高
  // または: 日付, 摘要, 入金, 出金, 残高
  // 残高は通常最後の金額列
  if (amountCols.length >= 3) {
    // 3列以上の金額列: 最後を残高、前2つを入金/出金
    const sortedByIdx = [...amountCols.slice(0, 3)].sort((a, b) => a.idx - b.idx)
    return {
      dateColumn,
      descriptionColumn: descriptionColumn >= 0 ? descriptionColumn : -1,
      depositColumn: sortedByIdx[0].idx,
      withdrawalColumn: sortedByIdx[1].idx,
      balanceColumn: sortedByIdx[2].idx,
    }
  } else {
    // 2列の金額列: 後の列を残高、前の列を入出金（混合）
    const sortedByIdx = [...amountCols].sort((a, b) => a.idx - b.idx)
    return {
      dateColumn,
      descriptionColumn: descriptionColumn >= 0 ? descriptionColumn : -1,
      depositColumn: sortedByIdx[0].idx,
      withdrawalColumn: sortedByIdx[0].idx, // 同じ列
      balanceColumn: sortedByIdx[1].idx,
    }
  }
}

/**
 * RawTableRowsからBankTransactionに変換
 */
function extractTransactions(
  rows: RawTableRow[],
  mapping: ColumnMapping,
  pageIndex: number,
): BankTransaction[] {
  const transactions: BankTransaction[] = []

  for (const row of rows) {
    const dateText = row.cells[mapping.dateColumn] || ''
    const date = parseDate(dateText)
    if (!date) continue // 日付のない行はスキップ（ヘッダー等）

    const description =
      mapping.descriptionColumn >= 0
        ? row.cells[mapping.descriptionColumn] || ''
        : ''

    const depositText = row.cells[mapping.depositColumn] || ''
    const withdrawalText =
      mapping.withdrawalColumn !== mapping.depositColumn
        ? row.cells[mapping.withdrawalColumn] || ''
        : ''
    const balanceText = row.cells[mapping.balanceColumn] || ''

    const deposit = parseAmount(depositText)
    const withdrawal =
      mapping.withdrawalColumn !== mapping.depositColumn
        ? parseAmount(withdrawalText)
        : null
    const balance = parseAmount(balanceText)

    if (balance === null) continue // 残高がない行はスキップ

    transactions.push({
      id: generateId(),
      pageIndex,
      rowIndex: row.rowIndex,
      date,
      description,
      deposit: deposit ?? null,
      withdrawal: withdrawal ?? null,
      balance,
      boundingBox: row.boundingBox,
    })
  }

  return transactions
}

/**
 * メインのパースエントリポイント
 */
export async function parseFile(file: File): Promise<ParseResult> {
  const fileName = file.name.toLowerCase()

  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    return parseExcelFile(file)
  } else if (fileName.endsWith('.pdf')) {
    return parsePdfFile(file)
  } else {
    throw new Error(
      '対応していないファイル形式です。PDF (.pdf) または Excel (.xlsx, .xls) を選択してください。',
    )
  }
}

async function parsePdfFile(file: File): Promise<ParseResult> {
  // まずテキスト抽出を試みる
  const { pages: rawPages, isTextPdf } = await parsePdfText(file)

  if (!isTextPdf) {
    // スキャンPDF: Gemini APIでOCR処理
    const imageDataUrls: string[] = []
    const pageCount = rawPages.length || 1
    for (let i = 0; i < pageCount; i++) {
      const imageDataUrl = await renderPdfPageToImage(file, i + 1, 2)
      imageDataUrls.push(imageDataUrl)
    }

    try {
      const response = await fetch('/api/bank-statement/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: imageDataUrls }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Gemini OCR APIエラー')
      }

      const data = await response.json()
      const geminiPages = data.pages as {
        pageIndex: number
        transactions: {
          date: string
          description: string
          deposit: number | null
          withdrawal: number | null
          balance: number
        }[]
      }[]

      const statementPages: StatementPage[] = geminiPages.map((gp, i) => {
        const transactions: BankTransaction[] = gp.transactions.map((t, rowIdx) => ({
          id: generateId(),
          pageIndex: i,
          rowIndex: rowIdx,
          date: t.date,
          description: t.description || '',
          deposit: t.deposit ?? null,
          withdrawal: t.withdrawal ?? null,
          balance: t.balance ?? 0,
        }))

        return {
          pageIndex: i,
          transactions,
          openingBalance: 0,
          closingBalance: 0,
          isBalanceValid: true,
          balanceDifference: 0,
          imageDataUrl: imageDataUrls[i],
        }
      })

      return {
        pages: updatePageBalances(statementPages),
        sourceType: 'pdf-ocr',
        needsColumnMapping: false,
      }
    } catch (err) {
      // Gemini API失敗: 画像のみ表示して手動入力モード
      const emptyPages: StatementPage[] = imageDataUrls.map((url, i) => ({
        pageIndex: i,
        transactions: [],
        openingBalance: 0,
        closingBalance: 0,
        isBalanceValid: true,
        balanceDifference: 0,
        imageDataUrl: url,
      }))
      return {
        pages: emptyPages,
        pageImageUrls: imageDataUrls,
        sourceType: 'pdf-ocr',
        needsColumnMapping: false,
        ocrFailed: true,
      }
    }
  }

  // テキストPDF
  const allRawPages = rawPages.map((p) => p.rows)
  const mapping = detectColumnMappingFromAllPages(allRawPages)

  if (!mapping) {
    return {
      pages: [],
      rawPages: allRawPages,
      sourceType: 'pdf-text',
      needsColumnMapping: true,
    }
  }

  // ページ画像を生成
  const statementPages: StatementPage[] = []
  for (let i = 0; i < rawPages.length; i++) {
    const imageDataUrl = await renderPdfPageToImage(file, i + 1, 2)
    const transactions = extractTransactions(rawPages[i].rows, mapping, i)
    statementPages.push({
      pageIndex: i,
      transactions,
      openingBalance: 0,
      closingBalance: 0,
      isBalanceValid: true,
      balanceDifference: 0,
      imageDataUrl,
    })
  }

  return {
    pages: updatePageBalances(statementPages),
    sourceType: 'pdf-text',
    needsColumnMapping: false,
  }
}

async function parseExcelFile(file: File): Promise<ParseResult> {
  const excelResults = await parseExcel(file)

  const allRawPages = excelResults.map((r) => r.rows)
  const mapping = detectColumnMappingFromAllPages(allRawPages)

  if (!mapping) {
    return {
      pages: [],
      rawPages: allRawPages,
      sourceType: 'excel',
      needsColumnMapping: true,
    }
  }

  const statementPages: StatementPage[] = excelResults.map((result, i) => {
    const transactions = extractTransactions(result.rows, mapping, i)
    return {
      pageIndex: i,
      transactions,
      openingBalance: 0,
      closingBalance: 0,
      isBalanceValid: true,
      balanceDifference: 0,
      // Excelの場合はHTML表示
    }
  })

  return {
    pages: updatePageBalances(statementPages),
    sourceType: 'excel',
    needsColumnMapping: false,
  }
}

function detectColumnMappingFromAllPages(allPages: RawTableRow[][]): ColumnMapping | null {
  // 全ページの行を結合して列検出
  const allRows = allPages.flat()
  return detectColumnMapping(allRows)
}

/**
 * 列マッピングを手動適用してParseResultを生成
 */
export function applyColumnMapping(
  rawPages: RawTableRow[][],
  mapping: ColumnMapping,
  sourceType: ParseResult['sourceType'],
): ParseResult {
  const statementPages: StatementPage[] = rawPages.map((rows, i) => {
    const transactions = extractTransactions(rows, mapping, i)
    return {
      pageIndex: i,
      transactions,
      openingBalance: 0,
      closingBalance: 0,
      isBalanceValid: true,
      balanceDifference: 0,
    }
  })

  return {
    pages: updatePageBalances(statementPages),
    sourceType,
    needsColumnMapping: false,
  }
}
