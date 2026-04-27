import { GoogleGenerativeAI } from '@google/generative-ai'
import { PDFDocument } from 'pdf-lib'
import type { ParsedPassbook, Transaction } from '@/types'
import { parseLooseDate, toIsoDate } from './wareki'

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
const PAGE_PARALLELISM = Number(process.env.GEMINI_PAGE_PARALLELISM || '5')

type RawRow = {
  銀行名?: string
  支店名?: string
  口座番号?: string
  年月日?: string
  摘要?: string
  入金額?: number | string
  出金額?: number | string
  残高?: number | string
  備考?: string
  page_no?: number | string
}

type RawAnalysis = {
  銀行名?: string
  支店名?: string
  口座番号?: string
  開始残高?: number | string
  終了残高?: number | string
  取引?: RawRow[]
}

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set')
  return new GoogleGenerativeAI(apiKey)
}

function buildPrompt(opts: {
  startDate: string
  endDate: string
  bankName?: string
  branchName?: string
  accountNumber?: string
  pageInfo?: { current: number; total: number }
}) {
  const { startDate, endDate, bankName, branchName, accountNumber, pageInfo } = opts
  const pageHeader = pageInfo
    ? `※このPDFは元の通帳の **${pageInfo.current} / ${pageInfo.total} ページ目** だけを抜き出したものです。このページに記載されている取引のみを抽出してください。\n`
    : ''
  return `あなたは日本の銀行通帳・取引明細PDFを正確に読み取るOCRアシスタントです。
${pageHeader}以下のPDFから取引明細を抽出してください${bankName ? `（${bankName}${branchName ? ' ' + branchName : ''}）` : ''}。

【抽出対象列】取引日、摘要、出金額、入金額、残高 の5項目のみ。
それ以外（内訳、区分、振り金、預り金等）は無視してください。

【列名のバリエーション】通帳によって列名が異なります。以下を同義として扱ってください。
- 入金 = お預り金額 = お預入額 = 預入金額 = 受入金額 = 振込・入金 = 預入
- 出金 = お支払金額 = お引出額 = 引出金額 = 支払金額 = 振替・出金 = 引出
- 残高 = 差引残高 = 現在高 = 残額
- 列の左右の並び順は通帳によって異なります。必ず**列ヘッダの文字**で入金/出金を判別し、位置で判断しないでください。

【期間フィルタ】${startDate} 〜 ${endDate} の範囲に含まれる取引のみを抽出してください。範囲外は除外。
ただし、開始残高（${startDate}直前または当日の残高）と終了残高（${endDate}時点または最終取引後の残高）はトップレベルに含めてください。

【日付の解釈ルール（極めて重要）】
- 通帳の日付は「YY-MM-DD」「YY.MM.DD」「YY/MM/DD」のように**2桁の年**で印字されることが頻繁にあります（例: 07-12-29）。これは西暦ではなく**和暦の年**です。
- 2桁年は次の優先順位で和暦に解決してください:
  1. **令和**（令和元年 = 2019年5月1日以降）として解釈し、指定期間 ${startDate} 〜 ${endDate} に収まるか確認
  2. 収まらなければ**平成**（平成元年 = 1989年1月8日〜2019年4月30日）
  3. それでも収まらなければ**昭和**
- 解決した結果は必ず西暦4桁の "YYYY/MM/DD" 形式で出力してください。

【出力形式】以下のJSONのみを返してください。説明文・コードブロックは不要です。

{
  "銀行名": "${bankName || ''}",
  "支店名": "${branchName || ''}",
  "口座番号": "${accountNumber || ''}",
  "開始残高": <number, このページの最初の取引の直前の残高>,
  "終了残高": <number, このページの最後の取引後の残高>,
  "取引": [
    {
      "年月日": "YYYY/MM/DD",
      "摘要": "<取引の摘要>",
      "入金額": <number, 入金でなければ0>,
      "出金額": <number, 出金でなければ0>,
      "残高": <number, その取引後の残高>,
      "備考": "<読み取りが不確実な箇所があれば記載、なければ空文字>",
      "page_no": <number, この取引が記載されているPDFの物理ページ番号（1始まり）>
    }
  ]
}

【重要なルール】
- 残高は「前の行の残高 + 入金額 - 出金額」と一致するはずです。一致しない場合は画像をよく確認し、正確な数値を読み取ってください。
- それでも不一致の場合は備考に「読取不確実」と記載してください。
- 金額のカンマ・全角数字・△記号（マイナス）・▲記号（マイナス）に注意してください。
- 残高欄に印字される「*」「＊」「¥」「￥」「\\」「※」などの**記号は除去**して、純粋な数値だけを返してください（例: "*15,896,267" → 15896267）。
- 数値は半角数字で、カンマなしで返してください。
- ヘッダー行・タイトル行・小計行・ページ番号行は含めないでください。

【取引ではない案内行・小計行を除外】次のような「取引ではない行」は **取引リストに含めないでください**:
  - 「窓口または店舗内のATMにて新通帳への繰り越しをお願いします」など、新通帳作成・繰越の案内文
  - 「ただ今の取引記帳残高　〇〇〇円」「お預り合計」「現在残高」など、残高や合計を表示するだけの行
  - 「次ページへ続く」「以下余白」などの案内行
  - 通帳冒頭の「お取扱店」「口座開設日」など、取引と関係ない情報行
  - **「今回のお支払」「今回のお預入」「今回お引出」「今回お預け入」「今回の取引」「今回の合計」など、ページ末尾の小計行**
    （金額が入っていても通帳の取引行ではなく、そのページ内の出金合計や入金合計を表示するだけの行）

- 取引が0件であっても "取引": [] を返してください。`
}

