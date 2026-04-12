import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const PROMPT_PER_PAGE = `この画像は日本の銀行通帳の1ページです。
各取引行について以下の情報をJSON形式で抽出してください。

【最優先: 列構造の認識】
まず通帳の列ヘッダーを特定してください。日本の銀行通帳は必ず以下の列構造を持ちます：
- 日付列
- 摘要列（お取引内容）
- 「お支払金額」列（＝出金。口座からお金が出る）
- 「お預り金額」列（＝入金。口座にお金が入る）
- 「差引残高」列（＝残高）

「お支払金額」列にある数字 → withdrawal（出金）
「お預り金額」列にある数字 → deposit（入金）

【検算ルール】
各取引行: 前行の残高 + 入金額 - 出金額 = 当行の残高
不一致なら入金と出金を入れ替えてください。

各取引行のフィールド：
- date: 取引日（YYYY-MM-DD形式。必ず西暦に変換）
- description: 摘要（金額列の横のカタカナ・数字も含める）
- deposit: 入金額（お預り金額列の数値。null可）
- withdrawal: 出金額（お支払金額列の数値。null可）
- balance: 残高（差引残高列の数値）

【繰越残高について - 重要】
通帳の最終行が「繰越」「くりこし」「次頁へ」等の場合、その残高は通帳繰り越しのための表示であり、
実際の取引ではありません。この行はdeposit=null, withdrawal=nullとし、balanceにはその残高を記録してください。
ただし、最終残高としてCSV出力する際はこの繰越残高ではなく、直前の通常取引の残高を使ってください。

【日付の変換ルール】
- 「7-2-27」→ 令和7年 → 2025-02-27（令和N年 = 2018 + N年）
- 「6-12-25」→ 令和6年 → 2024-12-25

出力は必ず以下のJSON形式のみ：
{"transactions": [{"date": "2025-02-27", "description": "給料 カ）ヤマダ", "deposit": 250000, "withdrawal": null, "balance": 1250000}]}

残高のみの行はdeposit=null, withdrawal=nullとしてください。
読み取れない場合は {"transactions": []} を返してください。`

interface Transaction {
  page: number
  date: string
  description: string
  deposit: number | null
  withdrawal: number | null
  balance: number
}

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

    if (deposit === 0 && withdrawal === 0) continue

    let prevBalance: number | null = null
    for (let j = i - 1; j >= 0; j--) {
      if (corrected[j].balance != null) {
        prevBalance = corrected[j].balance
        break
      }
    }

    if (prevBalance === null || tx.balance == null) continue

    const expectedBalance = prevBalance + deposit - withdrawal
    const actualBalance = tx.balance

    if (Math.abs(expectedBalance - actualBalance) < 1) continue

    const swappedBalance = prevBalance + withdrawal - deposit
    if (Math.abs(swappedBalance - actualBalance) < 1) {
      corrections.push(
        `行${i + 1} (${tx.date} ${tx.description}): 入金${deposit.toLocaleString()}↔出金${withdrawal.toLocaleString()} を入替え`,
      )
      tx.deposit = withdrawal > 0 ? withdrawal : null
      tx.withdrawal = deposit > 0 ? deposit : null
      continue
    }

    if (deposit > 0 && withdrawal === 0) {
      const asWithdrawal = prevBalance - deposit
      if (Math.abs(asWithdrawal - actualBalance) < 1) {
        corrections.push(`行${i + 1} (${tx.date}): 入金${deposit.toLocaleString()} → 出金に修正`)
        tx.withdrawal = deposit
        tx.deposit = null
        continue
      }
    }

    if (withdrawal > 0 && deposit === 0) {
      const asDeposit = prevBalance + withdrawal
      if (Math.abs(asDeposit - actualBalance) < 1) {
        corrections.push(`行${i + 1} (${tx.date}): 出金${withdrawal.toLocaleString()} → 入金に修正`)
        tx.deposit = withdrawal
        tx.withdrawal = null
        continue
      }
    }
  }

  return { corrected, corrections }
}

async function processOnePage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: any,
  imageDataUrl: string,
  pageIndex: number,
): Promise<{ pageIndex: number; transactions: Transaction[]; error?: string }> {
  const base64Match = imageDataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!base64Match) {
    return { pageIndex, transactions: [], error: '画像形式が不正です' }
  }

  const result = await model.generateContent([
    PROMPT_PER_PAGE,
    { inlineData: { mimeType: base64Match[1], data: base64Match[2] } },
  ])

  const responseText = result.response.text()
  console.log(`Page ${pageIndex} response:`, responseText.substring(0, 300))

  const jsonMatch = responseText.match(/\{[\s\S]*"transactions"[\s\S]*\}/)
  if (!jsonMatch) {
    return { pageIndex, transactions: [], error: 'JSONを抽出できませんでした' }
  }

  const parsed = JSON.parse(jsonMatch[0])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transactions: Transaction[] = (parsed.transactions || []).map((tx: any) => ({
    page: pageIndex,
    date: tx.date || '',
    description: tx.description || '',
    deposit: tx.deposit,
    withdrawal: tx.withdrawal,
    balance: tx.balance ?? 0,
  }))

  return { pageIndex, transactions }
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY が設定されていません。' },
        { status: 500 },
      )
    }

    const { images } = await request.json()
    console.log(`OCR request: ${images?.length || 0} pages`)

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: '画像データがありません' }, { status: 400 })
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
    console.log(`Using model: ${modelName}, sending ${images.length} pages in parallel`)
    const model = genAI.getGenerativeModel({ model: modelName })

    // 全ページを並列でAPIに送信
    const startTime = Date.now()
    const promises = images.map((img: string, i: number) => processOnePage(model, img, i))
    const results = await Promise.all(promises)
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`All ${images.length} pages completed in ${elapsed}s (parallel)`)

    // 全ページの取引を結合してページ順にソート
    const allTransactions: Transaction[] = []
    for (const r of results.sort((a, b) => a.pageIndex - b.pageIndex)) {
      allTransactions.push(...r.transactions)
    }

    console.log(`Total transactions: ${allTransactions.length}`)

    // 残高整合性チェック＆自動補正
    const { corrected, corrections } = verifyAndCorrectTransactions(allTransactions)

    if (corrections.length > 0) {
      console.log('=== 入出金自動補正 ===')
      corrections.forEach((c) => console.log(`  ${c}`))
    }

    // ページごとにグループ化
    const pageGroups: Record<number, Transaction[]> = {}
    for (let i = 0; i < images.length; i++) pageGroups[i] = []

    for (const tx of corrected) {
      const idx = tx.page ?? 0
      if (!pageGroups[idx]) pageGroups[idx] = []
      pageGroups[idx].push(tx)
    }

    const pages = Object.keys(pageGroups)
      .map(Number)
      .sort((a, b) => a - b)
      .map((idx) => ({ pageIndex: idx, transactions: pageGroups[idx] }))

    return NextResponse.json({
      pages,
      corrections: corrections.length > 0 ? corrections : undefined,
    })
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error('Gemini OCR API error:', errMsg)
    return NextResponse.json({ error: `Gemini OCR エラー: ${errMsg}` }, { status: 500 })
  }
}
