'use client'

import { useState, useRef, useEffect } from 'react'
import type { JournalEntry, AccountItem } from '@/lib/bank-statement/types'

interface Props {
  entry: JournalEntry
  isSelected: boolean
  accountMaster: AccountItem[]
  isPageBoundary?: boolean
  pageLabel?: string
  runningBalance?: number
  rowNumber: number
  onSelect: () => void
  onChange: (id: string, field: keyof JournalEntry, value: string | number) => void
  onLearn: () => void
  onAddBlank: () => void
  onAddCompound: () => void
  onDelete: () => void
}

const REQUIRED_FIELDS: (keyof JournalEntry)[] = [
  'debitCode', 'creditCode', 'debitTaxCode', 'debitTaxType', 'debitBusinessType',
]

export default function JournalEntryRow({
  entry,
  isSelected,
  accountMaster,
  isPageBoundary,
  pageLabel,
  runningBalance,
  rowNumber,
  onSelect,
  onChange,
  onLearn,
  onAddBlank,
  onAddCompound,
  onDelete,
}: Props) {
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const amount = entry.debitAmount || entry.creditAmount || 0

  const handleAmountChange = (v: string) => {
    const num = parseInt(v.replace(/[^0-9]/g, '')) || 0
    onChange(entry.id, 'debitAmount', num)
    onChange(entry.id, 'creditAmount', num)
  }

  const handleDebitCodeChange = (code: string) => {
    onChange(entry.id, 'debitCode', code)
    const account = accountMaster.find((a) => a.code === code)
    if (account) onChange(entry.id, 'debitName', account.name)
  }

  const handleCreditCodeChange = (code: string) => {
    onChange(entry.id, 'creditCode', code)
    const account = accountMaster.find((a) => a.code === code)
    if (account) onChange(entry.id, 'creditName', account.name)
  }

  const isEmpty = (field: keyof JournalEntry) => {
    const v = entry[field]
    return !v || (typeof v === 'string' && !v.trim())
  }

  const emptyBg = (field: keyof JournalEntry) =>
    REQUIRED_FIELDS.includes(field) && isEmpty(field)
      ? 'bg-rose-50'
      : ''

  const bgClass = isSelected
    ? 'bg-amber-50'
    : rowNumber % 2 === 0
      ? 'bg-white'
      : 'bg-gray-50/50'

  return (
    <>
      {isPageBoundary && (
        <tr className="bg-teal-600">
          <td colSpan={9} className="px-3 py-1 text-xs font-bold text-white">
            {pageLabel} ページ
          </td>
        </tr>
      )}
      <tr
        className={`${bgClass} hover:bg-blue-50 cursor-pointer border-b border-slate-200 transition-colors`}
        onClick={onSelect}
        onFocus={onSelect}
      >
        {/* 日付 */}
        <td className="px-2 py-1 border-r border-slate-200">
          <input
            type="text"
            value={entry.date}
            onChange={(e) => onChange(entry.id, 'date', e.target.value)}
            onKeyDown={(e) => handleCellNav(e)}
            placeholder="YYYYMMDD"
            className="w-full px-1 py-0.5 text-sm bg-transparent border-0 outline-none focus:bg-blue-50 focus:ring-1 focus:ring-blue-400 rounded text-slate-800"
          />
        </td>

        {/* 借方科目（CD+科目名セット） */}
        <td className={`px-1 py-1 border-r border-slate-200 ${emptyBg('debitCode')}`}>
          <AccountField
            code={entry.debitCode}
            name={entry.debitName}
            accountMaster={accountMaster}
            onCodeChange={handleDebitCodeChange}
            placeholder="借方"
          />
        </td>

        {/* 貸方科目（CD+科目名セット） */}
        <td className={`px-1 py-1 border-r border-slate-200 ${emptyBg('creditCode')}`}>
          <AccountField
            code={entry.creditCode}
            name={entry.creditName}
            accountMaster={accountMaster}
            onCodeChange={handleCreditCodeChange}
            placeholder="貸方"
          />
        </td>

        {/* 金額 */}
        <td className="px-2 py-1 border-r border-slate-200">
          <input
            type="text"
            inputMode="numeric"
            value={amount ? amount.toLocaleString() : ''}
            onChange={(e) => handleAmountChange(e.target.value)}
            onFocus={(e) => { e.target.value = amount ? String(amount) : '' }}
            onBlur={(e) => { handleAmountChange(e.target.value) }}
            onKeyDown={(e) => handleCellNav(e)}
            placeholder="0"
            className="w-full px-1 py-0.5 text-sm text-right bg-transparent border-0 outline-none focus:bg-blue-50 focus:ring-1 focus:ring-blue-400 rounded font-medium text-slate-800 tabular-nums"
          />
        </td>

        {/* 残高 */}
        <td className="px-2 py-1 border-r border-slate-200 text-right text-sm font-medium text-slate-700 tabular-nums">
          {runningBalance != null ? runningBalance.toLocaleString() : ''}
        </td>

        {/* 消費税CD */}
        <td className={`px-1 py-1 border-r border-slate-200 ${emptyBg('debitTaxCode')}`}>
          <input
            type="text"
            value={entry.debitTaxCode}
            onChange={(e) => onChange(entry.id, 'debitTaxCode', e.target.value)}
            onKeyDown={(e) => handleCellNav(e)}
            placeholder=""
            className="w-full px-1 py-0.5 text-sm bg-transparent border-0 outline-none focus:bg-blue-50 focus:ring-1 focus:ring-blue-400 rounded text-slate-800"
          />
        </td>

        {/* 税区分 */}
        <td className={`px-1 py-1 border-r border-slate-200 ${emptyBg('debitTaxType')}`}>
          <input
            type="text"
            value={entry.debitTaxType}
            onChange={(e) => onChange(entry.id, 'debitTaxType', e.target.value)}
            onKeyDown={(e) => handleCellNav(e)}
            placeholder=""
            className="w-full px-1 py-0.5 text-sm bg-transparent border-0 outline-none focus:bg-blue-50 focus:ring-1 focus:ring-blue-400 rounded text-slate-800"
          />
        </td>

        {/* 摘要 */}
        <td className="px-2 py-1 border-r border-slate-200">
          <input
            type="text"
            value={entry.description}
            onChange={(e) => onChange(entry.id, 'description', e.target.value)}
            onKeyDown={(e) => handleCellNav(e)}
            placeholder="摘要"
            className="w-full px-1 py-0.5 text-sm bg-transparent border-0 outline-none focus:bg-blue-50 focus:ring-1 focus:ring-blue-400 rounded text-slate-800"
          />
        </td>

        {/* 操作 */}
        <td className="px-1 py-1 relative" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>
          {showMenu && (
            <div ref={menuRef} className="absolute right-0 top-full mt-1 w-40 bg-white border border-slate-200 rounded-lg shadow-xl z-20">
              <button onClick={() => { onLearn(); setShowMenu(false) }}
                className="w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-blue-50">パターン学習</button>
              <button onClick={() => { onAddBlank(); setShowMenu(false) }}
                className="w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-blue-50">空白行を追加</button>
              <button onClick={() => { onAddCompound(); setShowMenu(false) }}
                className="w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-blue-50">複合仕訳行を追加</button>
              <hr className="border-slate-100" />
              <button onClick={() => { onDelete(); setShowMenu(false) }}
                className="w-full px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50">削除</button>
            </div>
          )}
        </td>
      </tr>
    </>
  )
}

