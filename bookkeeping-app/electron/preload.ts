import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  store: {
    hasConfig: () => ipcRenderer.invoke('store:has-config'),
    readConfig: () => ipcRenderer.invoke('store:read-config'),
    saveConfig: (config: unknown) => ipcRenderer.invoke('store:save-config', config),

    readCashMonth: (month: string) => ipcRenderer.invoke('store:read-cash-month', month),
    saveCashMonth: (data: unknown) => ipcRenderer.invoke('store:save-cash-month', data),
    listCashMonths: () => ipcRenderer.invoke('store:list-cash-months'),

    readBankMonth: (accountId: string, month: string) =>
      ipcRenderer.invoke('store:read-bank-month', accountId, month),
    saveBankMonth: (data: unknown) => ipcRenderer.invoke('store:save-bank-month', data),
    listBankMonths: (accountId: string) =>
      ipcRenderer.invoke('store:list-bank-months', accountId),

    readBankAccounts: () => ipcRenderer.invoke('store:read-bank-accounts'),
    saveBankAccounts: (accounts: unknown) =>
      ipcRenderer.invoke('store:save-bank-accounts', accounts),

    readSuggestions: () => ipcRenderer.invoke('store:read-suggestions'),
    saveSuggestions: (data: unknown) =>
      ipcRenderer.invoke('store:save-suggestions', data),

    readMemo: () => ipcRenderer.invoke('store:read-memo'),
    saveMemo: (memo: unknown) => ipcRenderer.invoke('store:save-memo', memo),

    readAccountCodes: () => ipcRenderer.invoke('store:read-account-codes'),
    saveAccountCodes: (codes: unknown) =>
      ipcRenderer.invoke('store:save-account-codes', codes),

    readCsvLearning: () => ipcRenderer.invoke('store:read-csv-learning'),
    saveCsvLearning: (data: unknown) =>
      ipcRenderer.invoke('store:save-csv-learning', data),
  },

  export: {
    cashLedger: (month: string, companyName: string) =>
      ipcRenderer.invoke('export:cash-ledger', month, companyName),
    bankBook: (accountId: string, month: string, companyName: string, accountName: string) =>
      ipcRenderer.invoke('export:bank-book', accountId, month, companyName, accountName),
  },

  dialog: {
    selectFolder: () => ipcRenderer.invoke('dialog:select-folder'),
    selectCsv: () => ipcRenderer.invoke('dialog:select-csv'),
  },
})
