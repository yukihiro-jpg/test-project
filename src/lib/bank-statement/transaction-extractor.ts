import type {
  BankTransaction,
  StatementPage,
  ParseResult,
  RawTableRow,
  ColumnMapping,
} from './types'
import { parsePdfText, renderPdfPageToImage, getPdfPageCount } from './pdf-text-parser'
import { parseExcel } from './excel-parser'
import { updatePageBalances } from './balance-validator'
import { getTemplatePromptAddition, learnBankTemplate } from './bank-template'

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
  // 20240401, 20260101 (YYYYMMDD 8桁)
  /^(20|21)\d{6}$/,
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

  // YYYYMMDD 8桁: 20260101, 20240401
  const m3b = cleaned.match(/^(20\d{2}|21\d{2})(\d{2})(\d{2})$/)
  if (m3b) {
    const y = parseInt(m3b[1])
    const mo = parseInt(m3b[2])
    const d = parseInt(m3b[3])
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return formatDate(y, mo, d)
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

// 符号付き金額を取り出す（正=入金, 負=出金の単一列向け）
function parseSignedAmount(text: string): number | null {
  // ▲△△▼( )はすべてマイナスとして扱う
  let cleaned = text.replace(/[¥￥,、\s\u3000]/g, '')
  // カッコ表記 (1,000) を負数として扱う
  if (/^\(.+\)$/.test(cleaned)) cleaned = '-' + cleaned.slice(1, -1)
  cleaned = cleaned.replace(/[▲△]/g, '-')
  if (!cleaned || cleaned === '-' || cleaned === '*') return null
  const num = parseInt(cleaned, 10)
  return isNaN(num) ? null : num
}

function isDateCell(text: string): boolean {
  return DATE_PATTERNS.some((p) => p.test(text.trim()))
}

function isAmountCell(text: string): boolean {
  const cleaned = text.replace(/[¥￥,、\s▲△\-]/g, '')
  return /^\d+$/.test(cleaned) && cleaned.length > 0
}

// ヘッダー行で使われる列名キーワード
const HEADER_DATE = ['日付', '年月日', '取引日', '計算日']
const HEADER_DESC = ['摘要', 'お取引内容', '取引内容', '内容', '記事', '備考']
const HEADER_DEPOSIT = ['入金', '預入', '預り', 'お預入れ', 'お預入', '入金金額', '入金額', '預入金額']
const HEADER_WITHDRAW = ['出金', '引出', '払戻', 'お引出', 'お支払い', '出金金額', '出金額', '引出金額', '支払金額']
const HEADER_BALANCE = ['残高', '差引残高', '残額', 'お預り残高']
// 入出金が1列で符号付の場合の列名
const HEADER_SIGNED = ['入出金', '出入金', '入出金額', '取引金額', 'お取引金額', '金額']

function matchHeaderKeyword(cell: string, keywords: string[]): boolean {
  // 全角/半角スペース・改行等を除去して比較（「残　高（円）」等の表記ゆれに対応）
  const c = cell.replace(/[\s\u3000]/g, '')
  if (!c) return false
  return keywords.some((k) => {
    const kn = k.replace(/[\s\u3000]/g, '')
    return c === kn || c.includes(kn)
  })
}

/**
 * ヘッダー行からマッピングを検出する（行内に日付セルがなく、
 * 「入金/出金/残高」等のキーワードが揃っている行）
 */
function detectMappingFromHeaderRow(rows: RawTableRow[]): ColumnMapping | null {
  for (const row of rows) {
    if (row.cells.some((c) => isDateCell(c))) continue
    let dateCol = -1
    let descCol = -1
    let depositCol = -1
    let withdrawCol = -1
    let balanceCol = -1
    let signedCol = -1

    // 第1パス: 「入出金/出入金」は最優先でマーク
    // (HEADER_DEPOSIT の '出金' 等が '入出金' に誤マッチするのを防ぐ)
    for (let i = 0; i < row.cells.length; i++) {
      const c = (row.cells[i] || '').replace(/[\s\u3000]/g, '')
      if (signedCol < 0 && ['入出金', '出入金', '入出金額', '出入金額'].some((k) => c === k || c.includes(k))) {
        signedCol = i
      }
    }

    // 第2パス: その他の列
    for (let i = 0; i < row.cells.length; i++) {
      if (i === signedCol) continue
      const cell = row.cells[i]
      if (!cell) continue
      if (dateCol < 0 && matchHeaderKeyword(cell, HEADER_DATE)) dateCol = i
      else if (depositCol < 0 && matchHeaderKeyword(cell, HEADER_DEPOSIT)) depositCol = i
      else if (withdrawCol < 0 && matchHeaderKeyword(cell, HEADER_WITHDRAW)) withdrawCol = i
      else if (balanceCol < 0 && matchHeaderKeyword(cell, HEADER_BALANCE)) balanceCol = i
      else if (descCol < 0 && matchHeaderKeyword(cell, HEADER_DESC)) descCol = i
      else if (signedCol < 0 && matchHeaderKeyword(cell, HEADER_SIGNED)) signedCol = i
    }
    // 符号付1列モード: 日付 + 入出金列 があり、入金/出金の専用列は無い
    // 残高列は任意（無ければ -1 として 0 から running で算出）
    if (dateCol >= 0 && signedCol >= 0 && depositCol < 0 && withdrawCol < 0) {
      return {
        dateColumn: dateCol,
        descriptionColumn: descCol,
        depositColumn: signedCol,
        withdrawalColumn: signedCol,
        balanceColumn: balanceCol, // -1 の場合は extractTransactions で 0 初期
        signedAmountColumn: signedCol,
      }
    }
    // 通常モード: 日付 + 残高 + (入金 or 出金)
    if (dateCol >= 0 && balanceCol >= 0 && (depositCol >= 0 || withdrawCol >= 0)) {
      return {
        dateColumn: dateCol,
        descriptionColumn: descCol,
        depositColumn: depositCol >= 0 ? depositCol : withdrawCol,
        withdrawalColumn: withdrawCol >= 0 ? withdrawCol : depositCol,
        balanceColumn: balanceCol,
      }
    }
  }
  return null
}

/**
 * 列の役割を自動検出する
 */
function detectColumnMapping(rows: RawTableRow[]): ColumnMapping | null {
  if (rows.length < 2) return null

  // まずヘッダー行から列名で検出を試みる（精度が高い）
  const headerMapping = detectMappingFromHeaderRow(rows)
  if (headerMapping) return headerMapping

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
 * ヘッダー行に「取引区分」列があれば、その列インデックスを返す
 * 「摘要」列と併存する場合のみ有効とする（同列なら無視）
 */
function detectTransactionTypeColumn(
  rows: RawTableRow[],
  descriptionColumn: number,
): number {
  const HEADER_KEYWORDS = ['取引区分', '区分', '種別', 'お取引内容', '取引内容', '取引種別']
  for (const row of rows) {
    // ヘッダー行らしいか：日付セルを含まず、テキストセルが複数ある
    const hasDate = row.cells.some((c) => isDateCell(c))
    if (hasDate) continue
    const hasDesc = row.cells.some((c) => matchHeaderKeyword(c, ['摘要']))
    if (!hasDesc) continue
    for (let i = 0; i < row.cells.length; i++) {
      if (i === descriptionColumn) continue
      if (matchHeaderKeyword(row.cells[i], HEADER_KEYWORDS)) {
        return i
      }
    }
  }
  return -1
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
  const txTypeCol = mapping.transactionTypeColumn
  const hasTxType = typeof txTypeCol === 'number' && txTypeCol >= 0
  const hasBalanceCol = mapping.balanceColumn >= 0
  let runningBalance = 0 // 残高列がない場合のために running 集計

  for (const row of rows) {
    const dateText = row.cells[mapping.dateColumn] || ''
    const date = parseDate(dateText)
    if (!date) continue // 日付のない行はスキップ（ヘッダー等）

    const baseDesc =
      mapping.descriptionColumn >= 0
        ? row.cells[mapping.descriptionColumn] || ''
        : ''
    const txTypeText = hasTxType ? (row.cells[txTypeCol!] || '').trim() : ''
    // 取引区分がある場合は「取引区分 摘要」として結合
    const description =
      txTypeText && baseDesc.trim()
        ? `${txTypeText} ${baseDesc.trim()}`
        : txTypeText || baseDesc

    let balance: number | null = null
    if (hasBalanceCol) {
      const balanceText = row.cells[mapping.balanceColumn] || ''
      balance = parseAmount(balanceText)
      if (balance === null) continue // 残高列があるのに空の行はスキップ
    }

    let deposit: number | null = null
    let withdrawal: number | null = null

    // 符号付き1列モード: 正=入金, 負=出金
    if (typeof mapping.signedAmountColumn === 'number' && mapping.signedAmountColumn >= 0) {
      const signedText = row.cells[mapping.signedAmountColumn] || ''
      const signed = parseSignedAmount(signedText)
      if (signed != null) {
        if (signed > 0) deposit = signed
        else if (signed < 0) withdrawal = Math.abs(signed)
      }
    } else {
      const depositText = row.cells[mapping.depositColumn] || ''
      const withdrawalText =
        mapping.withdrawalColumn !== mapping.depositColumn
          ? row.cells[mapping.withdrawalColumn] || ''
          : ''
      deposit = parseAmount(depositText)
      withdrawal =
        mapping.withdrawalColumn !== mapping.depositColumn
          ? parseAmount(withdrawalText)
          : null
    }

    // 残高列が無い場合は running で集計（開始残高0）
    if (!hasBalanceCol) {
      runningBalance += (deposit ?? 0) - (withdrawal ?? 0)
      balance = runningBalance
    }

    transactions.push({
      id: generateId(),
      pageIndex,
      rowIndex: row.rowIndex,
      date,
      description,
      deposit: deposit ?? null,
      withdrawal: withdrawal ?? null,
      balance: balance!,
      boundingBox: row.boundingBox,
    })
  }

  return transactions
}

/**
 * メインのパースエントリポイント
 */
export async function parseFile(file: File, accountCode?: string): Promise<ParseResult> {
  const fileName = file.name.toLowerCase()

  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    return parseExcelFile(file)
  } else if (fileName.endsWith('.csv')) {
    return parseCsvFile(file)
  } else if (fileName.endsWith('.pdf')) {
    return parsePdfFile(file, accountCode)
  } else {
    throw new Error(
      '対応していないファイル形式です。PDF (.pdf), Excel (.xlsx, .xls), CSV (.csv) のいずれかを選択してください。',
    )
  }
}

/**
 * CSVを読み込んで解析（UTF-8, Shift-JIS 自動判定）
 */
async function parseCsvFile(file: File): Promise<ParseResult> {
  const buffer = await file.arrayBuffer()
  const text = decodeCsvText(buffer)
  const rows = parseCsvText(text)
  if (rows.length === 0) {
    return { pages: [], rawPages: [[]], sourceType: 'excel', needsColumnMapping: true }
  }
  const rawRows: RawTableRow[] = rows.map((cells, i) => ({ cells, rowIndex: i }))
  const allRawPages = [rawRows]
  const mapping = detectColumnMappingFromAllPages(allRawPages)
  if (!mapping) {
    return { pages: [], rawPages: allRawPages, sourceType: 'excel', needsColumnMapping: true }
  }
  const transactions = extractTransactions(rawRows, mapping, 0)
  const statementPages: StatementPage[] = [{
    pageIndex: 0,
    transactions,
    openingBalance: 0,
    closingBalance: 0,
    isBalanceValid: true,
    balanceDifference: 0,
  }]
  return { pages: updatePageBalances(statementPages), sourceType: 'excel', needsColumnMapping: false }
}

// BOM/Shift-JIS判定付きデコード
function decodeCsvText(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  // UTF-8 BOM
  if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    return new TextDecoder('utf-8').decode(bytes.slice(3))
  }
  // UTF-8 として試してみて、化けたら Shift_JIS
  try {
    const asUtf8 = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return asUtf8
  } catch {
    return new TextDecoder('shift_jis').decode(bytes)
  }
}

