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
  onSelect: () => void
  onChange: (id: string, field: keyof JournalEntry, value: string | number) => void
  onLearn: () => void
  onAddBlank: () => void
  onAddCompound: () => void
  onDelete: () => void
}

// 未入力チェック対象フィールド
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

  const bgClass = isSelected
    ? 'bg-blue-50'
    : entry.isCompound
      ? 'bg-gray-50'
      : 'hover:bg-gray-50'

  const borderClass = isPageBoundary
    ? 'border-t-[3px] border-t-blue-400 border-b border-b-gray-100'
    : 'border-b border-gray-100'

  // 金額は借方金額と貸方金額のうち0でない方を表示
  const amount = entry.debitAmount || entry.creditAmount || 0

  const handleAmountChange = (v: string) => {
    const num = parseInt(v) || 0
    onChange(entry.id, 'debitAmount', num)
    onChange(entry.id, 'creditAmount', num)
  }

  // CDが変更されたら科目名を自動設定
  const handleDebitCodeChange = (code: string) => {
    onChange(entry.id, 'debitCode', code)
    const account = accountMaster.find((a) => a.code === code)
    if (account) {
      onChange(entry.id, 'debitName', account.name)
    }
  }

  const handleCreditCodeChange = (code: string) => {
    onChange(entry.id, 'creditCode', code)
    const account = accountMaster.find((a) => a.code === code)
    if (account) {
      onChange(entry.id, 'creditName', account.name)
    }
  }

  const isEmpty = (field: keyof JournalEntry) => {
    const v = entry[field]
    return !v || (typeof v === 'string' && !v.trim())
  }

  const emptyBg = (field: keyof JournalEntry) =>
    REQUIRED_FIELDS.includes(field) && isEmpty(field)
      ? 'bg-amber-50'
      : ''

  return (
    <>
      {isPageBoundary && (
        <tr className="bg-blue-50">
          <td colSpan={12} className="px-2 py-0.5 text-xs font-bold text-blue-600">
            {pageLabel} ページ
          </td>
        </tr>
      )}
      <tr
        className={`${borderClass} ${bgClass} cursor-pointer`}
        onClick={onSelect}
        onFocus={onSelect}
      >
        {/* 日付 */}
        <td className="px-1 py-0.5">
          <EditableCell
            value={entry.date}
            onChange={(v) => onChange(entry.id, 'date', v)}
            placeholder="YYYYMMDD"
            className="w-24"
          />
        </td>

        {/* 借方CD */}
        <td className={`px-1 py-0.5 ${emptyBg('debitCode')}`}>
          <AccountCodeCell
            value={entry.debitCode}
            accountMaster={accountMaster}
            onChange={handleDebitCodeChange}
          />
        </td>

        {/* 借方科目（自動表示・編集不可） */}
        <td className="px-1 py-0.5">
          <span className="block px-1.5 py-1 text-sm text-gray-700 truncate">
            {entry.debitName || <span className="text-gray-300">-</span>}
          </span>
        </td>

        {/* 貸方CD */}
        <td className={`px-1 py-0.5 ${emptyBg('creditCode')}`}>
          <AccountCodeCell
            value={entry.creditCode}
            accountMaster={accountMaster}
            onChange={handleCreditCodeChange}
          />
        </td>

        {/* 貸方科目（自動表示・編集不可） */}
        <td className="px-1 py-0.5">
          <span className="block px-1.5 py-1 text-sm text-gray-700 truncate">
            {entry.creditName || <span className="text-gray-300">-</span>}
          </span>
        </td>

        {/* 金額 */}
        <td className="px-1 py-0.5">
          <AmountCell
            value={amount}
            onChange={handleAmountChange}
          />
        </td>

        {/* 残高（自動計算） */}
        <td className="px-1 py-0.5">
          <span className="block px-1.5 py-1 text-sm text-right font-medium text-gray-800 tabular-nums">
            {runningBalance != null ? runningBalance.toLocaleString() : ''}
          </span>
        </td>

        {/* 消費税CD */}
        <td className={`px-1 py-0.5 ${emptyBg('debitTaxCode')}`}>
          <EditableCell
            value={entry.debitTaxCode}
            onChange={(v) => onChange(entry.id, 'debitTaxCode', v)}
            placeholder=""
            className="w-14"
          />
        </td>

        {/* 税区分 */}
        <td className={`px-1 py-0.5 ${emptyBg('debitTaxType')}`}>
          <EditableCell
            value={entry.debitTaxType}
            onChange={(v) => onChange(entry.id, 'debitTaxType', v)}
            placeholder=""
          />
        </td>

        {/* 事業者区分 */}
        <td className={`px-1 py-0.5 ${emptyBg('debitBusinessType')}`}>
          <EditableCell
            value={entry.debitBusinessType}
            onChange={(v) => onChange(entry.id, 'debitBusinessType', v)}
            placeholder=""
          />
        </td>

        {/* 摘要 */}
        <td className="px-1 py-0.5">
          <EditableCell
            value={entry.description}
            onChange={(v) => onChange(entry.id, 'description', v)}
            placeholder="摘要"
          />
        </td>

        {/* 操作 */}
        <td className="px-1 py-0.5 relative" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="px-2 py-0.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded"
          >
            ...
          </button>
          {showMenu && (
            <div
              ref={menuRef}
              className="absolute right-0 top-full mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-20"
            >
              <button
                onClick={() => { onLearn(); setShowMenu(false) }}
                className="w-full px-3 py-2 text-left text-xs hover:bg-gray-50"
              >
                パターン学習
              </button>
              <button
                onClick={() => { onAddBlank(); setShowMenu(false) }}
                className="w-full px-3 py-2 text-left text-xs hover:bg-gray-50"
              >
                空白行を追加
              </button>
              <button
                onClick={() => { onAddCompound(); setShowMenu(false) }}
                className="w-full px-3 py-2 text-left text-xs hover:bg-gray-50"
              >
                複合仕訳行を追加
              </button>
              <hr className="border-gray-100" />
              <button
                onClick={() => { onDelete(); setShowMenu(false) }}
                className="w-full px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50"
              >
                削除
              </button>
            </div>
          )}
        </td>
      </tr>
    </>
  )
}