// 念のためサーバー側でも除外フィルタをかける（Gemini が見落としても落とせるよう二重化）

// 「今回の○○」「合計」など、金額が入っていても **取引ではない小計行**。
// 摘要/備考に含まれていれば金額に関係なく除外する。
const SUMMARY_KEYWORDS = [
  '今回のお支払',
  '今回お支払',
  '今回支払',
  '今回のお預入',
  '今回のお預け入',
  '今回お預入',
  '今回お預け入',
  '今回お引出',
  '今回お引き出し',
  '今回引出',
  '今回引き出し',
  '今回の取引',
  '今回の合計',
  'お預り合計',
  'お支払合計',
  'お引出合計',
  '取引合計'
]

// 案内・残高表示など、金額が0のときだけ除外するキーワード
const NOTICE_KEYWORDS = [
  '繰り越し',
  '繰越',
  '新通帳',
  'ただ今',
  '記帳残高',
  '現在残高',
  '現在高表示',
  '通帳更新',
  '次ページへ続',
  '以下余白',
  'お取扱店',
  '口座開設'
]

function isTransitionRow(row: RawRow): boolean {
  const text = `${row.摘要 || ''} ${row.備考 || ''}`
  // 小計行（金額があっても取引ではない）
  if (SUMMARY_KEYWORDS.some((kw) => text.includes(kw))) return true
  // 案内行（金額が0のときだけ除外）
  const dep = parseNumber(row.入金額)
  const wd = parseNumber(row.出金額)
  if (dep !== 0 || wd !== 0) return false
  return NOTICE_KEYWORDS.some((kw) => text.includes(kw))
}

function parseNumber(value: number | string | undefined): number {
  if (typeof value === 'number') return value
  if (!value) return 0
  const cleaned = String(value)
    .replace(/[,，]/g, '')
    .replace(/[△▲−ー―]/g, '-')
    .replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
    .replace(/[*＊¥￥\\※\s　]/g, '')
    .replace(/円/g, '')
    .trim()
  const num = Number(cleaned)
  return isNaN(num) ? 0 : num
}

function isInRange(date: string, start: string, end: string): boolean {
  const d = parseLooseDate(date, { rangeStart: start, rangeEnd: end })
  const s = parseLooseDate(start)
  const e = parseLooseDate(end)
  if (!d || !s || !e) return true
  return d.getTime() >= s.getTime() && d.getTime() <= e.getTime()
}

