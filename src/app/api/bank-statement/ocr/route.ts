import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

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
      const imageDataUrl: string = images[i]
      // data:image/png;base64,XXXX からbase64部分を抽出
      const base64Match = imageDataUrl.match(/^data:([^;]+);base64,(.+)$/)
      if (!base64Match) {
        results.push({ pageIndex: i, transactions: [], error: '画像形式が不正です' })
        continue
      }

      const mimeType = base64Match[1]
      const base64Data = base64Match[2]

      const prompt = `この画像は日本の銀行通帳のページです。以下の情報をJSON形式で抽出してください。

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

      try {
        const result = await model.generateContent([
          prompt,
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data,
            },
          },
        ])

        const responseText = result.response.text()
        // JSONを抽出（マークダウンのコードブロック内にある場合も対応）
        const jsonMatch = responseText.match(/\{[\s\S]*"transactions"[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          results.push({
            pageIndex: i,
            transactions: parsed.transactions || [],
          })
        } else {
          results.push({ pageIndex: i, transactions: [] })
        }
      } catch (err) {
        console.error(`Gemini OCR error for page ${i}:`, err)
        results.push({
          pageIndex: i,
          transactions: [],
          error: `ページ${i + 1}の解析に失敗しました`,
        })
      }
    }

    return NextResponse.json({ pages: results })
  } catch (err) {
    console.error('Gemini OCR API error:', err)
    return NextResponse.json(
      { error: 'OCR処理中にエラーが発生しました' },
      { status: 500 },
    )
  }
}
