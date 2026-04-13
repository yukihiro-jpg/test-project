import * as XLSX from 'xlsx'
import type { JournalEntry, AccountItem } from './types'
import { getTempEntries } from './temp-store'

interface QuestionRow {
  no: number
  date: string
  bankAccount: string     // 口座名
  direction: string       // 出金 or 入金
  amount: number
  originalDescription: string
  question: string
  answer: string          // 空欄（顧問先記入用）
}

/**
 * 一時保存データから仮払金の質問リストを生成
 */
export function generateQuestionList(
  accountMaster: AccountItem[],
  clientName: string,
): QuestionRow[] {
  const entries = getTempEntries()

  // 仮払金の科目コードを特定
  const karibaraiAcc = accountMaster.find((a) =>
    a.name.includes('仮払') || a.shortName.includes('仮払')
  )
  if (!karibaraiAcc) return []
  const kariCode = karibaraiAcc.code

  const rows: QuestionRow[] = []
  let no = 1

  for (const e of entries) {
    const isDebitKari = e.debitCode === kariCode
    const isCreditKari = e.creditCode === kariCode
    if (!isDebitKari && !isCreditKari) continue

    // 相手科目（口座名）を取得
    const counterCode = isDebitKari ? e.creditCode : e.debitCode
    const counterName = isDebitKari ? e.creditName : e.debitName
    const counterAcc = accountMaster.find((a) => a.code === counterCode)
    const bankAccount = counterAcc?.shortName || counterAcc?.name || counterName || counterCode

    const direction = isDebitKari ? '出金' : '入金'
    const amount = e.debitAmount || e.creditAmount || 0
    const desc = e.originalDescription || e.description || ''

    // 質問内容を自動生成
    const question = generateQuestion(direction, amount, desc, bankAccount)

    rows.push({
      no: no++,
      date: formatDate(e.date),
      bankAccount,
      direction,
      amount,
      originalDescription: desc,
      question,
      answer: '',
    })
  }

  return rows
}

function generateQuestion(direction: string, amount: number, desc: string, bankAccount: string): string {
  const amountStr = amount.toLocaleString()

  if (direction === '出金') {
    let q = `${bankAccount}から${amountStr}円の出金があります（${desc || '摘要不明'}）。`

    // 金額に応じた追加質問
    if (amount >= 100000) {
      q += '\nこのお支払いの内容と、契約書・請求書等の証憑をお教えください。'
    } else if (amount >= 10000) {
      q += '\nこのお支払いの内容と、領収書またはレシートがあればご提供ください。'
    } else {
      q += '\nこのお支払いの内容をお教えください。レシート等があればご提供ください。'
    }

    // 摘要キーワードから推測
    if (desc.includes('ｶｰﾄﾞ') || desc.includes('カード')) {
      q += '\n※カード払いの明細があればご確認ください。'
    }
    if (desc.includes('振込') || desc.includes('ﾌﾘｺﾐ')) {
      q += '\n※振込先の請求書があればご確認ください。'
    }

    return q
  } else {
    let q = `${bankAccount}に${amountStr}円の入金があります（${desc || '摘要不明'}）。`
    q += '\nこの入金は売上代金の入金でしょうか？それとも立替金の返金や借入金等でしょうか？'

    if (amount >= 1000000) {
      q += '\n※高額のため、契約書や入金明細等があればご確認ください。'
    }

    return q
  }
}

function formatDate(date: string): string {
  if (!date || date.length !== 8) return date
  return `${date.slice(0, 4)}/${date.slice(4, 6)}/${date.slice(6, 8)}`
}

/**
 * 質問リストをExcelファイルとしてダウンロード
 */
export function downloadQuestionExcel(
  rows: QuestionRow[],
  clientName: string,
  officeName?: string,
): void {
  const wb = XLSX.utils.book_new()

  // ヘッダー情報
  const headerRows = [
    [`${clientName} 様　仮払金確認のお願い`],
    [`作成日: ${new Date().toLocaleDateString('ja-JP')}${officeName ? `　　作成者: ${officeName}` : ''}`],
    ['下記の取引について、内容のご確認をお願いいたします。「回答」欄にご記入のうえ、ご返送ください。'],
    [],
  ]

  // データヘッダー
  const dataHeader = ['No', '日付', '口座', '入出金', '金額', '通帳摘要', '確認事項', '回答']

  // データ行
  const dataRows = rows.map((r) => [
    r.no,
    r.date,
    r.bankAccount,
    r.direction,
    r.amount,
    r.originalDescription,
    r.question,
    r.answer,
  ])

  const allRows = [...headerRows, dataHeader, ...dataRows]
  const ws = XLSX.utils.aoa_to_sheet(allRows)

  // 列幅設定
  ws['!cols'] = [
    { wch: 4 },   // No
    { wch: 12 },  // 日付
    { wch: 18 },  // 口座
    { wch: 6 },   // 入出金
    { wch: 12 },  // 金額
    { wch: 25 },  // 通帳摘要
    { wch: 50 },  // 確認事項
    { wch: 30 },  // 回答
  ]

  XLSX.utils.book_append_sheet(wb, ws, '仮払金確認')
  XLSX.writeFile(wb, `仮払金確認_${clientName}_${new Date().toISOString().slice(0, 10)}.xlsx`)
}
