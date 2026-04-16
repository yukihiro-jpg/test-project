import { useState, useEffect, useCallback } from 'react'
import type { AppConfig, BankAccount } from '../lib/types'
import { readConfig, saveConfig, readBankAccounts, saveBankAccounts } from '../lib/ipc'

export function useCompanySettings() {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])

  useEffect(() => {
    readConfig().then(setConfig)
    readBankAccounts().then(setBankAccounts)
  }, [])

  const updateConfig = useCallback(async (updates: Partial<AppConfig>) => {
    if (!config) return
    const updated = { ...config, ...updates }
    await saveConfig(updated)
    setConfig(updated)
  }, [config])

  const addBankAccount = useCallback(async (account: BankAccount) => {
    const updated = [...bankAccounts, account]
    await saveBankAccounts(updated)
    setBankAccounts(updated)
  }, [bankAccounts])

  const removeBankAccount = useCallback(async (accountId: string) => {
    const updated = bankAccounts.filter((a) => a.id !== accountId)
    await saveBankAccounts(updated)
    setBankAccounts(updated)
  }, [bankAccounts])

  return {
    config,
    bankAccounts,
    updateConfig,
    addBankAccount,
    removeBankAccount,
  }
}