// 科目フィールド（CD入力→科目名自動表示、セット表示）
function AccountField({
  code,
  name,
  accountMaster,
  onCodeChange,
  placeholder,
}: {
  code: string
  name: string
  accountMaster: AccountItem[]
  onCodeChange: (code: string) => void
  placeholder: string
}) {
  const [showSuggest, setShowSuggest] = useState(false)
  const [inputValue, setInputValue] = useState(code)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => { setInputValue(code) }, [code])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowSuggest(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredItems = accountMaster
    .filter((a) => a.code.includes(inputValue) || a.name.includes(inputValue))
    .slice(0, 10)

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-1">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => { setInputValue(e.target.value); setShowSuggest(true) }}
          onFocus={() => setShowSuggest(true)}
          onBlur={() => { setTimeout(() => { onCodeChange(inputValue); setShowSuggest(false) }, 200) }}
          onKeyDown={(e) => handleCellNav(e)}
          placeholder={placeholder}
          className="w-12 shrink-0 px-1 py-0.5 text-sm text-blue-700 font-medium bg-transparent border-0 outline-none focus:bg-blue-50 focus:ring-1 focus:ring-blue-400 rounded"
        />
        <span className="text-sm text-slate-600 truncate">{name}</span>
      </div>
      {showSuggest && filteredItems.length > 0 && (
        <div className="absolute left-0 top-full mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-xl z-30 max-h-48 overflow-auto">
          {filteredItems.map((item) => (
            <button
              key={item.code}
              onMouseDown={(e) => {
                e.preventDefault()
                setInputValue(item.code)
                onCodeChange(item.code)
                setShowSuggest(false)
              }}
              className="w-full px-3 py-1.5 text-left text-sm hover:bg-blue-50 flex gap-2 items-center"
            >
              <span className="text-blue-700 font-medium w-12 shrink-0">{item.code}</span>
              <span className="text-slate-700">{item.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// 矢印キーナビゲーション
function handleCellNav(e: React.KeyboardEvent<HTMLInputElement>) {
  const el = e.currentTarget
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    e.preventDefault()
    navigateCell(el, e.key === 'ArrowUp' ? 'up' : 'down')
  } else if (e.key === 'ArrowLeft' && el.selectionStart === 0) {
    navigateCell(el, 'left')
  } else if (e.key === 'ArrowRight' && el.selectionStart === el.value.length) {
    navigateCell(el, 'right')
  }
}

function navigateCell(current: HTMLElement, direction: 'up' | 'down' | 'left' | 'right') {
  const td = current.closest('td')
  if (!td) return
  const tr = td.closest('tr')
  if (!tr) return
  const cells = Array.from(tr.querySelectorAll('td'))
  const cellIndex = cells.indexOf(td)

  let targetTd: Element | null = null

  if (direction === 'left') {
    for (let i = cellIndex - 1; i >= 0; i--) {
      if (cells[i].querySelector('input')) { targetTd = cells[i]; break }
    }
  } else if (direction === 'right') {
    for (let i = cellIndex + 1; i < cells.length; i++) {
      if (cells[i].querySelector('input')) { targetTd = cells[i]; break }
    }
  } else {
    const tbody = tr.closest('tbody')
    if (!tbody) return
    const rows = Array.from(tbody.querySelectorAll('tr'))
    const rowIndex = rows.indexOf(tr)
    const targetRow = direction === 'up' ? rows[rowIndex - 1] : rows[rowIndex + 1]
    if (targetRow) {
      const targetCells = Array.from(targetRow.querySelectorAll('td'))
      if (targetCells[cellIndex]) targetTd = targetCells[cellIndex]
    }
  }

  if (targetTd) {
    const input = targetTd.querySelector('input') as HTMLInputElement | null
    if (input) input.focus()
  }
}
