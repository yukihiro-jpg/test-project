import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const PROMPT = `この PDF は日本の銀行の取引明細書です。
通帳・お取引照合表（常陽銀行等）・取引明細書・現金出納帳などの形式があります。
PDF 全ページから必ず取引データを読み取って JSON で返してください。

【必ず守ること】
- 取引行が1つでも見える場合、1行も漏らさずに transactions 配列に含める
- ヘッダ行（取引日/勘定日/摘要/お支払金額/お預り金額/差引残高など）はスキップ
- タイトル行（お取引照合表、口座情報、頁数など）はスキップ
- 複数ページにまたがる場合、全ページから抽出

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
    const genAI = new GoogleGenerativeAI(apiKey)
    const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: { temperature: 0, maxOutputTokens: 64000 },
    })

    console.log(`OCR-PDF: sending PDF (${(base64.length / 1024).toFixed(0)} KB base64) to ${modelName}`)
    const startTime = Date.now()
    const result = await model.generateContent([
      PROMPT,
      { inlineData: { mimeType: 'application/pdf', data: base64 } },
    ])
    const responseText = result.response.text()
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`OCR-PDF completed in ${elapsed}s, response length=${responseText.length}`)
    console.log(`OCR-PDF first 400 chars:`, responseText.substring(0, 400))

    const jsonMatch = responseText.match(/\{[\s\S]*"transactions"[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Gemini応答からJSONを抽出できませんでした', rawResponse: responseText.substring(0, 500) }, { status: 500 })
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

    // ページごとにグループ化
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'OCR処理に失敗しました'
    console.error('OCR-PDF error:', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
