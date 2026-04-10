import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const PROMPT = `この画像は日本の銀行通帳のページです。以下の情報をJSON形式で抽出してください。

各取引行について以下のフィールドを抽出してください：
- date: 取引日（YYYY-MM-DD形式。年が省略されている場合は推測してください。和暦の場合は西暦に変換）
- description: 摘要（取引の説明文）
- deposit: 入金額（数値。入金がない場合はnull）
- withdrawal: 出金額（数値。出金がない場合はnull）
- balance: 残高（数値）

出力は必ず以下のJSON形式のみを返してください。説明文は不要です：
{"transactions": [{"date": "2024-04-01", "description": "給料", "deposit": 250000, "withdrawal": null, "balance": 1250000}]}

注意：
- 金額のカンマは除去して数値にしてください
- 残高のみの行（繰越残高など）はdeposit=null, withdrawal=nullとしてください
- 読み取れない場合は空配列 {"transactions": []} を返してください`

async function callGeminiWithRetry(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: any,
  mimeType: string,
  base64Data: string,
  pageIndex: number,
  maxRetries: number = 3,
) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await model.generateContent([
        PROMPT,
        { inlineData: { mimeType, data: base64Data } },
      ])

      const responseText = result.response.text()
      console.log(`Gemini page ${pageIndex} (attempt ${attempt + 1}):`, responseText.substring(0, 300))

      const jsonMatch = responseText.match(/\{[\s\S]*"transactions"[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        console.log(`Gemini page ${pageIndex}: ${(parsed.transactions || []).length} transactions found`)
        return { transactions: parsed.transactions || [] }
      } else {
        return { transactions: [], error: 'Geminiの応答からJSONを抽出できませんでした' }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      const isRateLimit = errMsg.includes('429') || errMsg.includes('Too Many') || errMsg.includes('RESOURCE_EXHAUSTED')

      if (isRateLimit && attempt < maxRetries - 1) {
        const waitSec = (attempt + 1) * 5
        console.log(`Rate limited on page ${pageIndex}, waiting ${waitSec}s before retry...`)
        await sleep(waitSec * 1000)
        continue
      }

      console.error(`Gemini error page ${pageIndex}:`, errMsg)
      return { transactions: [], error: errMsg }
    }
  }
  return { transactions: [], error: 'リトライ回数を超えました' }
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    console.log('GEMINI_API_KEY loaded:', apiKey ? `${apiKey.substring(0, 8)}...（${apiKey.length}文字）` : '未設定')

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
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    const results = []

    for (let i = 0; i < images.length; i++) {
      // レート制限対策: 2ページ目以降は3秒待つ
      if (i > 0) {
        console.log(`Waiting 3s before page ${i + 1}...`)
        await sleep(3000)
      }

      const imageDataUrl: string = images[i]
      const base64Match = imageDataUrl.match(/^data:([^;]+);base64,(.+)$/)
      if (!base64Match) {
        results.push({ pageIndex: i, transactions: [], error: '画像形式が不正です' })
        continue
      }

      const mimeType = base64Match[1]
      const base64Data = base64Match[2]

      const result = await callGeminiWithRetry(model, mimeType, base64Data, i)
      results.push({ pageIndex: i, ...result })
    }

    return NextResponse.json({ pages: results })
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error('Gemini OCR API error:', errMsg)
    return NextResponse.json(
      { error: `OCR処理中にエラーが発生しました: ${errMsg}` },
      { status: 500 },
    )
  }
}
