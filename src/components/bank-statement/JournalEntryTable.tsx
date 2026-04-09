'use client'

import { useCallback } from 'react'
import type {
  JournalEntry,
  AccountItem,
  StatementPage,
} from '@/lib/bank-statement/types'
import {
  createBlankEntry,
  createCompoundEntry,
} from '@/lib/bank-statement/journal-mapper'
import { learnPattern } from '@/lib/bank-statement/pattern-store'
import JournalEntryRow from './JournalEntryRow'

interface Props {
  entries: JournalEntry[]
  accountMaster: AccountItem[]
  selectedEntryId: string | null
  onSelect: (entryId: string | null) => void
  onEntriesChange: (entries: JournalEntry[]) => void
  pages: StatementPage[]
}

export default function JournalEntryTable({
  entries,
  accountMaster,
  selectedEntryId,
  onSelect,
  onEntriesChange,
  pages,
}: Props) {
  const handleEntryChange = useCallback(
    (id: string, field: keyof JournalEntry, value: string | number) => {
      onEntriesChange(
        entries.map((entry) => {
          if (entry.id !== id) return entry

          const updated = { ...entry, [field]: value }

          // 科目コードが変更された場合、科目名を自動設定
          if (field === 'debitCode') {
            const account = accountMaster.find((a) => a.code === value)
            if (account) updated.debitName = account.name
          }
          if (field === 'creditCode') {
            const account = accountMaster.find((a) => a.code === value)
            if (account) updated.creditName = account.name
          }

          return updated
        }),
      )
    },
    [entries, onEntriesChange, accountMaster],
  )

  const handleLearnPattern = useCallback(
    (entry: JournalEntry) => {
      if (!entry.description) return
      learnPattern(
        entry.description,
        entry.debitCode,
        entry.debitName,
        entry.creditCode,
        entry.creditName,
        entry.debitTaxCode || entry.creditTaxCode,
        entry.debitTaxType || entry.creditTaxType,
        entry.debitBusinessType || entry.creditBusinessType,
      )
    },
    [],
  )

  const handleAddBlankRow = useCallback(
    (afterId: string) => {
      const idx = entries.findIndex((e) => e.id === afterId)
      const newEntry = createBlankEntry()
      const newEntries = [...entries]
      newEntries.splice(idx + 1, 0, newEntry)
      onEntriesChange(newEntries)
    },
    [entries, onEntriesChange],
  )

  const handleAddCompoundRow = useCallback(
    (parentId: string) => {
      const parent = entries.find((e) => e.id === parentId)
      if (!parent) return
      const idx = entries.findIndex((e) => e.id === parentId)
      // 複合仕訳の追加行を親の直後（既存の複合行の後）に挿入
      let insertIdx = idx + 1
      while (
        insertIdx < entries.length &&
        entries[insertIdx].parentId === parentId
      ) {
        insertIdx++
      }
      const newEntry = createCompoundEntry(parent)
      const newEntries = [...entries]
      newEntries.splice(insertIdx, 0, newEntry)
      onEntriesChange(newEntries)
    },
    [entries, onEntriesChange],
  )

  const handleDeleteRow = useCallback(
    (id: string) => {
      onEntriesChange(entries.filter((e) => e.id !== id))
    },
    [entries, onEntriesChange],
  )

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between shrink-0">
        <span className="text-sm font-medium text-gray-700">
          仕訳データ ({entries.length}件)
        </span>
        <button
          onClick={() => {
            const newEntry = createBlankEntry()
            onEntriesChange([...entries, newEntry])
          }}
          className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50"
        >
          + 空白行追加
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs border-collapse min-w-[1200px]">
          <thead className="sticky top-0 bg-gray-100 z-10">
            <tr>
              <th className="border-b border-gray-300 px-2 py-2 text-left w-20">日付</th>
              <th className="border-b border-gray-300 px-2 py-2 text-left w-16">借方CD</th>
              <th className="border-b border-gray-300 px-2 py-2 text-left w-24">借方科目</th>
              <th className="border-b border-gray-300 px-2 py-2 text-right w-20">借方金額</th>
              <th className="border-b border-gray-300 px-2 py-2 text-left w-16">貸方CD</th>
              <th className="border-b border-gray-300 px-2 py-2 text-left w-24">貸方科目</th>
              <th className="border-b border-gray-300 px-2 py-2 text-right w-20">貸方金額</th>
              <th className="border-b border-gray-300 px-2 py-2 text-left w-16">税CD</th>
              <th className="border-b border-gray-300 px-2 py-2 text-left w-20">税区分</th>
              <th className="border-b border-gray-300 px-2 py-2 text-left w-20">事業者区分</th>
              <th className="border-b border-gray-300 px-2 py-2 text-left">摘要</th>
              <th className="border-b border-gray-300 px-2 py-2 w-20">操作</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <JournalEntryRow
                key={entry.id}
                entry={entry}
                isSelected={entry.id === selectedEntryId}
                accountMaster={accountMaster}
                onSelect={() => onSelect(entry.id === selectedEntryId ? null : entry.id)}
                onChange={handleEntryChange}
                onLearn={() => handleLearnPattern(entry)}
                onAddBlank={() => handleAddBlankRow(entry.id)}
                onAddCompound={() => handleAddCompoundRow(entry.id)}
                onDelete={() => handleDeleteRow(entry.id)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
