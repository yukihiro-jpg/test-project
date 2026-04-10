'use client'

import { useCallback, useState, useMemo } from 'react'
import type {
  JournalEntry,
  AccountItem,
  SubAccountItem,
  StatementPage,
} from '@/lib/bank-statement/types'
import {
  createBlankEntry,
  createCompoundEntry,
} from '@/lib/bank-statement/journal-mapper'
import { learnPattern } from '@/lib/bank-statement/pattern-store'
import { saveSubAccountMaster } from '@/lib/bank-statement/account-master'
import JournalEntryRow from './JournalEntryRow'

interface Props {
  entries: JournalEntry[]
  accountMaster: AccountItem[]
  subAccountMaster: SubAccountItem[]
  selectedEntryId: string | null
  onSelect: (entryId: string | null) => void
  onEntriesChange: (entries: JournalEntry[]) => void
  onSubAccountUpdate: (items: SubAccountItem[]) => void
  pages: StatementPage[]
  bankAccountCode: string
}

export default function JournalEntryTable({
  entries, accountMaster, subAccountMaster, selectedEntryId,
  onSelect, onEntriesChange, onSubAccountUpdate, pages, bankAccountCode,
}: Props) {
  const [selectedRange, setSelectedRange] = useState<Set<string>>(new Set())
  const [lastClickedId, setLastClickedId] = useState<string | null>(null)
  const [showBulkEdit, setShowBulkEdit] = useState(false)
  const [bulkField, setBulkField] = useState<string>('')
  const [bulkValue, setBulkValue] = useState<string>('')

  const handleRowClick = useCallback(
    (entryId: string, e: React.MouseEvent) => {
      if (e.shiftKey && lastClickedId) {
        const s = entries.findIndex((en) => en.id === lastClickedId)
        const ed = entries.findIndex((en) => en.id === entryId)
        const [from, to] = s < ed ? [s, ed] : [ed, s]
        const range = new Set<string>()
        for (let i = from; i <= to; i++) range.add(entries[i].id)
        setSelectedRange(range)
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
    const acc = accountMaster.find((a) => a.code === bulkValue)
    onEntriesChange(
      entries.map((entry) => {
        if (!selectedRange.has(entry.id)) return entry
        const u = { ...entry, [bulkField]: bulkValue }
        if (bulkField === 'debitCode' && acc) u.debitName = acc.shortName || acc.name
        if (bulkField === 'creditCode' && acc) u.creditName = acc.shortName || acc.name
        return u
      }),
    )
    setShowBulkEdit(false); setSelectedRange(new Set()); setBulkValue('')
  }, [bulkField, bulkValue, selectedRange, entries, onEntriesChange, accountMaster])

  const handleEntryChange = useCallback(
    (id: string, field: keyof JournalEntry, value: string | number) => {
      onEntriesChange(entries.map((e) => e.id !== id ? e : { ...e, [field]: value }))
    },
    [entries, onEntriesChange],
  )

  const handleAddCompoundRow = useCallback(
    (parentId: string) => {
      // parentIdが既に複合仕訳の子の場合、その親を使う
      const entry = entries.find((e) => e.id === parentId)
      if (!entry) return
      const realParentId = entry.parentId || entry.id
      const idx = entries.findIndex((e) => e.id === realParentId)
      let insertIdx = idx + 1
      while (insertIdx < entries.length && entries[insertIdx].parentId === realParentId) insertIdx++
      const parent = entries.find((e) => e.id === realParentId)!
      const newEntry = createCompoundEntry(parent)
      const newEntries = [...entries]
      newEntries.splice(insertIdx, 0, newEntry)
      onEntriesChange(newEntries)
    },
    [entries, onEntriesChange],
  )

  const handleSubAccountRegister = useCallback(
    (parentCode: string, subCode: string, name: string) => {
      const parentAcc = accountMaster.find((a) => a.code === parentCode)
      const newItem: SubAccountItem = {
        parentCode,
        parentName: parentAcc?.shortName || parentAcc?.name || '',
        subCode,
        name,
        shortName: name,
      }
      const updated = [...subAccountMaster, newItem]
      saveSubAccountMaster(updated)
      onSubAccountUpdate(updated)
    },
    [subAccountMaster, accountMaster, onSubAccountUpdate],
  )

  // 複合仕訳グループと997自動計算
  const compoundInfo = useMemo(() => {
    const info: Record<string, { isGroup: boolean; isLast: boolean; autoAmount: number }> = {}
    // 親IDごとにグループ化
    const groups: Record<string, string[]> = {}
    for (const e of entries) {
      if (e.parentId) {
        if (!groups[e.parentId]) groups[e.parentId] = [e.parentId]
        groups[e.parentId].push(e.id)
      }
    }
    // 各グループの最終行に997の差額を計算
    for (const [parentId, memberIds] of Object.entries(groups)) {
      const parent = entries.find((e) => e.id === parentId)
      if (!parent) continue
      const parentAmount = parent.debitAmount || parent.creditAmount || 0
      let childTotal = 0
      for (const mid of memberIds) {
        if (mid === parentId) continue
        const child = entries.find((e) => e.id === mid)
        if (child) childTotal += child.debitAmount || child.creditAmount || 0
      }
      const lastId = memberIds[memberIds.length - 1]
      for (const mid of memberIds) {
        info[mid] = {
          isGroup: true,
          isLast: mid === lastId,
          autoAmount: mid === lastId ? parentAmount - childTotal : 0,
        }
      }
    }
    return info
  }, [entries])

  const getPageIndex = (entry: JournalEntry, pgs: StatementPage[]): number => {
    if (!entry.transactionId) return -1
    for (const page of pgs) { if (page.transactions.some((t) => t.id === entry.transactionId)) return page.pageIndex }
    return -1
  }

  const runningBalances = useMemo(() => {
    const balances: number[] = []
    const opening = pages.length > 0 ? pages[0].openingBalance : 0
    let running = opening
    for (const entry of entries) {
      const amount = entry.debitAmount || entry.creditAmount || 0
      if (entry.debitCode === bankAccountCode) running += amount
      else if (entry.creditCode === bankAccountCode) running -= amount
      balances.push(running)
    }
    return balances
  }, [entries, pages, bankAccountCode])

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-4 py-2 bg-gray-700 flex items-center justify-between shrink-0">
        <span className="text-sm font-medium text-white">仕訳データ ({entries.length}件)</span>
        <button onClick={() => onEntriesChange([...entries, createBlankEntry()])}
          className="px-3 py-1 text-xs bg-white text-gray-700 font-medium rounded hover:bg-gray-100">+ 行追加</button>
      </div>

      {showBulkEdit && selectedRange.size > 0 && (
        <div className="px-3 py-2 bg-blue-100 border-b border-blue-300 flex items-center gap-2 shrink-0">
          <span className="text-xs font-bold text-blue-800">{selectedRange.size}件選択中</span>
          <select value={bulkField} onChange={(e) => setBulkField(e.target.value)}
            className="px-2 py-1 text-xs border border-blue-300 rounded bg-white">
            <option value="">変更項目</option>
            <option value="debitCode">借方CD</option>
            <option value="creditCode">貸方CD</option>
            <option value="debitTaxCode">消費税CD</option>
            <option value="debitTaxType">税区分</option>
            <option value="description">摘要</option>
          </select>
          <input type="text" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)}
            placeholder="値" className="px-2 py-1 text-xs border border-blue-300 rounded w-28" />
          <button onClick={applyBulkEdit} disabled={!bulkField}
            className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40">適用</button>
          <button onClick={() => { setShowBulkEdit(false); setSelectedRange(new Set()) }}
            className="px-2 py-1 text-xs text-blue-600 hover:underline">解除</button>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse min-w-[900px]">
          <thead className="sticky top-0 bg-gray-600 text-white z-10">
            <tr>
              <th className="px-2 py-2 text-center w-24 font-medium" style={{ borderRight: '1px solid #94a3b8' }}>日付</th>
              <th className="px-2 py-2 text-center w-44 font-medium" style={{ borderRight: '1px solid #94a3b8' }}>借方科目</th>
              <th className="px-2 py-2 text-center w-44 font-medium" style={{ borderRight: '1px solid #94a3b8' }}>貸方科目</th>
              <th className="px-2 py-2 text-center w-24 font-medium" style={{ borderRight: '1px solid #94a3b8' }}>金額</th>
              <th className="px-2 py-2 text-center w-28 font-medium" style={{ borderRight: '1px solid #94a3b8' }}>残高</th>
              <th className="px-2 py-2 text-center w-14 font-medium" style={{ borderRight: '1px solid #94a3b8' }}>税CD</th>
              <th className="px-2 py-2 text-center w-20 font-medium" style={{ borderRight: '1px solid #94a3b8' }}>税区分</th>
              <th className="px-2 py-2 text-center font-medium" style={{ borderRight: '1px solid #94a3b8' }}>摘要</th>
              <th className="px-1 py-2 w-14 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, idx) => {
              const prevEntry = idx > 0 ? entries[idx - 1] : null
              const cp = getPageIndex(entry, pages)
              const pp = prevEntry ? getPageIndex(prevEntry, pages) : cp
              const isPageBoundary = idx > 0 && cp !== pp && cp >= 0 && pp >= 0
              const ci = compoundInfo[entry.id]

              return (
                <JournalEntryRow
                  key={entry.id}
                  entry={entry}
                  isSelected={entry.id === selectedEntryId || selectedRange.has(entry.id)}
                  accountMaster={accountMaster}
                  subAccountMaster={subAccountMaster}
                  isPageBoundary={isPageBoundary}
                  pageLabel={isPageBoundary ? `P${cp + 1}` : undefined}
                  runningBalance={runningBalances[idx]}
                  rowNumber={idx}
                  isCompoundGroup={ci?.isGroup}
                  isCompoundLast={ci?.isLast}
                  compoundAutoAmount={ci?.isLast ? ci.autoAmount : undefined}
                  onSelect={(e) => e ? handleRowClick(entry.id, e) : onSelect(entry.id)}
                  onChange={handleEntryChange}
                  onLearn={() => {
                    if (!entry.description) return
                    learnPattern(entry.description, entry.debitCode, entry.debitName,
                      entry.creditCode, entry.creditName,
                      entry.debitTaxCode, entry.debitTaxType, entry.debitBusinessType)
                  }}
                  onAddBlank={() => {
                    const i = entries.findIndex((e) => e.id === entry.id)
                    const ne = [...entries]; ne.splice(i + 1, 0, createBlankEntry()); onEntriesChange(ne)
                  }}
                  onAddCompound={() => handleAddCompoundRow(entry.id)}
                  onDelete={() => onEntriesChange(entries.filter((e) => e.id !== entry.id))}
                  onSubAccountRegister={handleSubAccountRegister}
                />
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
