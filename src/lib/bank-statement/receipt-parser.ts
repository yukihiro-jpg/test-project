import { parsePdfText, renderPdfPageToImage } from './pdf-text-parser'
import { lookupInvoice } from './invoice-registry'
import type { StatementPage, BankTransaction } from './types'

export interface ReceiptData {
  pageIndex: number
  date: string
  storeName: string
  invoiceNumber: string
  totalAmount: number
  description: string
  imageDataUrl?: string
}

let idCounter = 0
function genId(): string {
  return `rcpt-${Date.now()}-${++idCounter}`
}

/**
 * テキストPDFのレシートを解析（pdfjs-dist、Gemini不要）
 * 各ページ=1枚のレシートとして解析
 */
export async function parseReceiptTextPdf(
  file: File,
  onPageParsed?: (data: ReceiptData, pageIndex: number, totalPages: number) => void,
): Promise<{ receipts: ReceiptData[]; pages: StatementPage[]; isTextPdf: boolean }> {
  const { pages: rawPages, isTextPdf } = await parsePdfText(file)

  if (!isTextPdf) {
    return { receipts: [], pages: [], isTextPdf: false }
  }

  const receipts: ReceiptData[] = []
  const statementPages: StatementPage[] = []

  for (let i = 0; i < rawPages.length; i++) {
    const rows = rawPages[i].rows
    const allText = rows.map((r) => r.cells.join(' ')).join('\n')

    // 各フィールドを抽出
    const invoiceNumber = extractInvoiceNumber(allText)
    const date = extractDate(allText)
    const totalAmount = extractTotalAmount(rows)
    let storeName = extractStoreName(rows)

    // インボイス番号から事業者名を検索
    if (invoiceNumber) {
      const registered = await lookupInvoice(invoiceNumber)
      if (registered) storeName = registered
    }

    const description = storeName || '（店名不明）'

    // 画像生成（1枚ずつ順次表示用）
    const imageDataUrl = await renderPdfPageToImage(file, i + 1, 2)

    const receipt: ReceiptData = {
      pageIndex: i,
      date,
      storeName,
      invoiceNumber,
      totalAmount,
      description,
      imageDataUrl,
    }
    receipts.push(receipt)

    // 取引データとしてページを作成
    const tx: BankTransaction = {
      id: genId(),
      pageIndex: i,
      rowIndex: 0,
      date,
      description,
      deposit: null,
      withdrawal: totalAmount,
      balance: 0,
    }
    statementPages.push({
      pageIndex: i,
      transactions: [tx],
      openingBalance: 0,
      closingBalance: 0,
      isBalanceValid: true,
      balanceDifference: 0,
      imageDataUrl,
    })

    onPageParsed?.(receipt, i, rawPages.length)
  }

  return { receipts, pages: statementPages, isTextPdf: true }
}

function extractInvoiceNumber(text: string): string {
  const m = text.match(/T\d{13}/)
  return m ? m[0] : ''
}

function extractDate(text: string): string {
  // 西暦: 2025/04/01, 2025-04-01, 2025年4月1日
  const m1 = text.match(/(20\d{2})[/\-年](\d{1,2})[/\-月](\d{1,2})/)
  if (m1) {
    return `${m1[1]}-${m1[2].padStart(2, '0')}-${m1[3].padStart(2, '0')}`
  }
  // 和暦: R7.4.1, 令和7年4月1日
  const m2 = text.match(/[令和Rr](\d{1,2})[年./](\d{1,2})[月./](\d{1,2})/)
  if (m2) {
    const year = 2018 + parseInt(m2[1])
    return `${year}-${m2[2].padStart(2, '0')}-${m2[3].padStart(2, '0')}`
  }
  return ''
}

function extractTotalAmount(rows: { cells: string[] }[]): number {
  // 「合計」「お買上」「領収」「税込」の直後の金額を探す
  const keywords = ['合計', 'お買上', '税込合計', '領収', 'ご請求', '小計']
  let bestAmount = 0

  for (const row of rows) {
    const line = row.cells.join(' ')
    for (const kw of keywords) {
      if (line.includes(kw)) {
        const amounts = line.match(/[\d,]+/g)
        if (amounts) {
          for (const a of amounts) {
            const num = parseInt(a.replace(/,/g, ''), 10)
            if (!isNaN(num) && num > bestAmount) bestAmount = num
          }
        }
      }
    }
  }

  // キーワードで見つからない場合、最大の金額を使用
  if (bestAmount === 0) {
    for (const row of rows) {
      for (const cell of row.cells) {
        const m = cell.match(/[\d,]+/)
        if (m) {
          const num = parseInt(m[0].replace(/,/g, ''), 10)
          if (!isNaN(num) && num > bestAmount && num < 10000000) bestAmount = num
        }
      }
    }
  }

  return bestAmount
}

function extractStoreName(rows: { cells: string[] }[]): string {
  // 最初の数行からテキストが最も多い行を店名とする
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const text = rows[i].cells.join(' ').trim()
    // 日付や金額だけの行はスキップ
    if (!text || /^\d/.test(text) || text.length < 2) continue
    // 「領収書」「レシート」等のタイトルはスキップ
    if (/^(領収書|レシート|領　収　書)$/.test(text.replace(/\s/g, ''))) continue
    return text
  }
  return ''
}
