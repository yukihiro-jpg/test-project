import type {
  BankTransaction,
  JournalEntry,
  StatementPage,
  PatternEntry,
  AccountItem,
} from './types'
import { findPattern } from './pattern-store'

let entryIdCounter = 0
function generateEntryId(): string {
  return `je-${Date.now()}-${++entryIdCounter}`
}

/**
 * 通帳取引を仕訳に変換する
 * - 入金: 借方=預金口座、貸方=学習パターンから推定
 * - 出金: 借方=学習パターンから推定、貸方=預金口座
 */
export function mapTransactionsToJournalEntries(
  pages: StatementPage[],
  accountCode: string,
  accountName: string,
  patterns: PatternEntry[],
  accountMaster: AccountItem[],
): JournalEntry[] {
  const entries: JournalEntry[] = []

  for (const page of pages) {
    for (const tx of page.transactions) {
      // 入出金がどちらもない行はスキップ（残高のみの行）
      if (!tx.deposit && !tx.withdrawal) continue

      const isDeposit = (tx.deposit ?? 0) > 0
      const amount = isDeposit ? tx.deposit! : tx.withdrawal!

      // 学習パターンから科目を推定（金額も考慮）
      const pattern = findPattern(patterns, tx.description, amount)

      let entry: JournalEntry

      // パターンの最初の行から科目情報を取得
      const pLine = pattern?.lines?.[0]
      const pDebitCode = pLine?.debitCode || pattern?.debitCode || ''
      const pDebitName = pLine?.debitName || pattern?.debitName || ''
      const pCreditCode = pLine?.creditCode || pattern?.creditCode || ''
      const pCreditName = pLine?.creditName || pattern?.creditName || ''
      const pTaxCode = pLine?.taxCode || pattern?.taxCode || ''
      const pTaxCategory = pLine?.taxCategory || pattern?.taxCategory || ''
      const pBusinessType = pLine?.businessType || pattern?.businessType || ''
      const isCompoundPattern = pattern?.lines && pattern.lines.length > 1

      if (isCompoundPattern && pLine) {
        // 複合仕訳パターン: パターン全体の科目コードをそのまま使う
        entry = createEntry(tx, {
          debitCode: pLine.debitCode,
          debitName: pLine.debitName,
          debitAmount: amount,
          creditCode: pLine.creditCode,
          creditName: pLine.creditName,
          creditAmount: amount,
          taxCode: pTaxCode,
          taxCategory: pTaxCategory,
          businessType: pBusinessType,
        })
      } else if (isDeposit) {
        const counterCode = pattern ? (pCreditCode !== accountCode ? pCreditCode : pDebitCode !== accountCode ? pDebitCode : '') : ''
        const counterName = pattern ? (pCreditCode !== accountCode ? pCreditName : pDebitCode !== accountCode ? pDebitName : '') : ''
        entry = createEntry(tx, {
          debitCode: accountCode,
          debitName: accountName,
          debitAmount: amount,
          creditCode: counterCode,
          creditName: counterName,
          creditAmount: amount,
          taxCode: pTaxCode,
          taxCategory: pTaxCategory,
          businessType: pBusinessType,
        })
      } else {
        const counterCode = pattern ? (pDebitCode !== accountCode ? pDebitCode : pCreditCode !== accountCode ? pCreditCode : '') : ''
        const counterName = pattern ? (pDebitCode !== accountCode ? pDebitName : pCreditCode !== accountCode ? pCreditName : '') : ''
        entry = createEntry(tx, {
          debitCode: counterCode,
          debitName: counterName,
          debitAmount: amount,
          creditCode: accountCode,
          creditName: accountName,
          creditAmount: amount,
          taxCode: pattern?.taxCode || '',
          taxCategory: pTaxCategory,
          businessType: pBusinessType,
        })
      }

      // パターンの変換後摘要とpatternIdを適用
      if (pattern) {
        entry.patternId = pattern.id
        if (pattern.lines?.[0]?.description) {
          entry.description = pattern.lines[0].description
        } else if (pattern.convertedDescription) {
          entry.description = pattern.convertedDescription
        }
      }

      entries.push(entry)

      // パターンが複合仕訳（複数行）の場合、追加行を生成
      if (pattern?.lines && pattern.lines.length > 1) {
        for (let li = 1; li < pattern.lines.length; li++) {
          const line = pattern.lines[li]
          const compoundEntry = createCompoundEntry(entry)
          compoundEntry.patternId = pattern.id
          compoundEntry.debitCode = line.debitCode
          compoundEntry.debitName = line.debitName
          compoundEntry.creditCode = line.creditCode
          compoundEntry.creditName = line.creditName
          compoundEntry.debitTaxCode = line.taxCode
          compoundEntry.debitTaxType = line.taxCategory
          compoundEntry.debitBusinessType = line.businessType
          compoundEntry.description = line.description
          compoundEntry.originalDescription = tx.description
          // パターンの学習時金額を復元
          compoundEntry.debitAmount = line.amount || 0
          compoundEntry.creditAmount = line.amount || 0
          entries.push(compoundEntry)
        }
      }
    }
  }

  return entries
}

