import { useState, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { CashLedgerMonth, CashEntry, BankBookMonth, BankEntry } from '../lib/types'
import { recalculateCashBalances, recalculateBankBalances } from '../lib/balance'
import { readCashMonth, saveCashMonth, readBankMonth, saveBankMonth } from '../lib/ipc'

// ===== 現金出納帳 =====

export function useCashTransactions() {
  const [data, setData] = useState<CashLedgerMonth | null>(null)
  const [loading, setLoading] = useState(false)

  const loadMonth = useCallback(async (month: string, defaultCarryOver: number = 0) => {
    setLoading(true)
    try {
      let monthData = await readCashMonth(month)
      if (!monthData) {
        monthData = { month, carryOver: defaultCarryOver, entries: [] }
      }
      setData(monthData)
    } finally {
      setLoading(false)
    }
  }, [])

  const addEntry = useCallback(async (entry: Omit<CashEntry, 'id' | 'balance' | 'createdAt' | 'updatedAt'>) => {
    if (!data) return
    const now = new Date().toISOString()
    const newEntry: CashEntry = {
      ...entry,
      id: uuidv4(),
      balance: 0,
      createdAt: now,
      updatedAt: now,
    }
    const updated = recalculateCashBalances({
      ...data,
      entries: [...data.entries, newEntry],
    })
    setData(updated)
    await saveCashMonth(updated)
  }, [data])

  const updateEntry = useCallback(async (index: number, updates: Partial<CashEntry>) => {
    if (!data) return
    const entries = [...data.entries]
    entries[index] = { ...entries[index], ...updates, updatedAt: new Date().toISOString() }
    const updated = recalculateCashBalances({ ...data, entries })
    setData(updated)
    await saveCashMonth(updated)
  }, [data])

  const deleteEntry = useCallback(async (index: number) => {
    if (!data) return
    const entries = data.entries.filter((_, i) => i !== index)
    const updated = recalculateCashBalances({ ...data, entries })
    setData(updated)
    await saveCashMonth(updated)
  }, [data])

  const setCarryOver = useCallback(async (carryOver: number) => {
    if (!data) return
    const updated = recalculateCashBalances({ ...data, carryOver })
    setData(updated)
    await saveCashMonth(updated)
  }, [data])

  const setReconciliation = useCallback(async (actualBalance: number) => {
    if (!data) return
    const bookBalance = data.entries.length > 0
      ? data.entries[data.entries.length - 1].balance
      : data.carryOver
    const updated = {
      ...data,
      reconciliation: {
        date: new Date().toISOString(),
        actualBalance,
        bookBalance,
        difference: actualBalance - bookBalance,
      },
    }
    setData(updated)
    await saveCashMonth(updated)
  }, [data])

  return { data, loading, loadMonth, addEntry, updateEntry, deleteEntry, setCarryOver, setReconciliation }
}

// ===== 通帳記録 =====

export function useBankTransactions() {
  const [data, setData] = useState<BankBookMonth | null>(null)
  const [loading, setLoading] = useState(false)

  const loadMonth = useCallback(async (accountId: string, month: string, defaultCarryOver: number = 0) => {
    setLoading(true)
    try {
      let monthData = await readBankMonth(accountId, month)
      if (!monthData) {
        monthData = { month, accountId, carryOver: defaultCarryOver, entries: [] }
      }
      setData(monthData)
    } finally {
      setLoading(false)
    }
  }, [])

  const addEntry = useCallback(async (entry: Omit<BankEntry, 'id' | 'balance' | 'createdAt' | 'updatedAt'>) => {
    if (!data) return
    const now = new Date().toISOString()
    const newEntry: BankEntry = {
      ...entry,
      id: uuidv4(),
      balance: 0,
      createdAt: now,
      updatedAt: now,
    }
    const updated = recalculateBankBalances({
      ...data,
      entries: [...data.entries, newEntry],
    })
    setData(updated)
    await saveBankMonth(updated)
  }, [data])

  const updateEntry = useCallback(async (index: number, updates: Partial<BankEntry>) => {
    if (!data) return
    const entries = [...data.entries]
    entries[index] = { ...entries[index], ...updates, updatedAt: new Date().toISOString() }
    const updated = recalculateBankBalances({ ...data, entries })
    setData(updated)
    await saveBankMonth(updated)
  }, [data])

  const deleteEntry = useCallback(async (index: number) => {
    if (!data) return
    const entries = data.entries.filter((_, i) => i !== index)
    const updated = recalculateBankBalances({ ...data, entries })
    setData(updated)
    await saveBankMonth(updated)
  }, [data])

  const setCarryOver = useCallback(async (carryOver: number) => {
    if (!data) return
    const updated = recalculateBankBalances({ ...data, carryOver })
    setData(updated)
    await saveBankMonth(updated)
  }, [data])

  return { data, loading, loadMonth, addEntry, updateEntry, deleteEntry, setCarryOver }
}
