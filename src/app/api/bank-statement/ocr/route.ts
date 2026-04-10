import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const PROMPT = `この画像は日本の銀行通帳のページです（複数ページある場合があります）。
全ページの各取引行について以下の情報をJSON形式で抽出してください。

各取引行のフィールド：
- page: ページ番号（0始まり。1枚目なら0、2枚目なら1）
- date: 取引日（YYYY-MM-DD形式。必ず西暦に変換すること）
- description: 摘要（取引の説明文）
- deposit: 入金額（数値。入金がない場合はnull）
- withdrawal: 出金額（数値。出金がない場合はnull）
- balance: 残高（数値）

【日付の変換ルール - 最重要】
通帳の日付は和暦の省略形で記載されています。以下のルールで西暦に変換してください：
- 「7-2-27」→ 令和7年2月27日 → 2025-02-27
- 「7-3-5」→ 令和7年3月5日 → 2025-03-05
- 「6-12-25」→ 令和6年12月25日 → 2024-12-25
- 「R7.2.27」→ 令和7年2月27日 → 2025-02-27
- 令和の西暦変換: 令和N年 = 2018 + N年（令和1年=2019年、令和7年=2025年）
- 平成の西暦変換: 平成N年 = 1988 + N年
- 数字1桁-数字-数字 の形式は「和暦年-月-日」です

出力は必ず以下のJSON形式のみを返してください。説明文は不要です：
{"transactions": [{"page": 0, "date": "2025-02-27", "description": "給料", "deposit": 250000, "withdrawal": null, "balance": 1250000}]}

注意：
- 金額のカンマは除去して数値にしてください
- 残高のみの行（繰越残高など）はdeposit=null, withdrawal=nullとしてください
- 全ページ分の取引を1つのtransactions配列にまとめてください
- 読み取れない場合は空配列 {"transactions": []} を返してください`

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY が設定されていません。.env ファイルに GEMINI_API_KEY を追加してください。' },
        { status: 500 },
      )
    }

    const { images } = await request.json()
    console.log(`OCR request: ${images?.length || 0} pages`)

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json(
        { error: '画像データがありません' },
        { status: 400 },
      )
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
    console.log(`Using Gemini model: ${modelName}`)
    const model = genAI.getGenerativeModel({ model: modelName })

    // 全ページを1回のリクエストで送信（レート制限対策）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parts: any[] = [PROMPT]

    for (let i = 0; i < images.length; i++) {
      const imageDataUrl: string = images[i]
      const base64Match = imageDataUrl.match(/^data:([^;]+);base64,(.+)$/)
      if (!base64Match) continue

      parts.push({
        inlineData: {
          mimeType: base64Match[1],
          data: base64Match[2],
        },
      })
    }

    console.log(`Sending ${images.length} images in single request to Gemini...`)

    const result = await model.generateContent(parts)
    const responseText = result.response.text()
    console.log('Gemini response:', responseText.substring(0, 500))

    // JSONを抽出
    const jsonMatch = responseText.match(/\{[\s\S]*"transactions"[\s\S]*\}/)
    if (!jsonMatch) {
      console.log('No JSON found in Gemini response')
      return NextResponse.json({
        pages: images.map((_: string, i: number) => ({
          pageIndex: i,
          transactions: [],
          error: 'Geminiの応答からJSONを抽出できませんでした',
        })),
      })
    }

    const parsed = JSON.parse(jsonMatch[0])
    const allTransactions = parsed.transactions || []
    console.log(`Total transactions found: ${allTransactions.length}`)

    // ページごとにグループ化
    const pageCount = images.length
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pageGroups: Record<number, any[]> = {}
    for (let i = 0; i < pageCount; i++) {
      pageGroups[i] = []
    }

    for (const tx of allTransactions) {
      const pageIdx = tx.page ?? 0
      if (!pageGroups[pageIdx]) pageGroups[pageIdx] = []
      pageGroups[pageIdx].push({
        date: tx.date,
        description: tx.description,
        deposit: tx.deposit,
        withdrawal: tx.withdrawal,
        balance: tx.balance,
      })
    }

    const pages = Object.keys(pageGroups)
      .map(Number)
      .sort((a, b) => a - b)
      .map((pageIdx) => ({
        pageIndex: pageIdx,
        transactions: pageGroups[pageIdx],
      }))

    return NextResponse.json({ pages })
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error('Gemini OCR API error:', errMsg)
    return NextResponse.json(
      { error: `Gemini OCR エラー: ${errMsg}` },
      { status: 500 },
    )
  }
}
