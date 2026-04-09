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

      // 学習パターンから科目を推定
      const pattern = findPattern(patterns, tx.description)

      let entry: JournalEntry

      if (isDeposit) {
        // 入金: 借方=預金口座、貸方=推定or空白
        entry = createEntry(tx, {
          debitCode: accountCode,
          debitName: accountName,
          debitAmount: amount,
          creditCode: pattern?.creditCode || '',
          creditName: pattern?.creditName || '',
          creditAmount: amount,
          taxCode: pattern?.taxCode || '',
          taxCategory: pattern?.taxCategory || '',
          businessType: pattern?.businessType || '',
        })
      } else {
        // 出金: 借方=推定or空白、貸方=預金口座
        entry = createEntry(tx, {
          debitCode: pattern?.debitCode || '',
          debitName: pattern?.debitName || '',
          debitAmount: amount,
          creditCode: accountCode,
          creditName: accountName,
          creditAmount: amount,
          taxCode: pattern?.taxCode || '',
          taxCategory: pattern?.taxCategory || '',
          businessType: pattern?.businessType || '',
        })
      }

      entries.push(entry)
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
