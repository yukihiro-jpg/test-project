import { useState, useEffect, useCallback } from 'react'
import type { SuggestionData } from '../lib/types'
import { readSuggestions, saveSuggestions } from '../lib/ipc'
import { getAllPresetItems } from '../lib/presets'

const presetItems = getAllPresetItems()

export function useSuggestions() {
  const [data, setData] = useState<SuggestionData>({
    counterpartyMap: {},
    descriptionToType: {},
  })

  useEffect(() => {
    readSuggestions().then(setData)
  }, [])

  /**
   * 取引先名で過去の取引内容を推測
   */
  const getSuggestedDescriptions = useCallback(
    (counterparty: string): string[] => {
      if (!counterparty) return []
      const entry = data.counterpartyMap[counterparty]
      if (!entry) return []
      return Object.entries(entry.descriptions)
        .sort((a, b) => b[1] - a[1])
        .map(([desc]) => desc)
    },
    [data]
  )

  /**
   * 取引先名で過去の取引内容（通帳用）を推測
   */
  const getSuggestedTransactionTypes = useCallback(
    (counterparty: string): string[] => {
      const learned: string[] = []
      if (counterparty) {
        const entry = data.counterpartyMap[counterparty]
        if (entry) {
          learned.push(
            ...Object.entries(entry.transactionTypes)
              .sort((a, b) => b[1] - a[1])
              .map(([type]) => type)
          )
        }
      }
      // 学習データの後にプリセットを追加（重複排除）
      const all = [...learned]
      for (const item of presetItems) {
        if (!all.includes(item)) all.push(item)
      }
      return all
    },
    [data]
  )

  /**
   * 通帳摘要から取引内容を推測
   */
  const getSuggestedTypeFromDescription = useCallback(
    (passbookDesc: string): string | null => {
      if (!passbookDesc) return null
      const entry = data.descriptionToType[passbookDesc]
      if (!entry) return null
      const sorted = Object.entries(entry).sort((a, b) => b[1] - a[1])
      return sorted.length > 0 ? sorted[0][0] : null
    },
    [data]
  )

  /**
   * 取引先名の候補一覧を取得
   */
  const getCounterpartySuggestions = useCallback((): string[] => {
    return Object.entries(data.counterpartyMap)
      .sort((a, b) => {
        const aTime = new Date(a[1].lastUsed).getTime()
        const bTime = new Date(b[1].lastUsed).getTime()
        return bTime - aTime
      })
      .map(([name]) => name)
  }, [data])

  /**
   * 現金出納帳の取引を学習
   */
  const learnCashEntry = useCallback(
    async (counterparty: string, description: string) => {
      if (!counterparty) return

      const updated = { ...data }
      if (!updated.counterpartyMap[counterparty]) {
        updated.counterpartyMap[counterparty] = {
          descriptions: {},
          transactionTypes: {},
          lastUsed: new Date().toISOString(),
        }
      }

      const cp = updated.counterpartyMap[counterparty]
      cp.descriptions[description] = (cp.descriptions[description] || 0) + 1
      cp.lastUsed = new Date().toISOString()

      setData(updated)
      await saveSuggestions(updated)
    },
    [data]
  )

  /**
   * 通帳記録の取引を学習
   */
  const learnBankEntry = useCallback(
    async (counterparty: string, passbookDesc: string, transactionType: string) => {
      const updated = { ...data }

      // 取引先→取引内容マッピング
      if (counterparty) {
        if (!updated.counterpartyMap[counterparty]) {
          updated.counterpartyMap[counterparty] = {
            descriptions: {},
            transactionTypes: {},
            lastUsed: new Date().toISOString(),
          }
        }
        const cp = updated.counterpartyMap[counterparty]
        cp.transactionTypes[transactionType] = (cp.transactionTypes[transactionType] || 0) + 1
        cp.lastUsed = new Date().toISOString()
      }

      // 通帳摘要→取引内容マッピング
      if (passbookDesc) {
        if (!updated.descriptionToType[passbookDesc]) {
          updated.descriptionToType[passbookDesc] = {}
        }
        updated.descriptionToType[passbookDesc][transactionType] =
          (updated.descriptionToType[passbookDesc][transactionType] || 0) + 1
      }

      setData(updated)
      await saveSuggestions(updated)
    },
    [data]
  )

  return {
    getSuggestedDescriptions,
    getSuggestedTransactionTypes,
    getSuggestedTypeFromDescription,
    getCounterpartySuggestions,
    learnCashEntry,
    learnBankEntry,
  }
}