// CSV をパース（ダブルクォート対応）
function parseCsvText(text: string): string[][] {
  const rows: string[][] = []
  let cur: string[] = []
  let field = ''
  let inQuote = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuote) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }
        else inQuote = false
      } else {
        field += c
      }
    } else {
      if (c === '"') inQuote = true
      else if (c === ',') { cur.push(field); field = '' }
      else if (c === '\r') { /* skip, handled by \n */ }
      else if (c === '\n') { cur.push(field); rows.push(cur); cur = []; field = '' }
      else field += c
    }
  }
  if (field.length > 0 || cur.length > 0) { cur.push(field); rows.push(cur) }
  return rows.filter((r) => r.some((c) => c.trim().length > 0))
}

async function parsePdfFile(file: File, accountCode?: string): Promise<ParseResult> {
  // まずテキスト抽出を試みる
  const { pages: rawPages, isTextPdf } = await parsePdfText(file)

  if (!isTextPdf) {
    // スキャンPDF: Gemini APIでOCR処理
    const imageDataUrls: string[] = []
    const pageCount = rawPages.length > 0 ? rawPages.length : await getPdfPageCount(file)
    console.log(`Scanned PDF detected: ${pageCount} pages`)
    for (let i = 0; i < pageCount; i++) {
      const imageDataUrl = await renderPdfPageToImage(file, i + 1, 2)
      imageDataUrls.push(imageDataUrl)
    }

    try {
      const response = await fetch('/api/bank-statement/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: imageDataUrls, templateHint: accountCode ? getTemplatePromptAddition(accountCode) : '' }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Gemini OCR APIエラー')
      }

      const data = await response.json()
      const apiCorrections: string[] = data.corrections || []
      if (apiCorrections.length > 0) {
        console.log('入出金自動補正:', apiCorrections)
      }

      const geminiPages = data.pages as {
        pageIndex: number
        transactions: {
          date: string
          description: string
          deposit: number | null
          withdrawal: number | null
          balance: number
        }[]
        error?: string
      }[]

      // 全ページの取引数を集計
      const totalTransactions = geminiPages.reduce(
        (sum, gp) => sum + (gp.transactions?.length || 0), 0
      )
      console.log(`Gemini OCR: ${geminiPages.length}ページ, ${totalTransactions}件の取引を検出`)

      // Geminiが取引データを返さなかった場合
      if (totalTransactions === 0) {
        const pageErrors = geminiPages
          .filter((gp) => gp.error)
          .map((gp) => gp.error)
        const errorDetail = pageErrors.length > 0
          ? pageErrors.join(', ')
          : 'Gemini APIは応答しましたが、取引データを検出できませんでした'

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
          ocrErrorMessage: errorDetail,
        }
      }

      const statementPages: StatementPage[] = geminiPages.map((gp, i) => {
        const transactions: BankTransaction[] = (gp.transactions || []).map((t, rowIdx) => ({
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

      // テンプレート自動学習
      if (accountCode) {
        const allTx = statementPages.flatMap((p) => p.transactions)
        if (allTx.length > 0) {
          learnBankTemplate(accountCode, accountCode, allTx)
        }
      }

      return {
        pages: updatePageBalances(statementPages),
        sourceType: 'pdf-ocr',
        needsColumnMapping: false,
        corrections: apiCorrections.length > 0 ? apiCorrections : undefined,
      }
    } catch (err) {
      // Gemini API失敗: 画像のみ表示して手動入力モード
      const errorMessage = err instanceof Error ? err.message : 'OCR処理に失敗しました'
      console.error('Gemini OCR error:', errorMessage)
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
        ocrErrorMessage: errorMessage,
      }
    }
  }

  // テキストPDF
  const allRawPages = rawPages.map((p) => p.rows)
  const mapping = detectColumnMappingFromAllPages(allRawPages)

  if (!mapping) {
    // テキスト抽出はできたが列検出に失敗 → Gemini OCRにフォールバック
    console.log('Text PDF column detection failed, falling back to Gemini OCR')
    const imageDataUrls: string[] = []
    const pageCount = await getPdfPageCount(file)
    for (let i = 0; i < pageCount; i++) {
      imageDataUrls.push(await renderPdfPageToImage(file, i + 1, 2))
    }

    try {
      const response = await fetch('/api/bank-statement/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: imageDataUrls, templateHint: accountCode ? getTemplatePromptAddition(accountCode) : '' }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Gemini OCR APIエラー')
      }

      const data = await response.json()
      const apiCorrections: string[] = data.corrections || []
      const geminiPages = data.pages as {
        pageIndex: number
        transactions: { date: string; description: string; deposit: number | null; withdrawal: number | null; balance: number }[]
      }[]

      const totalTx = geminiPages.reduce((s, gp) => s + (gp.transactions?.length || 0), 0)
      if (totalTx === 0) throw new Error('Gemini OCRでも取引データを検出できませんでした')

      const statementPages: StatementPage[] = geminiPages.map((gp, i) => ({
        pageIndex: i,
        transactions: (gp.transactions || []).map((t, ri) => ({
          id: generateId(), pageIndex: i, rowIndex: ri,
          date: t.date, description: t.description || '',
          deposit: t.deposit ?? null, withdrawal: t.withdrawal ?? null,
          balance: t.balance ?? 0,
        })),
        openingBalance: 0, closingBalance: 0, isBalanceValid: true, balanceDifference: 0,
        imageDataUrl: imageDataUrls[i],
      }))

      return {
        pages: updatePageBalances(statementPages),
        sourceType: 'pdf-text' as const,
        needsColumnMapping: false,
        corrections: apiCorrections.length > 0 ? apiCorrections : undefined,
      }
    } catch {
      // Gemini OCRも失敗 → 列マッピングダイアログを表示
      return {
        pages: [],
        rawPages: allRawPages,
        sourceType: 'pdf-text' as const,
        needsColumnMapping: true,
      }
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
  const mapping = detectColumnMapping(allRows)
  if (!mapping) return null
  const txTypeCol = detectTransactionTypeColumn(allRows, mapping.descriptionColumn)
  if (txTypeCol >= 0) mapping.transactionTypeColumn = txTypeCol
  return mapping
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
