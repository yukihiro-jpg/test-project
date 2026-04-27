import { GoogleGenerativeAI } from '@google/generative-ai'
import type { DepositRow, ParsedBalanceCert } from '@/types'
import { parseLooseDate, toIsoDate } from './wareki'

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'

type RawCertRow = {
  銀行名?: string
  支店名?: string
  種類?: string
  口座番号?: string
  金額?: number | string
  経過利息?: number | string
  備考?: string
}

type RawCertAnalysis = {
  銀行名?: string
  支店名?: string
  証明日?: string
  発行日?: string
  口座一覧?: RawCertRow[]
}

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set')
  return new GoogleGenerativeAI(apiKey)
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

function buildPrompt(): string {
  return `あなたは日本の銀行・ゆうちょ銀行・信用金庫等が発行する「残高証明書」PDFを正確に読み取るOCRアシスタントです。

【目的】
残高証明書から、口座ごとの残高情報を抽出してJSONで返します。

【抽出する項目】
- 銀行名 (例: 常陽銀行、ゆうちょ銀行、三井住友銀行)
- 支店名 (例: 多賀支店、本店営業部)
- 証明日: その残高証明書が「○年○月○日現在の残高」と証明している日付（基準日）
- 発行日: 残高証明書を発行した日付（証明書冒頭・右上などに書かれている日付）
- 口座一覧:
  - 種類: 普通預金 / 定期預金 / 通常貯金 / 通常貯蓄貯金 / 当座預金 / 国債 など
  - 口座番号 (記号番号があれば「10610-37630521」形式でハイフンつなぎ可)
  - 金額 (円)
  - 経過利息 (税引後の経過利息額。「経過利息(税引き後)¥417」のような表記から数値だけを抽出。明記なければ0)
  - 備考 (経過利息の元表記や、市場価格、その他特記事項など、必要に応じて短く)

【日付フォーマット】
証明日・発行日は西暦4桁の "YYYY/MM/DD" で返す。
和暦表記（令和○年○月○日）の場合も西暦に変換して返す。

【数値ルール】
- 金額は半角数字・カンマなし
- 「¥」「￥」「円」記号は除去
- 「以下余白」「以上」「---」のような行は無視
- 空欄行は含めない

【出力形式】以下のJSONのみを返してください。説明文・コードブロックは不要です。

{
  "銀行名": "<銀行名。複数の銀行が混在する場合は最も主要な1つ>",
  "支店名": "<支店名。複数なら最初の1つ>",
  "証明日": "YYYY/MM/DD",
  "発行日": "YYYY/MM/DD",
  "口座一覧": [
    {
      "銀行名": "<銀行名(行ごとに違うなら明記)>",
      "支店名": "<支店名>",
      "種類": "普通預金 など",
      "口座番号": "<口座番号>",
      "金額": <number>,
      "経過利息": <number, なければ0>,
      "備考": "<必要なら>"
    }
  ]
}

口座が0件であっても "口座一覧": [] を返してください。`
}

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

async function callGeminiOnce(pdfBase64: string, prompt: string): Promise<RawCertAnalysis> {
  const genAI = getClient()
  const model = genAI.getGenerativeModel({
    model: MODEL,
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json'
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
  if (!text || !text.trim()) return {}
  return JSON.parse(text) as RawCertAnalysis
}

async function callGemini(pdfBase64: string, prompt: string, maxAttempts = 3): Promise<RawCertAnalysis> {
  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await callGeminiOnce(pdfBase64, prompt)
    } catch (err) {
      lastError = err
      if (!isTransientError(err) || attempt === maxAttempts) throw err
      const delay = 1000 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 500)
      console.warn(`[balance-cert] 一時エラー、${delay}ms後にリトライ (${attempt}/${maxAttempts})`)
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  throw lastError
}

function normalizeDate(input: string | undefined): string {
  if (!input) return ''
  const d = parseLooseDate(input)
  return d ? toIsoDate(d) : input
}

export async function analyzeBalanceCertificate(opts: {
  certId: string
  fileName: string
  pdfBase64: string
}): Promise<ParsedBalanceCert> {
  const { certId, fileName, pdfBase64 } = opts
  const warnings: string[] = []
  const prompt = buildPrompt()

  let analysis: RawCertAnalysis
  try {
    analysis = await callGemini(pdfBase64, prompt)
  } catch (err) {
    throw new Error(`残高証明書の解析に失敗しました: ${(err as Error).message}`)
  }

  const fallbackBank = analysis.銀行名 || ''
  const fallbackBranch = analysis.支店名 || ''

  const rows: DepositRow[] = (analysis.口座一覧 || []).map((r, idx) => ({
    id: `${certId}-r${idx}`,
    bankName: r.銀行名 || fallbackBank,
    branchName: r.支店名 || fallbackBranch,
    accountType: (r.種類 || '').trim(),
    accountNumber: (r.口座番号 || '').trim(),
    amount: parseNumber(r.金額),
    accruedInterest: parseNumber(r.経過利息),
    hasCertificate: true,
    remarks: (r.備考 || '').trim(),
    sourceFileName: fileName
  }))

  return {
    certId,
    fileName,
    referenceDate: normalizeDate(analysis.証明日),
    issueDate: normalizeDate(analysis.発行日),
    rows,
    warnings
  }
}
