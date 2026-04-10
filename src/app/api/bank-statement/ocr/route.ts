import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const PROMPT = `この画像は日本の銀行通帳のページです（複数ページある場合があります）。

【最優先: 列構造の認識】
まず通帳の列ヘッダーを特定してください。日本の銀行通帳は必ず以下の列構造を持ちます：
- 日付列
- 摘要列（お取引内容）
- 「お支払金額」列（＝出金。口座からお金が出る）
- 「お預り金額」列（＝入金。口座にお金が入る）
- 「差引残高」列（＝残高）

列の位置を正確に把握し、金額がどの列に印字されているかで入金・出金を判別してください。
「お支払金額」列にある数字 → withdrawal（出金）
「お預り金額」列にある数字 → deposit（入金）
これを間違えると会計処理が完全に狂います。

【検算ルール - 入出金の正確性保証】
各取引行について、以下の等式が成り立つことを確認してください：
  前行の残高 + 入金額 - 出金額 = 当行の残高
もしこの等式が成り立たない場合、入金と出金が逆になっている可能性が高いです。
その場合は入金と出金を入れ替えてください。

各取引行のフィールド：
- page: ページ番号（0始まり。1枚目なら0、2枚目なら1）
- date: 取引日（YYYY-MM-DD形式。必ず西暦に変換すること）
- description: 摘要（取引の完全な説明文。下記ルール参照）
- deposit: 入金額（お預り金額列の数値。入金がない場合はnull）
- withdrawal: 出金額（お支払金額列の数値。出金がない場合はnull）
- balance: 残高（差引残高列の数値）

【日付の変換ルール】
通帳の日付は和暦の省略形で記載されています：
- 「7-2-27」→ 令和7年2月27日 → 2025-02-27
- 「6-12-25」→ 令和6年12月25日 → 2024-12-25
- 令和の西暦変換: 令和N年 = 2018 + N年
- 平成の西暦変換: 平成N年 = 1988 + N年

【摘要の抽出ルール】
銀行通帳では、取引の説明情報が複数の列にまたがって記載されることがあります：
- 「摘要」列のテキスト
- 「お支払金額」列や「お預り金額」列の金額の上下にあるカタカナ・数字（振込人名等）
- これらすべてを結合してdescriptionフィールドに入れてください

出力は必ず以下のJSON形式のみを返してください。説明文は不要です：
{"transactions": [{"page": 0, "date": "2025-02-27", "description": "給料 カ）ヤマダショウジ", "deposit": 250000, "withdrawal": null, "balance": 1250000}]}

注意：
- 金額のカンマは除去して数値にしてください
- 残高のみの行（繰越残高など）はdeposit=null, withdrawal=nullとしてください
- 全ページ分の取引を1つのtransactions配列にまとめてください
- 読み取れない場合は空配列 {"transactions": []} を返してください`

interface Transaction {
  page: number
  date: string
  description: string
  deposit: number | null
  withdrawal: number | null
  balance: number
}

/**
 * 残高整合性チェックによる入出金自動補正
 * JDL AI-OCR方式: 残高をチェックサムとして使い、入出金の方向を自動修正
 */