interface EntryParams {
  debitCode: string
  debitName: string
  debitAmount: number
  creditCode: string
  creditName: string
  creditAmount: number
  taxCode: string
  taxCategory: string
  businessType: string
}

function createEntry(tx: BankTransaction, params: EntryParams): JournalEntry {
  return {
    id: generateEntryId(),
    transactionId: tx.id,
    date: tx.date.replace(/-/g, ''),
    debitCode: params.debitCode,
    debitName: params.debitName,
    debitSubCode: '',
    debitSubName: '',
    debitTaxType: '',
    debitIndustry: '',
    debitTaxInclude: '',
    debitAmount: params.debitAmount,
    debitTaxAmount: 0,
    debitTaxCode: params.taxCode,
    debitTaxRate: '',
    debitBusinessType: params.businessType,
    creditCode: params.creditCode,
    creditName: params.creditName,
    creditSubCode: '',
    creditSubName: '',
    creditTaxType: '',
    creditIndustry: '',
    creditTaxInclude: '',
    creditAmount: params.creditAmount,
    creditTaxAmount: 0,
    creditTaxCode: params.taxCode,
    creditTaxRate: '',
    creditBusinessType: params.businessType,
    description: tx.description,
    originalDescription: tx.description,
    isCompound: false,
    parentId: null,
  }
}

/**
 * 空白の仕訳行を作成する
 */
export function createBlankEntry(afterEntryId?: string): JournalEntry {
  return {
    id: generateEntryId(),
    transactionId: null,
    date: '',
    debitCode: '',
    debitName: '',
    debitSubCode: '',
    debitSubName: '',
    debitTaxType: '',
    debitIndustry: '',
    debitTaxInclude: '',
    debitAmount: 0,
    debitTaxAmount: 0,
    debitTaxCode: '',
    debitTaxRate: '',
    debitBusinessType: '',
    creditCode: '',
    creditName: '',
    creditSubCode: '',
    creditSubName: '',
    creditTaxType: '',
    creditIndustry: '',
    creditTaxInclude: '',
    creditAmount: 0,
    creditTaxAmount: 0,
    creditTaxCode: '',
    creditTaxRate: '',
    creditBusinessType: '',
    description: '',
    originalDescription: '',
    isCompound: false,
    parentId: null,
  }
}

/**
 * 複合仕訳の追加行を作成する
 */
export function createCompoundEntry(parentEntry: JournalEntry): JournalEntry {
  return {
    ...createBlankEntry(),
    transactionId: parentEntry.transactionId,
    date: parentEntry.date,
    description: parentEntry.description,
    isCompound: true,
    parentId: parentEntry.id,
  }
}
