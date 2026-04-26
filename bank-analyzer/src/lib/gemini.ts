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
      "備考": "<読み取りが不確実な箇所があれば記載、なければ空文字>"
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
- 取引が0件であっても "取引": [] を返してください。`
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

function verifyBalances(
  startBalance: number,
  rows: RawRow[]
): { ok: boolean; mismatches: number[]; expectedFinalBalance: number } {
  let prev = startBalance
  const mismatches: number[] = []
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const dep = parseNumber(r.入金額)
    const wd = parseNumber(r.出金額)
    const bal = parseNumber(r.残高)
    const expected = prev + dep - wd
    if (Math.abs(expected - bal) > 0.5) mismatches.push(i)
    prev = bal
  }
  return { ok: mismatches.length === 0, mismatches, expectedFinalBalance: prev }
}

async function callGemini(pdfBase64: string, prompt: string): Promise<RawAnalysis> {
  const genAI = getClient()
  const model = genAI.getGenerativeModel({
    model: MODEL,
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
      // gemini-2.5-flash の思考プロセスを無効化して高速化
      // （構造抽出タスクには思考は不要）
      // @ts-expect-error thinkingConfig は SDK 型定義に未追加
      thinkingConfig: { thinkingBudget: 0 }
    }
  })

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
  return JSON.parse(text) as RawAnalysis
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
    return {
      id: `${passbookId}-p${pageNumber ?? 0}-tx-${idx}`,
      date: iso || (r.年月日 || ''),
      description: (r.摘要 || '').trim(),
      deposit: parseNumber(r.入金額),
      withdrawal: parseNumber(r.出金額),
      balance: parseNumber(r.残高),
      remarks: (r.備考 || '').trim(),
      pageNumber
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
    analysis = await callGemini(pdfBase64, prompt)
  } catch (err) {
    throw new Error(`Gemini API 呼び出しエラー（${pageInfo.current}p）: ${(err as Error).message}`)
  }

  const rows = analysis.取引 || []
  const startBalance = parseNumber(analysis.開始残高)
  const declaredEnd = parseNumber(analysis.終了残高)
  const verification = verifyBalances(startBalance, rows)

  if (!verification.ok || (rows.length > 0 && Math.abs(verification.expectedFinalBalance - declaredEnd) > 0.5)) {
    const retryPrompt = `${prompt}

【再解析の指示】
前回の読み取り結果は残高の整合性が取れていません（不一致行: ${verification.mismatches.length}件）。
PDFを再度確認して正しい数値で出力し直してください。
前回結果: ${JSON.stringify(analysis).slice(0, 4000)}

JSONのみを返してください。`
    try {
      const retry = await callGemini(pdfBase64, retryPrompt)
      const retryRows = retry.取引 || []
      const retryVerification = verifyBalances(parseNumber(retry.開始残高), retryRows)
      if (retryVerification.ok) {
        return { analysis: retry, warnings }
      }
      warnings.push(
        `${pageInfo.current}ページ目: 残高不一致が${retryVerification.mismatches.length}行残っています。`
      )
      for (const idx of retryVerification.mismatches) {
        if (retryRows[idx]) {
          retryRows[idx].備考 = ((retryRows[idx].備考 || '') + ' 残高不一致').trim()
        }
      }
      return { analysis: retry, warnings }
    } catch (err) {
      warnings.push(`${pageInfo.current}ページ目 再解析失敗: ${(err as Error).message}`)
      for (const idx of verification.mismatches) {
        if (rows[idx]) rows[idx].備考 = ((rows[idx].備考 || '') + ' 残高不一致').trim()
      }
    }
  }

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
    const rows = (analysis.取引 || []).filter((r) => isInRange(r.年月日 || '', startDate, endDate))
    return {
      passbookId,
      fileName,
      bankName: analysis.銀行名 || bankName || '',
      branchName: analysis.支店名 || branchName || '',
      accountNumber: analysis.口座番号 || accountNumber || '',
      label,
      purpose: '',
      startBalance: parseNumber(analysis.開始残高),
      endBalance: parseNumber(analysis.終了残高),
      transactions: rowsToTransactions(rows, passbookId, { startDate, endDate }, 1),
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
    const pageRows = (r.analysis.取引 || []).filter((row) =>
      isInRange(row.年月日 || '', startDate, endDate)
    )
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

  // 取引を日付順に整列（ページ並列で順番が乱れないよう保険）
  allTransactions.sort((a, b) => {
    const da = parseLooseDate(a.date)?.getTime() ?? 0
    const db = parseLooseDate(b.date)?.getTime() ?? 0
    if (da !== db) return da - db
    return (a.pageNumber ?? 0) - (b.pageNumber ?? 0)
  })

  // ID重複しないよう振り直し
  allTransactions.forEach((tx, i) => {
    tx.id = `${passbookId}-tx-${i}`
  })

  return {
    passbookId,
    fileName,
    bankName: inferredBank,
    branchName: inferredBranch,
    accountNumber: inferredAccount,
    label,
    purpose: '',
    startBalance: firstStart,
    endBalance: lastEnd,
    transactions: allTransactions,
    warnings
  }
}
