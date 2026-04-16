/**
 * Electron IPC通信のラッパー
 * window.api を型安全にアクセスするためのヘルパー
 */

import type {
  AppConfig,
  CashLedgerMonth,
  BankBookMonth,
  BankAccount,
  SuggestionData,
} from './types'

function getApi() {
  if (typeof window === 'undefined' || !window.api) {
    throw new Error('Electron APIが利用できません')
  }
  return window.api
}

// ===== Config =====

export async function hasConfig(): Promise<boolean> {
  return getApi().store.hasConfig()
}

export async function readConfig(): Promise<AppConfig | null> {
  return getApi().store.readConfig()
}

export async function saveConfig(config: AppConfig): Promise<void> {
  return getApi().store.saveConfig(config)
}

// ===== Cash Ledger =====

export async function readCashMonth(month: string): Promise<CashLedgerMonth | null> {
  return getApi().store.readCashMonth(month)
}

export async function saveCashMonth(data: CashLedgerMonth): Promise<void> {
  return getApi().store.saveCashMonth(data)
}

export async function listCashMonths(): Promise<string[]> {
  return getApi().store.listCashMonths()
}

// ===== Bank Book =====

export async function readBankMonth(
  accountId: string,
  month: string
): Promise<BankBookMonth | null> {
  return getApi().store.readBankMonth(accountId, month)
}

export async function saveBankMonth(data: BankBookMonth): Promise<void> {
  return getApi().store.saveBankMonth(data)
}

export async function listBankMonths(accountId: string): Promise<string[]> {
  return getApi().store.listBankMonths(accountId)
}

// ===== Bank Accounts =====

export async function readBankAccounts(): Promise<BankAccount[]> {
  return getApi().store.readBankAccounts()
}

export async function saveBankAccounts(accounts: BankAccount[]): Promise<void> {
  return getApi().store.saveBankAccounts(accounts)
}

// ===== Suggestions =====

export async function readSuggestions(): Promise<SuggestionData> {
  return getApi().store.readSuggestions()
}

export async function saveSuggestions(data: SuggestionData): Promise<void> {
  return getApi().store.saveSuggestions(data)
}

// ===== Export =====

export async function exportCashLedger(
  month: string,
  companyName: string
): Promise<string | null> {
  return getApi().export.cashLedger(month, companyName)
}

export async function exportBankBook(
  accountId: string,
  month: string,
  companyName: string,
  accountName: string
): Promise<string | null> {
  return getApi().export.bankBook(accountId, month, companyName, accountName)
}

// ===== Dialog =====

export async function selectFolder(): Promise<string | null> {
  return getApi().dialog.selectFolder()
}
