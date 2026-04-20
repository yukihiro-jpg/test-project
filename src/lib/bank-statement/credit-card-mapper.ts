import type { JournalEntry, CreditCardData } from './types'
import { findPattern, getPatterns } from './pattern-store'

let idCounter = 0
function generateEntryId(): string {
  return `cc-${Date.now()}-${++idCounter}`
}

function formatUsageDate(usageDate: string): string {
  if (!usageDate) return ''
  const m = usageDate.match(/(\d{1,2})-(\d{1,2})$/)
  if (m) return `${parseInt(m[1])}月${parseInt(m[2])}日`
  const m2 = usageDate.match(/(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m2) return `${parseInt(m2[2])}月${parseInt(m2[3])}日`
  return usageDate
}

export function creditCardToEntries(
  data: CreditCardData,
  creditCardAccountCode: string,
  creditCardAccountName: string,
): JournalEntry[] {
  const patterns = getPatterns()
  const paymentDateStr = data.paymentDate.replace(/-/g, '')

  return data.transactions.map((tx) => {
    const amount = Math.abs(tx.amount)
    const usageDateLabel = formatUsageDate(tx.usageDate)
    const descBase = tx.storeName || ''
    const description = usageDateLabel
      ? `${descBase}_${usageDateLabel}`.slice(0, 25)
      : descBase.slice(0, 25)

    const pattern = findPattern(patterns, tx.storeName, amount)

    let debitCode = ''
    let debitName = ''
    let debitSubCode = ''
    let debitSubName = ''
    let taxCode = ''
    let taxCategory = ''
    let businessType = ''
    let patternId: string | null = null

    if (pattern) {
      const line = pattern.lines[0]
      if (line) {
        // パターンからカード科目でない方（費用科目側）を借方にセット
        if (line.debitCode !== creditCardAccountCode) {
          debitCode = line.debitCode
          debitName = line.debitName
          debitSubCode = line.debitSubCode || ''
          debitSubName = line.debitSubName || ''
        } else if (line.creditCode !== creditCardAccountCode) {
          debitCode = line.creditCode
          debitName = line.creditName
          debitSubCode = line.creditSubCode || ''
          debitSubName = line.creditSubName || ''
        }
        taxCode = line.taxCode || ''
        taxCategory = line.taxCategory || ''
        businessType = line.businessType || ''
      }
      patternId = pattern.id
    }

    const entry: JournalEntry = {
      id: generateEntryId(),
      transactionId: null,
      date: paymentDateStr,
      debitCode,
      debitName,
      debitSubCode,
      debitSubName,
      debitTaxType: taxCategory,
      debitIndustry: '',
      debitTaxInclude: '',
      debitAmount: amount,
      debitTaxAmount: 0,
      debitTaxCode: taxCode,
      debitTaxRate: taxCode ? '4' : '',
      debitBusinessType: businessType,
      creditCode: creditCardAccountCode,
      creditName: creditCardAccountName,
      creditSubCode: '',
      creditSubName: '',
      creditTaxType: '',
      creditIndustry: '',
      creditTaxInclude: '',
      creditAmount: amount,
      creditTaxAmount: 0,
      creditTaxCode: '',
      creditTaxRate: '',
      creditBusinessType: '',
      description,
      originalDescription: tx.storeName,
      patternId,
      isCompound: false,
      parentId: null,
    }
    return entry
  })
}