async function callGemini(pdfBase64: string, prompt: string, label = ''): Promise<RawAnalysis> {
  const genAI = getClient()
  const generationConfig: Record<string, unknown> = {
    temperature: 0.1,
    responseMimeType: 'application/json'
  }
  // 注意: gemini-2.5-flash は OCR にも thinking を使うため、
  // thinkingBudget=0 にすると PDF を読まずにテンプレを返してくる。
  // 既定では thinking 有効のまま。明示的に OFF にしたい場合のみ
  // .env.local に GEMINI_DISABLE_THINKING=true を設定する。
  if (process.env.GEMINI_DISABLE_THINKING === 'true') {
    generationConfig.thinkingConfig = { thinkingBudget: 0 }
  }
  const model = genAI.getGenerativeModel({
    model: MODEL,
    generationConfig: generationConfig as never
  })

  try {
    const result = await model.generateContent([
      { text: prompt },
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: pdfBase64
        }
      }
    ])

    const text = result.response.text()
    if (!text || !text.trim()) {
      console.warn(`[gemini] ${label} 空レスポンス`)
      return {}
    }
    try {
      const parsed = JSON.parse(text) as RawAnalysis
      const txCount = parsed.取引?.length ?? 0
      const sb = parsed.開始残高 ?? '?'
      const eb = parsed.終了残高 ?? '?'
      console.log(
        `[gemini] ${label} 受信: 取引${txCount}件 / 開始残高=${sb} / 終了残高=${eb}` +
          (txCount === 0 ? `\n  raw response (1KB): ${text.slice(0, 1000)}` : '')
      )
      return parsed
    } catch (e) {
      console.error(`[gemini] ${label} JSONパース失敗:`, text.slice(0, 500))
      throw new Error(`JSONパース失敗: ${(e as Error).message}`)
    }
  } catch (err) {
    console.error(`[gemini] ${label} 呼び出しエラー:`, err)
    throw err
  }
}

// 500/503/429 など一時エラーの判定
function isTransientError(err: unknown): boolean {
  if (!err) return false
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase()
  return (
    msg.includes('500') ||
    msg.includes('503') ||
    msg.includes('429') ||
    msg.includes('internal error') ||
    msg.includes('unavailable') ||
    msg.includes('overloaded') ||
    msg.includes('deadline') ||
    msg.includes('timeout') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('fetch failed')
  )
}

async function callGeminiWithRetry(
  pdfBase64: string,
  prompt: string,
  label = '',
  maxAttempts = 3
): Promise<RawAnalysis> {
  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await callGemini(pdfBase64, prompt, label)
    } catch (err) {
      lastError = err
      const transient = isTransientError(err)
      if (!transient || attempt === maxAttempts) throw err
      // 指数バックオフ: 1s, 2s, 4s + 0〜500ms のジッタ
      const delayMs = 1000 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 500)
      const msg = (err instanceof Error ? err.message : String(err)).slice(0, 120)
      console.warn(
        `[gemini] ${label} 一時エラー、${delayMs}ms後にリトライ (${attempt}/${maxAttempts}): ${msg}`
      )
      await new Promise((r) => setTimeout(r, delayMs))
    }
  }
  throw lastError
}

function rowsToTransactions(
  rows: RawRow[],
  passbookId: string,
  range: { startDate: string; endDate: string },
  pageNumber?: number
): Transaction[] {
  return rows.map((r, idx) => {
    const parsed = parseLooseDate(r.年月日 || '', { rangeStart: range.startDate, rangeEnd: range.endDate })
    const iso = parsed ? toIsoDate(parsed) : ''
    // 明示的な pageNumber（ページ分割モード）を優先し、
    // なければ Gemini が返した page_no を採用（単一PDFモード/フォールバック用）
    const reportedPage =
      r.page_no !== undefined && r.page_no !== null && r.page_no !== ''
        ? Number(r.page_no)
        : undefined
    const pn = pageNumber ?? (reportedPage && !isNaN(reportedPage) ? reportedPage : undefined)
    return {
      id: `${passbookId}-p${pn ?? 0}-tx-${idx}`,
      date: iso || (r.年月日 || ''),
      description: (r.摘要 || '').trim(),
      deposit: parseNumber(r.入金額),
      withdrawal: parseNumber(r.出金額),
      balance: parseNumber(r.残高),
      remarks: (r.備考 || '').trim(),
      pageNumber: pn
    }
  })
}

async function splitPdfPerPage(pdfBuf: Buffer): Promise<{ index: number; base64: string }[]> {
  const src = await PDFDocument.load(pdfBuf, { ignoreEncryption: true })
  const total = src.getPageCount()
  const out: { index: number; base64: string }[] = []
  for (let i = 0; i < total; i++) {
    const dest = await PDFDocument.create()
    const [page] = await dest.copyPages(src, [i])
    dest.addPage(page)
    const bytes = await dest.save()
    out.push({ index: i + 1, base64: Buffer.from(bytes).toString('base64') })
  }
  return out
}