function verifyAndCorrectTransactions(transactions: Transaction[]): {
  corrected: Transaction[]
  corrections: string[]
} {
  if (transactions.length === 0) return { corrected: [], corrections: [] }

  const corrected = [...transactions.map((t) => ({ ...t }))]
  const corrections: string[] = []

  for (let i = 0; i < corrected.length; i++) {
    const tx = corrected[i]
    const deposit = tx.deposit ?? 0
    const withdrawal = tx.withdrawal ?? 0

    // 入出金がどちらもない行（残高行）はスキップ
    if (deposit === 0 && withdrawal === 0) continue

    // 前行の残高を取得
    let prevBalance: number | null = null
    for (let j = i - 1; j >= 0; j--) {
      if (corrected[j].balance != null) {
        prevBalance = corrected[j].balance
        break
      }
    }

    if (prevBalance === null || tx.balance == null) continue

    // 検算: 前残高 + 入金 - 出金 = 当残高
    const expectedBalance = prevBalance + deposit - withdrawal
    const actualBalance = tx.balance

    if (Math.abs(expectedBalance - actualBalance) < 1) {
      // 正しい
      continue
    }

    // 入出金を入れ替えて検算
    const swappedBalance = prevBalance + withdrawal - deposit
    if (Math.abs(swappedBalance - actualBalance) < 1) {
      // 入出金が逆だった → 修正
      corrections.push(
        `行${i + 1} (${tx.date} ${tx.description}): 入金${deposit.toLocaleString()}↔出金${withdrawal.toLocaleString()} を入替え`,
      )
      tx.deposit = withdrawal > 0 ? withdrawal : null
      tx.withdrawal = deposit > 0 ? deposit : null
      continue
    }

    // 金額が片方にしかなく、方向が逆の場合
    if (deposit > 0 && withdrawal === 0) {
      const asWithdrawal = prevBalance - deposit
      if (Math.abs(asWithdrawal - actualBalance) < 1) {
        corrections.push(
          `行${i + 1} (${tx.date} ${tx.description}): 入金${deposit.toLocaleString()} → 出金に修正`,
        )
        tx.withdrawal = deposit
        tx.deposit = null
        continue
      }
    }

    if (withdrawal > 0 && deposit === 0) {
      const asDeposit = prevBalance + withdrawal
      if (Math.abs(asDeposit - actualBalance) < 1) {
        corrections.push(
          `行${i + 1} (${tx.date} ${tx.description}): 出金${withdrawal.toLocaleString()} → 入金に修正`,
        )
        tx.deposit = withdrawal
        tx.withdrawal = null
        continue
      }
    }
  }

  return { corrected, corrections }
}

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

    // 全ページを1回のリクエストで送信
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

    console.log(`Sending ${images.length} images to Gemini...`)

    const result = await model.generateContent(parts)
    const responseText = result.response.text()
    console.log('Gemini response:', responseText.substring(0, 500))

    // JSONを抽出
    const jsonMatch = responseText.match(/\{[\s\S]*"transactions"[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({
        pages: images.map((_: string, i: number) => ({
          pageIndex: i,
          transactions: [],
          error: 'Geminiの応答からJSONを抽出できませんでした',
        })),
      })
    }

    const parsed = JSON.parse(jsonMatch[0])
    const allTransactions: Transaction[] = (parsed.transactions || []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (tx: any) => ({
        page: tx.page ?? 0,
        date: tx.date || '',
        description: tx.description || '',
        deposit: tx.deposit,
        withdrawal: tx.withdrawal,
        balance: tx.balance ?? 0,
      }),
    )

    console.log(`Gemini returned ${allTransactions.length} transactions`)

    // 残高整合性チェック＆自動補正
    const { corrected, corrections } = verifyAndCorrectTransactions(allTransactions)

    if (corrections.length > 0) {
      console.log('=== 入出金自動補正 ===')
      corrections.forEach((c) => console.log(`  ${c}`))
    }

    // ページごとにグループ化
    const pageCount = images.length
    const pageGroups: Record<number, Transaction[]> = {}
    for (let i = 0; i < pageCount; i++) {
      pageGroups[i] = []
    }

    for (const tx of corrected) {
      const pageIdx = tx.page ?? 0
      if (!pageGroups[pageIdx]) pageGroups[pageIdx] = []
      pageGroups[pageIdx].push({
        date: tx.date,
        description: tx.description,
        deposit: tx.deposit,
        withdrawal: tx.withdrawal,
        balance: tx.balance,
        page: pageIdx,
      })
    }

    const pages = Object.keys(pageGroups)
      .map(Number)
      .sort((a, b) => a - b)
      .map((pageIdx) => ({
        pageIndex: pageIdx,
        transactions: pageGroups[pageIdx],
      }))

    return NextResponse.json({
      pages,
      corrections: corrections.length > 0 ? corrections : undefined,
    })
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error('Gemini OCR API error:', errMsg)
    return NextResponse.json(
      { error: `Gemini OCR エラー: ${errMsg}` },
      { status: 500 },
    )
  }
}
