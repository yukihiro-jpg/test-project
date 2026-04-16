/// <reference types="vite/client" />

interface ElectronAPI {
  store: {
    hasConfig: () => Promise<boolean>
    readConfig: () => Promise<import('./app/lib/types').AppConfig | null>
    saveConfig: (config: import('./app/lib/types').AppConfig) => Promise<void>
    readCashMonth: (month: string) => Promise<import('./app/lib/types').CashLedgerMonth | null>
    saveCashMonth: (data: import('./app/lib/types').CashLedgerMonth) => Promise<void>
    listCashMonths: () => Promise<string[]>
    readBankMonth: (accountId: string, month: string) => Promise<import('./app/lib/types').BankBookMonth | null>
    saveBankMonth: (data: import('./app/lib/types').BankBookMonth) => Promise<void>
    listBankMonths: (accountId: string) => Promise<string[]>
    readBankAccounts: () => Promise<import('./app/lib/types').BankAccount[]>
    saveBankAccounts: (accounts: import('./app/lib/types').BankAccount[]) => Promise<void>
    readSuggestions: () => Promise<import('./app/lib/types').SuggestionData>
    saveSuggestions: (data: import('./app/lib/types').SuggestionData) => Promise<void>
  }
  export: {
    cashLedger: (month: string, companyName: string) => Promise<string | null>
    bankBook: (accountId: string, month: string, companyName: string, accountName: string) => Promise<string | null>
  }
  dialog: {
    selectFolder: () => Promise<string | null>
  }
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}

export {}
