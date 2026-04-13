'use client'

import { useCallback, useState, useMemo } from 'react'
import type {
  JournalEntry,
  AccountItem,
  SubAccountItem,
  StatementPage,
  PatternLine,
} from '@/lib/bank-statement/types'
import {
  createBlankEntry,
  createCompoundEntry,
} from '@/lib/bank-statement/journal-mapper'
import { learnFromEntriesWithRange, getPatterns } from '@/lib/bank-statement/pattern-store'
import { saveSubAccountMaster } from '@/lib/bank-statement/account-master'
import JournalEntryRow from './JournalEntryRow'
import LearnPatternDialog from './LearnPatternDialog'
import ApplyPatternDialog from './ApplyPatternDialog'
import PatternDetailDialog from './PatternDetailDialog'

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

  // パターン学習ダイアログ
  const [learnDialogEntry, setLearnDialogEntry] = useState<JournalEntry | null>(null)
  const [learnRelatedEntries, setLearnRelatedEntries] = useState<JournalEntry[]>([])
  // 反映確認ダイアログ
  const [applyTargetEntries, setApplyTargetEntries] = useState<JournalEntry[]>([])
  const [applyPatternLines, setApplyPatternLines] = useState<PatternLine[]>([])
  const [applyAmountRange, setApplyAmountRange] = useState<{ min: number | null; max: number | null } | null>(null)
  const [showApplyDialog, setShowApplyDialog] = useState(false)
  // パターン詳細ダイアログ
  const [patternDetailId, setPatternDetailId] = useState<string | null>(null)

  // パターン学習ダイアログ確定
  const handleLearnConfirm = useCallback(
    (amountMin: number | null, amountMax: number | null, applyToAll: boolean) => {
      if (!learnDialogEntry || learnRelatedEntries.length === 0) return
      const originalDesc = learnDialogEntry.originalDescription || learnDialogEntry.description
      if (!originalDesc) { setLearnDialogEntry(null); return }

      const patternId = learnFromEntriesWithRange(originalDesc, learnRelatedEntries, amountMin, amountMax)
      const learnedIds = new Set(learnRelatedEntries.map((e) => e.id))
      const updatedEntries = entries.map((e) =>
        learnedIds.has(e.id) ? { ...e, patternId } : e,
      )

      if (applyToAll) {
        const targets = updatedEntries.filter((e) => {
          if (learnedIds.has(e.id)) return false
          if (e.parentId) return false
          if ((e.originalDescription || '').toLowerCase() !== originalDesc.toLowerCase()) return false
          const amt = e.debitAmount || e.creditAmount || 0
          if (amountMin != null && amt < amountMin) return false
          if (amountMax != null && amt > amountMax) return false
          return true
        })

        const patterns = getPatterns()
        const pat = patterns.find((p) => p.id === patternId)
        if (!pat) { onEntriesChange(updatedEntries); setLearnDialogEntry(null); return }

        setApplyTargetEntries(targets)
        setApplyPatternLines(pat.lines)
        setApplyAmountRange({ min: amountMin, max: amountMax })
        setShowApplyDialog(true)
        onEntriesChange(updatedEntries)
      } else {
        onEntriesChange(updatedEntries)
      }

      setLearnDialogEntry(null)
      setLearnRelatedEntries([])
    },
    [learnDialogEntry, learnRelatedEntries, entries, onEntriesChange],
  )

  // 反映確定
  const handleApplyConfirm = useCallback(() => {
    if (applyTargetEntries.length === 0 || applyPatternLines.length === 0) {
      setShowApplyDialog(false); return
    }

    const targetIds = new Set(applyTargetEntries.map((e) => e.id))
    const firstLine = applyPatternLines[0]
    const isCompoundPattern = applyPatternLines.length > 1

    // パターンから相手勘定コード・名称を取得（通帳科目と違う側）
    const getCounterpart = (line: typeof firstLine) => {
      if (line.debitCode !== bankAccountCode) {
        return { code: line.debitCode, name: line.debitName }
      }
      return { code: line.creditCode, name: line.creditName }
    }

    const newEntries: JournalEntry[] = []
    for (const e of entries) {
      if (!targetIds.has(e.id)) {
        newEntries.push(e)
        continue
      }
      const updatedEntry = { ...e }

      if (isCompoundPattern) {
        // 複合仕訳パターン: パターン全体の科目コードをそのまま反映
        updatedEntry.debitCode = firstLine.debitCode
        updatedEntry.debitName = firstLine.debitName
        updatedEntry.creditCode = firstLine.creditCode
        updatedEntry.creditName = firstLine.creditName
      } else {
        // 単一仕訳パターン: 相手勘定コードのみ反映（通帳側は維持）
        const counter = getCounterpart(firstLine)
        if (e.debitCode === bankAccountCode) {
          updatedEntry.creditCode = counter.code
          updatedEntry.creditName = counter.name
        } else if (e.creditCode === bankAccountCode) {
          updatedEntry.debitCode = counter.code
          updatedEntry.debitName = counter.name
        } else {
          updatedEntry.debitCode = firstLine.debitCode
          updatedEntry.debitName = firstLine.debitName
          updatedEntry.creditCode = firstLine.creditCode
          updatedEntry.creditName = firstLine.creditName
        }
      }

      // 摘要・消費税コード・事業者区分を反映
      updatedEntry.description = firstLine.description || e.description
      updatedEntry.debitTaxCode = firstLine.taxCode
      updatedEntry.debitTaxType = firstLine.taxCategory
      updatedEntry.debitBusinessType = firstLine.businessType

      const patterns = getPatterns()
      const matchedPat = patterns.find((p) =>
        p.keyword.toLowerCase() === (e.originalDescription || '').toLowerCase(),
      )
      if (matchedPat) updatedEntry.patternId = matchedPat.id
      newEntries.push(updatedEntry)

      // 複合仕訳パターンの追加行をそのまま展開
      if (isCompoundPattern) {
        for (let i = 1; i < applyPatternLines.length; i++) {
          const line = applyPatternLines[i]
          const compoundEntry = createCompoundEntry(updatedEntry)
          compoundEntry.patternId = updatedEntry.patternId
          compoundEntry.debitCode = line.debitCode
          compoundEntry.debitName = line.debitName
          compoundEntry.creditCode = line.creditCode
          compoundEntry.creditName = line.creditName
          compoundEntry.debitTaxCode = line.taxCode
          compoundEntry.debitTaxType = line.taxCategory
          compoundEntry.debitBusinessType = line.businessType
          compoundEntry.description = line.description
          compoundEntry.originalDescription = e.originalDescription
          // パターンの学習時金額を復元（997自動計算対象の最終行以外）
          compoundEntry.debitAmount = line.amount || 0
          compoundEntry.creditAmount = line.amount || 0
          newEntries.push(compoundEntry)
        }
      }
    }

    onEntriesChange(newEntries)
    setShowApplyDialog(false)
    setApplyTargetEntries([])
    setApplyPatternLines([])
    setApplyAmountRange(null)
  }, [applyTargetEntries, applyPatternLines, entries, onEntriesChange, bankAccountCode])

  const handleRowSelect = useCallback(
    (entryId: string) => {
      // 常に選択状態を更新（どのセルクリックでも）
      setLastClickedId(entryId)
      onSelect(entryId)
    },
    [onSelect],
  )

  const handleRowShiftClick = useCallback(
    (entryId: string, e: React.MouseEvent) => {
      if (e.shiftKey && lastClickedId) {
        e.preventDefault()
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
      onEntriesChange(entries.map((e) => {
        if (e.id !== id) return e
        // _amount は debitAmount と creditAmount の両方を同時更新する特殊フィールド
        if (field === '_amount' as keyof JournalEntry) {
          return { ...e, debitAmount: value as number, creditAmount: value as number }
        }
        return { ...e, [field]: value }
      }))
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
    const info: Record<string, { isGroup: boolean; isFirst: boolean; isLast: boolean; autoAmount: number }> = {}

    // 複合仕訳グループを構築
    // entries配列を順番に走査し、entriesの順序でグループメンバーを記録
    const groupMembers: Record<string, JournalEntry[]> = {}
    for (const e of entries) {
      // この行は「親」か「子」か判定
      const hasChildren = entries.some((c) => c.parentId === e.id)
      const groupKey = e.parentId || (hasChildren ? e.id : null)
      if (groupKey) {
        if (!groupMembers[groupKey]) groupMembers[groupKey] = []
        groupMembers[groupKey].push(e)
      }
    }

    // デバッグ用
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__compoundDebug = groupMembers
    }

    // 997の貸借一致で自動計算
    for (const [, members] of Object.entries(groupMembers)) {
      if (members.length === 0) continue
      const firstEntry = members[0]
      const lastEntry = members[members.length - 1]

      // 最終行以外の997借方合計・貸方合計
      let debit997Total = 0
      let credit997Total = 0
      for (const m of members) {
        if (m.id === lastEntry.id) continue // 最終行は除外
        const amt = m.debitAmount || m.creditAmount || 0
        if (m.debitCode === '997') debit997Total += amt
        if (m.creditCode === '997') credit997Total += amt
      }

      // 最終行の自動計算: 997の貸借が一致する金額
      console.log(`[997Calc] group size=${members.length}, debit997Total=${debit997Total}, credit997Total=${credit997Total}, lastEntry.debitCode=${lastEntry.debitCode}, lastEntry.creditCode=${lastEntry.creditCode}`)
      let autoAmount = 0
      if (lastEntry.debitCode === '997') {
        autoAmount = credit997Total - debit997Total
      } else if (lastEntry.creditCode === '997') {
        autoAmount = debit997Total - credit997Total
      }

      for (const m of members) {
        info[m.id] = {
          isGroup: true,
          isFirst: m.id === firstEntry.id,
          isLast: m.id === lastEntry.id,
          autoAmount: m.id === lastEntry.id ? autoAmount : 0,
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
        <div className="flex items-center gap-2">
          <button onClick={() => {
            // 科目チェックリストから仮払金を検索
            const karibarai = accountMaster.find((a) =>
              a.name.includes('仮払') || a.shortName.includes('仮払')
            )
            if (!karibarai) {
              alert('科目チェックリストに「仮払金」が見つかりません。\n科目チェックリストを先に登録してください。')
              return
            }
            // 未入力の借方・貸方コードに仮払金を一括設定（ユーザー入力済みは除外）
            const updated = entries.map((e) => {
              const u = { ...e }
              if (!u.debitCode && !u.patternId) {
                u.debitCode = karibarai.code
                u.debitName = karibarai.shortName || karibarai.name
              }
              if (!u.creditCode && !u.patternId) {
                u.creditCode = karibarai.code
                u.creditName = karibarai.shortName || karibarai.name
              }
              return u
            })
            onEntriesChange(updated)
          }}
            className="px-3 py-1 text-xs bg-amber-500 text-white font-medium rounded hover:bg-amber-600">
            仮払金一括登録
          </button>
          <button onClick={() => {
            const idx = selectedEntryId ? entries.findIndex((e) => e.id === selectedEntryId) : 0
            const ne = [...entries]
            ne.splice(Math.max(idx, 0), 0, createBlankEntry())
            onEntriesChange(ne)
          }}
            className="px-3 py-1 text-xs bg-white text-gray-700 font-medium rounded hover:bg-gray-100">+ 選択行の上に1行追加</button>
        </div>
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
        <table className="w-full text-sm border-collapse min-w-[950px]">
          <thead className="sticky top-0 bg-gray-600 text-white z-10">
            <tr>
              <th className="px-2 py-2 text-center w-12 font-medium" style={{ borderRight: '1px solid #94a3b8' }}>学習</th>
              <th className="px-2 py-2 text-center w-24 font-medium" style={{ borderRight: '1px solid #94a3b8' }}>日付</th>
              <th className="px-2 py-2 text-center w-44 font-medium" style={{ borderRight: '1px solid #94a3b8' }}>借方科目</th>
              <th className="px-2 py-2 text-center w-44 font-medium" style={{ borderRight: '1px solid #94a3b8' }}>貸方科目</th>
              <th className="px-2 py-2 text-center w-24 font-medium" style={{ borderRight: '1px solid #94a3b8' }}>金額</th>
              <th className="px-2 py-2 text-center w-28 font-medium" style={{ borderRight: '1px solid #94a3b8' }}>残高</th>
              <th className="px-2 py-2 text-center w-28 font-medium" style={{ borderRight: '1px solid #94a3b8' }}>消費税</th>
              <th className="px-2 py-2 text-center w-12 font-medium" style={{ borderRight: '1px solid #94a3b8' }}>事業者</th>
              <th className="px-2 py-2 text-center font-medium" style={{ borderRight: '1px solid #94a3b8', minWidth: '180px' }}>摘要</th>
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
                  isCompoundFirst={ci?.isFirst}
                  isCompoundLast={ci?.isLast}
                  compoundAutoAmount={ci?.isLast ? ci.autoAmount : undefined}
                  onSelect={(id: string) => handleRowSelect(id)}
                  onChange={handleEntryChange}
                  onLearn={() => {
                    if (!entry.originalDescription && !entry.description) return
                    // 複合仕訳グループ全体を学習対象にする
                    const groupId = entry.parentId || entry.id
                    const groupEntries = entries.filter((e) => e.id === groupId || e.parentId === groupId)
                    setLearnDialogEntry(entry)
                    setLearnRelatedEntries(groupEntries.length > 0 ? groupEntries : [entry])
                  }}
                  onAddBlank={() => {
                    const i = entries.findIndex((e) => e.id === entry.id)
                    const ne = [...entries]; ne.splice(i + 1, 0, createBlankEntry()); onEntriesChange(ne)
                  }}
                  onAddCompound={() => handleAddCompoundRow(entry.id)}
                  onDelete={() => onEntriesChange(entries.filter((e) => e.id !== entry.id))}
                  onSubAccountRegister={handleSubAccountRegister}
                  onPatternClick={(pid) => setPatternDetailId(pid)}
                />
              )
            })}
          </tbody>
        </table>
      </div>

      {/* パターン学習ダイアログ */}
      <LearnPatternDialog
        open={learnDialogEntry !== null}
        entry={learnDialogEntry}
        relatedEntries={learnRelatedEntries}
        onConfirm={handleLearnConfirm}
        onCancel={() => { setLearnDialogEntry(null); setLearnRelatedEntries([]) }}
      />

      {/* 反映確認ダイアログ */}
      <ApplyPatternDialog
        open={showApplyDialog}
        targetEntries={applyTargetEntries}
        patternLines={applyPatternLines}
        onConfirm={handleApplyConfirm}
        onCancel={() => {
          setShowApplyDialog(false)
          setApplyTargetEntries([])
          setApplyPatternLines([])
          setApplyAmountRange(null)
        }}
      />

      {/* パターン詳細ダイアログ */}
      <PatternDetailDialog
        open={patternDetailId !== null}
        patternId={patternDetailId}
        onClose={() => setPatternDetailId(null)}
      />
    </div>
  )
}
