import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { PDFDocument } from 'pdf-lib'

const PROMPT = `この PDF は日本の銀行の取引明細書です。
通帳・お取引照合表（常陽銀行等）・取引明細書・現金出納帳などの形式があります。
PDF 全ページから必ず取引データを読み取って JSON で返してください。

【必ず守ること】
- 取引行が1つでも見える場合、1行も漏らさずに transactions 配列に含める
- ヘッダ行（取引日/勘定日/摘要/お支払金額/お預り金額/差引残高など）はスキップ
- タイトル行（お取引照合表、口座情報、頁数など）はスキップ
- 複数ページにまたがる場合、全ページから抽出

【横型・見開き通帳の重要な注意】
通帳の見開き2ページを1つの画像/PDFページにスキャンしている場合、
左右に2つの独立した取引表があります（例: 「普通預金 ORDINARY 1」「普通預金 ORDINARY 2」）。
- 必ず左半分の表をすべて読み取ってから、右半分の表を読み取る
- 上から下、左の表が完了してから右の表へ進む順序を守る
- 左半分の最終行と右半分の最初の行は別取引なので混同しない
- 「普通預金 ORDINARY N」のような小さなページ番号表記が左右にある場合、
  それぞれが別々の表ヘッダとして認識する
- 残高の連続性で左右の境界を判定: 左表の最終残高と右表の開始残高の前の繰越残高がほぼ一致

【列構造の認識】
- 日付列: 「日付」「取引日」「年月日」「入金・出金日」「勘定日」
  ※「取引日」と「勘定日」のように2つ日付列がある場合は取引日を優先
- 摘要列: 「摘要」「お取引内容」「取引内容」「内容」「記事」
- 出金列: 「お支払金額」「出金」「出金金額」「払出」「引出」
- 入金列: 「お預り金額」「入金」「入金金額」「預入」
- 残高列: 「差引残高」「残高」「お預り残高」

【検算ルール】
各取引行: 前行の残高 + 入金額 - 出金額 = 当行の残高
不一致なら入金と出金を入れ替える

【日付の変換ルール】
- 「7-2-27」「7.2.27」→ 令和7年 → 2025-02-27
- 「6-12-25」「6.12.25」→ 令和6年 → 2024-12-25
- 「25-9-2」「25--9--2」のような年が大きい(>9)場合は平成として解釈
  例: 平成25年=2013年, 平成26年=2014年, 平成31年=2019年（5月以降は令和元年）
- 「R7.4.1」→ 2025-04-01
- 「2025-02-27」「2025/2/27」→ そのまま

【摘要の結合】
摘要列の右側に振込先名（カタカナ）が記載されている場合は摘要に含める
例: 摘要「振込WB1」+ 右側「ｽｽﾞｷ ﾄｼｵ」→ description: "振込WB1 ｽｽﾞｷ ﾄｼｵ"

各取引行のフィールド：
- page: ページ番号（0始まり）
- date: YYYY-MM-DD形式
- description: 摘要
- deposit: 入金額（数値、null可）
- withdrawal: 出金額（数値、null可）
- balance: 残高（数値）

出力形式（JSONのみ、他の説明文は不要）:
{"transactions": [{"page": 0, "date": "YYYY-MM-DD", "description": "摘要", "deposit": 数値またはnull, "withdrawal": 数値またはnull, "balance": 数値}]}
`

interface Transaction {
  page: number
  date: string
  description: string
  deposit: number | null
  withdrawal: number | null
  balance: number
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY が設定されていません' }, { status: 500 })
    }

    const { pdfData } = await request.json()
    if (!pdfData) {
      return NextResponse.json({ error: 'PDFデータがありません' }, { status: 400 })
    }

    const base64 = pdfData.replace(/^data:application\/pdf;base64,/, '')
    const pdfBytes = Buffer.from(base64, 'base64')
    const genAI = new GoogleGenerativeAI(apiKey)
    const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash'

    // ページ数を確認してチャンク分割するか判定
    const sourcePdf = await PDFDocument.load(pdfBytes)
    const totalPages = sourcePdf.getPageCount()
    const CHUNK_SIZE = 5 // 5ページずつ

    if (totalPages <= CHUNK_SIZE) {
      // 小さいPDFはそのまま1リクエスト
      return await processSinglePdf(genAI, modelName, base64, totalPages)
    }

    // 大きいPDF: チャンク分割して並列処理
    console.log(`OCR-PDF: ${totalPages}ページ → ${Math.ceil(totalPages / CHUNK_SIZE)}チャンクに分割 (${CHUNK_SIZE}ページ/チャンク)`)
    const startTime = Date.now()

    const chunks: { startPage: number; base64: string }[] = []
    for (let start = 0; start < totalPages; start += CHUNK_SIZE) {
      const end = Math.min(start + CHUNK_SIZE, totalPages)
      const chunkDoc = await PDFDocument.create()
      const pageIndices = Array.from({ length: end - start }, (_, i) => start + i)
      const copiedPages = await chunkDoc.copyPages(sourcePdf, pageIndices)
      for (const p of copiedPages) chunkDoc.addPage(p)
      const chunkBytes = await chunkDoc.save()
      chunks.push({ startPage: start, base64: Buffer.from(chunkBytes).toString('base64') })
    }

    // 並列リクエスト
    const promises = chunks.map((chunk) => processChunk(genAI, modelName, chunk.base64, chunk.startPage))
    const results = await Promise.all(promises)
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`OCR-PDF: 全${chunks.length}チャンク完了 ${elapsed}秒`)

    // 結果をマージ
    const allTransactions: Transaction[] = []
    for (const r of results) {
      allTransactions.push(...r)
    }
    console.log(`OCR-PDF: 合計 ${allTransactions.length} 件の取引を抽出`)

    const pageGroups: Record<number, Transaction[]> = {}
    for (const tx of allTransactions) {
      if (!pageGroups[tx.page]) pageGroups[tx.page] = []
      pageGroups[tx.page].push(tx)
    }
    const pages = Object.entries(pageGroups).map(([pageIdx, txs]) => ({
      pageIndex: parseInt(pageIdx),
      transactions: txs.map((t) => ({
        date: t.date, description: t.description,
        deposit: t.deposit, withdrawal: t.withdrawal, balance: t.balance,
      })),
    }))

    return NextResponse.json({ pages, totalCount: allTransactions.length })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'OCR処理に失敗しました'
    console.error('OCR-PDF error:', err)
    return NextResponse.json({ error: `Gemini OCR エラー: ${msg}` }, { status: 500 })
  }
}