// インライン編集セル
function EditableCell({
  value,
  onChange,
  placeholder,
  className = '',
  type = 'text',
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  type?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full px-1.5 py-1 text-sm border border-transparent hover:border-gray-300 focus:border-blue-400 focus:outline-none focus:bg-blue-50 rounded bg-transparent text-gray-800 ${className}`}
    />
  )
}

// 科目コード入力セル（サジェスト付き）
function AccountCodeCell({
  value,
  accountMaster,
  onChange,
}: {
  value: string
  accountMaster: AccountItem[]
  onChange: (code: string) => void
}) {
  const [showSuggest, setShowSuggest] = useState(false)
  const [inputValue, setInputValue] = useState(value)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setInputValue(value)
  }, [value])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShowSuggest(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredItems = accountMaster
    .filter(
      (a) =>
        a.code.includes(inputValue) ||
        a.name.includes(inputValue),
    )
    .slice(0, 10)

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value)
          setShowSuggest(true)
        }}
        onFocus={() => setShowSuggest(true)}
        onBlur={() => {
          setTimeout(() => {
            onChange(inputValue)
            setShowSuggest(false)
          }, 200)
        }}
        placeholder="CD"
        className="w-full px-1.5 py-1 text-sm border border-transparent hover:border-gray-300 focus:border-blue-400 focus:outline-none focus:bg-blue-50 rounded bg-transparent text-gray-800"
      />
      {showSuggest && filteredItems.length > 0 && (
        <div className="absolute left-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded shadow-lg z-30 max-h-40 overflow-auto">
          {filteredItems.map((item) => (
            <button
              key={item.code}
              onMouseDown={(e) => {
                e.preventDefault()
                setInputValue(item.code)
                onChange(item.code)
                setShowSuggest(false)
              }}
              className="w-full px-2 py-1.5 text-left text-sm hover:bg-blue-50 flex gap-2"
            >
              <span className="text-gray-500 w-12 shrink-0">{item.code}</span>
              <span className="text-gray-800">{item.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// 金額入力セル（#,###形式表示、フォーカス時に数値編集）
function AmountCell({
  value,
  onChange,
}: {
  value: number
  onChange: (v: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')

  const handleFocus = () => {
    setEditing(true)
    setEditValue(value ? String(value) : '')
  }

  const handleBlur = () => {
    setEditing(false)
    onChange(editValue)
  }

  if (editing) {
    return (
      <input
        type="number"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleBlur}
        autoFocus
        className="w-full px-1.5 py-1 text-sm text-right border border-blue-400 outline-none bg-blue-50 rounded font-medium"
      />
    )
  }

  return (
    <div
      onClick={(e) => { e.stopPropagation(); handleFocus() }}
      onFocus={handleFocus}
      tabIndex={0}
      className="w-full px-1.5 py-1 text-sm text-right cursor-text border border-transparent hover:border-gray-300 rounded font-medium text-gray-800 tabular-nums"
    >
      {value ? value.toLocaleString() : ''}
    </div>
  )
}