async function analyzePage(
  pdfBase64: string,
  pageInfo: { current: number; total: number },
  opts: {
    startDate: string
    endDate: string
    bankName?: string
    branchName?: string
    accountNumber?: string
  }
): Promise<{ analysis: RawAnalysis; warnings: string[] }> {
  const prompt = buildPrompt({ ...opts, pageInfo })
  const warnings: string[] = []

  let analysis: RawAnalysis
  try {
    analysis = await callGeminiWithRetry(pdfBase64, prompt, `page ${pageInfo.current}/${pageInfo.total}`)
  } catch (err) {
    throw new Error(`Gemini API 呼び出しエラー（${pageInfo.current}p）: ${(err as Error).message}`)
  }

  // 残高不一致の自動リトライは廃止。
  // 不一致はクライアント側で赤ハイライトしてユーザーに修正してもらう方針。
  return { analysis, warnings }
}

export async function analyzePassbook(opts: {
  passbookId: string
  fileName: string
  label: string
  bankName?: string
  branchName?: string
  accountNumber?: string
  startDate: string
  endDate: string
  pdfBase64: string
}): Promise<ParsedPassbook> {
  const {
    passbookId,
    fileName,
    label,
    bankName,
    branchName,
    accountNumber,
    startDate,
    endDate,
    pdfBase64
  } = opts

  const warnings: string[] = []

  const pdfBuf = Buffer.from(pdfBase64, 'base64')
  let pages: { index: number; base64: string }[] = []
  try {
    pages = await splitPdfPerPage(pdfBuf)
  } catch (err) {
    warnings.push(`PDF分割失敗、単一処理にフォールバック: ${(err as Error).message}`)
  }

  // ページ分割できない/1ページしかない場合は丸ごと1回呼ぶ
  if (pages.length <= 1) {
    const { analysis, warnings: w } = await analyzePage(
      pdfBase64,
      { current: 1, total: 1 },
      { startDate, endDate, bankName, branchName, accountNumber }
    )
    warnings.push(...w)
    const rows = (analysis.取引 || [])
      .filter((r) => !isTransitionRow(r))
      .filter((r) => isInRange(r.年月日 || '', startDate, endDate))
    const txs = rowsToTransactions(rows, passbookId, { startDate, endDate }, 1)
    // 開始残高は期間内最初の取引から逆算
    let startBalanceVal: number | null = parseNumber(analysis.開始残高) || null
    if (txs.length > 0) {
      const first = txs[0]
      startBalanceVal = first.balance - first.deposit + first.withdrawal
    }
    return {
      passbookId,
      fileName,
      bankName: analysis.銀行名 || bankName || '',
      branchName: analysis.支店名 || branchName || '',
      accountNumber: analysis.口座番号 || accountNumber || '',
      label,
      purpose: '',
      startBalance: startBalanceVal,
      endBalance: parseNumber(analysis.終了残高),
      transactions: txs,
      warnings
    }
  }

  // ページ並列処理
  const total = pages.length
  type PageResult = {
    page: number
    analysis: RawAnalysis
    warnings: string[]
  }
  const results: PageResult[] = new Array(total)
  let cursor = 0
  const workers = Array.from({ length: Math.min(PAGE_PARALLELISM, total) }, async () => {
    while (cursor < pages.length) {
      const my = cursor++
      const p = pages[my]
      try {
        const r = await analyzePage(
          p.base64,
          { current: p.index, total },
          { startDate, endDate, bankName, branchName, accountNumber }
        )
        results[my] = { page: p.index, analysis: r.analysis, warnings: r.warnings }
      } catch (err) {
        warnings.push(`${p.index}ページ目の解析失敗: ${(err as Error).message}`)
        results[my] = { page: p.index, analysis: { 取引: [] }, warnings: [] }
      }
    }
  })
  await Promise.all(workers)

  // ページ間で銀行名・口座番号を補完（最初に値があったページから）
  const inferredBank = results.find((r) => r.analysis.銀行名)?.analysis.銀行名 || bankName || ''
  const inferredBranch = results.find((r) => r.analysis.支店名)?.analysis.支店名 || branchName || ''
  const inferredAccount = results.find((r) => r.analysis.口座番号)?.analysis.口座番号 || accountNumber || ''

  // 全ページの取引を結合（ページ番号付き）
  const allTransactions: Transaction[] = []
  let firstStart: number | null = null
  let lastEnd: number | null = null
  let lastPageEnd: number | null = null

  for (const r of results) {
    if (!r) continue
    warnings.push(...r.warnings)
    const pageRows = (r.analysis.取引 || [])
      .filter((row) => !isTransitionRow(row))
      .filter((row) => isInRange(row.年月日 || '', startDate, endDate))
    const pageStart = parseNumber(r.analysis.開始残高)
    const pageEnd = parseNumber(r.analysis.終了残高)

    if (firstStart === null && pageStart) firstStart = pageStart
    if (pageRows.length > 0) lastEnd = pageEnd

    // ページ境界の残高接続チェック
    if (lastPageEnd !== null && pageStart && Math.abs(lastPageEnd - pageStart) > 0.5) {
      warnings.push(
        `${r.page}ページ目の開始残高(${pageStart.toLocaleString()})が前ページ終了残高(${lastPageEnd.toLocaleString()})と一致しません`
      )
    }
    if (pageEnd) lastPageEnd = pageEnd

    allTransactions.push(...rowsToTransactions(pageRows, passbookId, { startDate, endDate }, r.page))
  }

  // フォールバック: 全ページ並列で取引が0件 → 単一PDFモードでもう一度試す
  if (allTransactions.length === 0) {
    console.warn(
      `[gemini] ${label}: ページ並列で取引0件、単一PDFモードへフォールバック`
    )
    warnings.push('ページ並列で取引が抽出できなかったため、単一PDFモードへフォールバックしました。')
    try {
      const { analysis: full, warnings: fw } = await analyzePage(
        pdfBase64,
        { current: 1, total: 1 },
        { startDate, endDate, bankName, branchName, accountNumber }
      )
      warnings.push(...fw)
      const fullRows = (full.取引 || [])
        .filter((r) => !isTransitionRow(r))
        .filter((r) => isInRange(r.年月日 || '', startDate, endDate))
      const txs = rowsToTransactions(fullRows, passbookId, { startDate, endDate }, 1)
      let startBalanceVal: number | null = parseNumber(full.開始残高) || null
      if (txs.length > 0) {
        const first = txs[0]
        startBalanceVal = first.balance - first.deposit + first.withdrawal
      }
      return {
        passbookId,
        fileName,
        bankName: full.銀行名 || inferredBank,
        branchName: full.支店名 || inferredBranch,
        accountNumber: full.口座番号 || inferredAccount,
        label,
        purpose: '',
        startBalance: startBalanceVal,
        endBalance: parseNumber(full.終了残高),
        transactions: txs,
        warnings
      }
    } catch (err) {
      warnings.push(`単一PDFモードのフォールバックも失敗: ${(err as Error).message}`)
    }
  }

  // 取引をページ番号→日付の順に整列。
  // 通帳の物理ページ順は必ず日付順なので、ページ番号を主キーにすれば
  // 「日付の読み取り誤りによりページ順が逆転して見える」問題を防げる。
  allTransactions.sort((a, b) => {
    const pa = a.pageNumber ?? 0
    const pb = b.pageNumber ?? 0
    if (pa !== pb) return pa - pb
    const da = parseLooseDate(a.date)?.getTime() ?? 0
    const db = parseLooseDate(b.date)?.getTime() ?? 0
    return da - db
  })

  // ID重複しないよう振り直し
  allTransactions.forEach((tx, i) => {
    tx.id = `${passbookId}-tx-${i}`
  })

  // 開始残高は「期間内最初の取引の直前の残高」を厳密に算出する。
  // ページ単独の 開始残高 だと、解析期間が通帳の途中から始まるケースで
  // 期間外取引を含んだ値になり不一致の原因になる。
  let derivedStart: number | null = firstStart
  if (allTransactions.length > 0) {
    const first = allTransactions[0]
    derivedStart = first.balance - first.deposit + first.withdrawal
  }

  return {
    passbookId,
    fileName,
    bankName: inferredBank,
    branchName: inferredBranch,
    accountNumber: inferredAccount,
    label,
    purpose: '',
    startBalance: derivedStart,
    endBalance: lastEnd,
    transactions: allTransactions,
    warnings
  }
}