async function processChunk(
  genAI: GoogleGenerativeAI,
  modelName: string,
  chunkBase64: string,
  startPage: number,
): Promise<Transaction[]> {
  const maxAttempts = 3
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { temperature: 0, maxOutputTokens: 64000 },
      })
      const result = await model.generateContent([
        PROMPT,
        { inlineData: { mimeType: 'application/pdf', data: chunkBase64 } },
      ])
      const responseText = result.response.text()
      const jsonMatch = responseText.match(/\{[\s\S]*"transactions"[\s\S]*\}/)
      if (!jsonMatch) {
        console.warn(`OCR-PDF chunk (startPage=${startPage}) attempt ${attempt}: JSON抽出失敗 response先頭=${responseText.slice(0, 200)}`)
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 2000 * attempt))
          continue
        }
        return []
      }
      const parsed = JSON.parse(jsonMatch[0])
      return (parsed.transactions || []).map((tx: {
        page?: number; date?: string; description?: string;
        deposit?: number | null; withdrawal?: number | null; balance?: number
      }) => ({
        page: (tx.page ?? 0) + startPage,
        date: tx.date || '',
        description: tx.description || '',
        deposit: tx.deposit ?? null,
        withdrawal: tx.withdrawal ?? null,
        balance: tx.balance ?? 0,
      }))
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      const isRetriable = /429|503|504|timeout|ECONN|fetch failed/i.test(msg)
      console.warn(`OCR-PDF chunk error (startPage=${startPage}, attempt=${attempt}/${maxAttempts}): ${msg}`)
      if (attempt < maxAttempts && isRetriable) {
        await new Promise((r) => setTimeout(r, 2000 * Math.pow(2, attempt - 1)))
        continue
      }
      console.error(`OCR-PDF chunk fatal (startPage=${startPage}):`, e)
      return []
    }
  }
  return []
}

async function processSinglePdf(
  genAI: GoogleGenerativeAI,
  modelName: string,
  base64: string,
  totalPages: number,
): Promise<NextResponse> {
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: { temperature: 0, maxOutputTokens: 64000 },
    })

    console.log(`OCR-PDF: sending PDF (${(base64.length / 1024).toFixed(0)} KB base64, ${totalPages}p) to ${modelName}`)
    const startTime = Date.now()
    const result = await model.generateContent([
      PROMPT,
      { inlineData: { mimeType: 'application/pdf', data: base64 } },
    ])
    const responseText = result.response.text()
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`OCR-PDF completed in ${elapsed}s, response length=${responseText.length}`)

    const jsonMatch = responseText.match(/\{[\s\S]*"transactions"[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Gemini応答からJSONを抽出できませんでした' }, { status: 500 })
    }

    const parsed = JSON.parse(jsonMatch[0])
    const transactions: Transaction[] = (parsed.transactions || []).map((tx: {
      page?: number; date?: string; description?: string;
      deposit?: number | null; withdrawal?: number | null; balance?: number
    }) => ({
      page: tx.page ?? 0,
      date: tx.date || '',
      description: tx.description || '',
      deposit: tx.deposit ?? null,
      withdrawal: tx.withdrawal ?? null,
      balance: tx.balance ?? 0,
    }))

    console.log(`OCR-PDF: extracted ${transactions.length} transactions`)

    const pageGroups: Record<number, Transaction[]> = {}
    for (const tx of transactions) {
      if (!pageGroups[tx.page]) pageGroups[tx.page] = []
      pageGroups[tx.page].push(tx)
    }
    const pages = Object.entries(pageGroups).map(([pageIdx, txs]) => ({
      pageIndex: parseInt(pageIdx),
      transactions: txs.map((t) => ({
        date: t.date, description: t.description,
        deposit: t.deposit, withdrawal: t.withdrawal, balance: t.balance,
      })),
    }))

    return NextResponse.json({ pages, totalCount: transactions.length })
}
