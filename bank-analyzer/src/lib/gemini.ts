import { GoogleGenerativeAI } from '@google/generative-ai'
import type { ParsedPassbook, Transaction } from '@/types'
import { parseLooseDate, toIsoDate } from './wareki'

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'

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

function buildPrompt(opts: { startDate: string; endDate: string; bankName?: string; branchName?: string; accountNumber?: string }) {
  const { startDate, endDate, bankName, branchName, accountNumber } = opts
  return `あなたは日本の銀行通帳・取引明細PDFを正確に読み取るOCRアシスタントです。
以下のPDFから取引明細を抽出してください${bankName ? `（${bankName}${branchName ? ' ' + branchName : ''}）` : ''}。

【抽出対象列】取引日、摘要、出金額、入金額、残高 の5項目のみ。
それ以外（内訳、区分、振り金、預り金等）は無視してください。

【期間フィルタ】${startDate} 〜 ${endDate} の範囲に含まれる取引のみを抽出してください。範囲外は除外。
ただし、開始残高（${startDate}直前または当日の残高）と終了残高（${endDate}時点または最終取引後の残高）はトップレベルに含めてください。

【出力形式】以下のJSONのみを返してください。説明文・コードブロックは不要です。

{
  "銀行名": "${bankName || ''}",
  "支店名": "${branchName || ''}",
  "口座番号": "${accountNumber || ''}",
  "開始残高": <number, 期間開始時点の残高>,
  "終了残高": <number, 期間終了時点の残高>,
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
- 数値は半角数字で、カンマなしで返してください。
- 年が省略されている場合は他の情報から推測してください（指定期間内に収まるよう推測）。
- ヘッダー行・タイトル行・小計行は含めないでください。
- 取引が0件であっても "取引": [] を返してください。`
}

function parseNumber(value: number | string | undefined): number {
  if (typeof value === 'number') return value
  if (!value) return 0
  const cleaned = String(value)
    .replace(/[,，]/g, '')
    .replace(/[△▲−]/g, '-')
    .replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
    .trim()
  const num = Number(cleaned)
  return isNaN(num) ? 0 : num
}

function isInRange(date: string, start: string, end: string): boolean {
  const d = parseLooseDate(date)
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
    if (Math.abs(expected - bal) > 0.5) {
      mismatches.push(i)
    }
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
  return JSON.parse(text) as RawAnalysis
}

function rowsToTransactions(rows: RawRow[], passbookId: string): Transaction[] {
  return rows.map((r, idx) => ({
    id: `${passbookId}-tx-${idx}`,
    date: toIsoDate(r.年月日 || '') || (r.年月日 || ''),
    description: (r.摘要 || '').trim(),
    deposit: parseNumber(r.入金額),
    withdrawal: parseNumber(r.出金額),
    balance: parseNumber(r.残高),
    remarks: (r.備考 || '').trim()
  }))
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
  const { passbookId, fileName, label, bankName, branchName, accountNumber, startDate, endDate, pdfBase64 } = opts

  const prompt = buildPrompt({ startDate, endDate, bankName, branchName, accountNumber })
  const warnings: string[] = []

  let analysis: RawAnalysis
  try {
    analysis = await callGemini(pdfBase64, prompt)
  } catch (err) {
    throw new Error(`Gemini API 呼び出しエラー: ${(err as Error).message}`)
  }

  let rows = (analysis.取引 || []).filter((r) => isInRange(r.年月日 || '', startDate, endDate))
  let startBalance = parseNumber(analysis.開始残高)
  const declaredEnd = parseNumber(analysis.終了残高)

  let verification = verifyBalances(startBalance, rows)

  if (!verification.ok || Math.abs(verification.expectedFinalBalance - declaredEnd) > 0.5) {
    const retryPrompt = `${prompt}

【再解析の指示】
前回の読み取り結果は以下です。残高の整合性が取れていません（不一致行: ${verification.mismatches.length}件、計算上の終了残高: ${verification.expectedFinalBalance}, 申告された終了残高: ${declaredEnd}）。
前回の結果を踏まえ、PDFを再度確認して正しい数値で出力し直してください。
不一致行のインデックス: ${JSON.stringify(verification.mismatches)}
前回結果: ${JSON.stringify(analysis).slice(0, 6000)}

JSONのみを返してください。`

    try {
      const retry = await callGemini(pdfBase64, retryPrompt)
      const retryRows = (retry.取引 || []).filter((r) => isInRange(r.年月日 || '', startDate, endDate))
      const retryStart = parseNumber(retry.開始残高)
      const retryVerification = verifyBalances(retryStart, retryRows)
      const retryDeclaredEnd = parseNumber(retry.終了残高)

      if (
        retryVerification.ok &&
        Math.abs(retryVerification.expectedFinalBalance - retryDeclaredEnd) <= 0.5
      ) {
        analysis = retry
        rows = retryRows
        startBalance = retryStart
        verification = retryVerification
      } else {
        warnings.push(
          `残高不一致が残っています（${retryVerification.mismatches.length}行）。手動で確認してください。`
        )
        for (const idx of retryVerification.mismatches) {
          if (retryRows[idx]) {
            retryRows[idx].備考 = ((retryRows[idx].備考 || '') + ' 残高不一致').trim()
          }
        }
        analysis = retry
        rows = retryRows
        startBalance = retryStart
        verification = retryVerification
      }
    } catch (err) {
      warnings.push(`再解析失敗: ${(err as Error).message}`)
      for (const idx of verification.mismatches) {
        if (rows[idx]) {
          rows[idx].備考 = ((rows[idx].備考 || '') + ' 残高不一致').trim()
        }
      }
    }
  }

  const finalDeclaredEnd = parseNumber(analysis.終了残高)
  if (Math.abs(verification.expectedFinalBalance - finalDeclaredEnd) > 0.5) {
    warnings.push(
      `期間全体の終了残高が一致しません（計算上: ${verification.expectedFinalBalance.toLocaleString()}, 申告: ${finalDeclaredEnd.toLocaleString()}）`
    )
  }

  return {
    passbookId,
    fileName,
    bankName: analysis.銀行名 || bankName || '',
    branchName: analysis.支店名 || branchName || '',
    accountNumber: analysis.口座番号 || accountNumber || '',
    label,
    startBalance: startBalance,
    endBalance: parseNumber(analysis.終了残高),
    transactions: rowsToTransactions(rows, passbookId),
    warnings
  }
}
