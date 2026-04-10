'use client'

import { useCallback, useState } from 'react'
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
  bankAccountCode: string // 通帳の科目コード
}

export default function JournalEntryTable({
  entries,
  accountMaster,
  selectedEntryId,
  onSelect,
  onEntriesChange,
  pages,
  bankAccountCode,
}: Props) {
  // 範囲選択state
  const [selectedRange, setSelectedRange] = useState<Set<string>>(new Set())
  const [lastClickedId, setLastClickedId] = useState<string | null>(null)
  const [showBulkEdit, setShowBulkEdit] = useState(false)
  const [bulkField, setBulkField] = useState<string>('')
  const [bulkValue, setBulkValue] = useState<string>('')

  const handleRowClick = useCallback(
    (entryId: string, e: React.MouseEvent) => {
      if (e.shiftKey && lastClickedId) {
        // Shift+クリック: 範囲選択
        const startIdx = entries.findIndex((en) => en.id === lastClickedId)
        const endIdx = entries.findIndex((en) => en.id === entryId)
        const [from, to] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx]
        const newRange = new Set<string>()
        for (let i = from; i <= to; i++) newRange.add(entries[i].id)
        setSelectedRange(newRange)
        setShowBulkEdit(true)
      } else {
        setSelectedRange(new Set())
        setShowBulkEdit(false)
        onSelect(entryId === selectedEntryId ? null : entryId)
      }
      setLastClickedId(entryId)
    },
    [entries, lastClickedId, selectedEntryId, onSelect],
  )

  const applyBulkEdit = useCallback(() => {
    if (!bulkField || selectedRange.size === 0) return
    const accountItem = accountMaster.find((a) => a.code === bulkValue)
    onEntriesChange(
      entries.map((entry) => {
        if (!selectedRange.has(entry.id)) return entry
        const updated = { ...entry, [bulkField]: bulkValue }
        // CD変更時は科目名も自動設定
        if (bulkField === 'debitCode' && accountItem) updated.debitName = accountItem.name
        if (bulkField === 'creditCode' && accountItem) updated.creditName = accountItem.name
        return updated
      }),
    )
    setShowBulkEdit(false)
    setSelectedRange(new Set())
    setBulkValue('')
  }, [bulkField, bulkValue, selectedRange, entries, onEntriesChange, accountMaster])

  const handleEntryChange = useCallback(
    (id: string, field: keyof JournalEntry, value: string | number) => {
      onEntriesChange(
        entries.map((entry) => {
          if (entry.id !== id) return entry

          const updated = { ...entry, [field]: value }

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

  // 仕訳からページインデックスを取得
  const getPageIndex = (entry: JournalEntry, pgs: StatementPage[]): number => {
    if (!entry.transactionId) return -1
    for (const page of pgs) {
      if (page.transactions.some((t) => t.id === entry.transactionId)) {
        return page.pageIndex
      }
    }
    return -1
  }

  // 仕訳データから残高を動的に計算
  // 通帳科目が借方にある=入金、貸方にある=出金
  const computeRunningBalances = (): number[] => {
    const balances: number[] = []
    // 最初のページの開始残高を取得
    const openingBalance = pages.length > 0 ? pages[0].openingBalance : 0
    let running = openingBalance

    for (const entry of entries) {
      const amount = entry.debitAmount || entry.creditAmount || 0
      if (entry.debitCode === bankAccountCode) {
        // 借方が通帳 = 入金
        running += amount
      } else if (entry.creditCode === bankAccountCode) {
        // 貸方が通帳 = 出金
        running -= amount
      }
      balances.push(running)
    }
    return balances
  }

  const runningBalances = computeRunningBalances()

  return (
    <div className="flex flex-col h-full bg-white">
      {/* ツールバー */}
      <div className="px-4 py-2 bg-gray-700 flex items-center justify-between shrink-0">
        <span className="text-sm font-medium text-white">
          仕訳データ ({entries.length}件)
        </span>
        <button
          onClick={() => {
            const newEntry = createBlankEntry()
            onEntriesChange([...entries, newEntry])
          }}
          className="px-3 py-1 text-xs bg-white text-gray-700 font-medium rounded hover:bg-gray-100"
        >
          + 行追加
        </button>
      </div>

      {/* 一括変更バー */}
      {showBulkEdit && selectedRange.size > 0 && (
        <div className="px-3 py-2 bg-amber-50 border-b border-amber-200 flex items-center gap-2 shrink-0">
          <span className="text-xs font-medium text-amber-800">
            {selectedRange.size}件選択中
          </span>
          <select
            value={bulkField}
            onChange={(e) => setBulkField(e.target.value)}
            className="px-2 py-1 text-xs border border-gray-300 rounded bg-white"
          >
            <option value="">変更項目を選択</option>
            <option value="debitCode">借方CD</option>
            <option value="creditCode">貸方CD</option>
            <option value="debitTaxCode">消費税CD</option>
            <option value="debitTaxType">税区分</option>
            <option value="debitBusinessType">事業者区分</option>
            <option value="description">摘要</option>
          </select>
          <input
            type="text"
            value={bulkValue}
            onChange={(e) => setBulkValue(e.target.value)}
            placeholder="値を入力"
            className="px-2 py-1 text-xs border border-gray-300 rounded w-32"
          />
          <button
            onClick={applyBulkEdit}
            disabled={!bulkField}
            className="px-3 py-1 text-xs bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-40"
          >
            適用
          </button>
          <button
            onClick={() => { setShowBulkEdit(false); setSelectedRange(new Set()) }}
            className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
          >
            解除
          </button>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse min-w-[900px]">
          <thead className="sticky top-0 bg-gray-600 text-white z-10">
            <tr>
              <th className="px-2 py-2 text-left w-24 font-medium border-r border-gray-500">日付</th>
              <th className="px-2 py-2 text-left w-40 font-medium border-r border-gray-500">借方科目</th>
              <th className="px-2 py-2 text-left w-40 font-medium border-r border-gray-500">貸方科目</th>
              <th className="px-2 py-2 text-right w-24 font-medium border-r border-gray-500">金額</th>
              <th className="px-2 py-2 text-right w-28 font-medium border-r border-gray-500">残高</th>
              <th className="px-2 py-2 text-left w-14 font-medium border-r border-gray-500">税CD</th>
              <th className="px-2 py-2 text-left w-20 font-medium border-r border-gray-500">税区分</th>
              <th className="px-2 py-2 text-left font-medium border-r border-gray-500">摘要</th>
              <th className="px-1 py-2 w-8 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, idx) => {
              // ページ区切り判定: 前の行と異なるページの場合に太線を表示
              const prevEntry = idx > 0 ? entries[idx - 1] : null
              const currentTxPage = getPageIndex(entry, pages)
              const prevTxPage = prevEntry ? getPageIndex(prevEntry, pages) : currentTxPage
              const isPageBoundary = idx > 0 && currentTxPage !== prevTxPage && currentTxPage >= 0 && prevTxPage >= 0

              return (
                <JournalEntryRow
                  key={entry.id}
                  entry={entry}
                  isSelected={entry.id === selectedEntryId || selectedRange.has(entry.id)}
                  accountMaster={accountMaster}
                  isPageBoundary={isPageBoundary}
                  pageLabel={isPageBoundary ? `P${currentTxPage + 1}` : undefined}
                  runningBalance={runningBalances[idx]}
                  rowNumber={idx}
                  onSelect={(e?: React.MouseEvent) => e ? handleRowClick(entry.id, e) : onSelect(entry.id)}
                  onChange={handleEntryChange}
                  onLearn={() => handleLearnPattern(entry)}
                  onAddBlank={() => handleAddBlankRow(entry.id)}
                  onAddCompound={() => handleAddCompoundRow(entry.id)}
                  onDelete={() => handleDeleteRow(entry.id)}
                />
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
