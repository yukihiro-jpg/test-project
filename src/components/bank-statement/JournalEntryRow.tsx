'use client'

import { useState, useRef, useEffect } from 'react'
import type { JournalEntry, AccountItem } from '@/lib/bank-statement/types'

interface Props {
  entry: JournalEntry
  isSelected: boolean
  accountMaster: AccountItem[]
  isPageBoundary?: boolean
  pageLabel?: string
  onSelect: () => void
  onChange: (id: string, field: keyof JournalEntry, value: string | number) => void
  onLearn: () => void
  onAddBlank: () => void
  onAddCompound: () => void
  onDelete: () => void
}

export default function JournalEntryRow({
  entry,
  isSelected,
  accountMaster,
  isPageBoundary,
  pageLabel,
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
      <td className="px-2 py-1">
        <EditableCell
          value={entry.date}
          onChange={(v) => onChange(entry.id, 'date', v)}
          placeholder="YYYYMMDD"
          className="w-20"
        />
      </td>
      <td className="px-2 py-1">
        <AccountCodeCell
          value={entry.debitCode}
          accountMaster={accountMaster}
          onChange={(code) => onChange(entry.id, 'debitCode', code)}
        />
      </td>
      <td className="px-2 py-1">
        <EditableCell
          value={entry.debitName}
          onChange={(v) => onChange(entry.id, 'debitName', v)}
          placeholder="借方科目"
        />
      </td>
      <td className="px-2 py-1">
        <EditableCell
          value={entry.debitAmount ? String(entry.debitAmount) : ''}
          onChange={(v) => onChange(entry.id, 'debitAmount', parseInt(v) || 0)}
          placeholder="0"
          className="text-right"
          type="number"
        />
      </td>
      <td className="px-2 py-1">
        <AccountCodeCell
          value={entry.creditCode}
          accountMaster={accountMaster}
          onChange={(code) => onChange(entry.id, 'creditCode', code)}
        />
      </td>
      <td className="px-2 py-1">
        <EditableCell
          value={entry.creditName}
          onChange={(v) => onChange(entry.id, 'creditName', v)}
          placeholder="貸方科目"
        />
      </td>
      <td className="px-2 py-1">
        <EditableCell
          value={entry.creditAmount ? String(entry.creditAmount) : ''}
          onChange={(v) => onChange(entry.id, 'creditAmount', parseInt(v) || 0)}
          placeholder="0"
          className="text-right"
          type="number"
        />
      </td>
      <td className="px-2 py-1">
        <EditableCell
          value={entry.debitTaxCode}
          onChange={(v) => onChange(entry.id, 'debitTaxCode', v)}
          placeholder=""
          className="w-14"
        />
      </td>
      <td className="px-2 py-1">
        <EditableCell
          value={entry.debitTaxType}
          onChange={(v) => onChange(entry.id, 'debitTaxType', v)}
          placeholder=""
        />
      </td>
      <td className="px-2 py-1">
        <EditableCell
          value={entry.debitBusinessType}
          onChange={(v) => onChange(entry.id, 'debitBusinessType', v)}
          placeholder=""
        />
      </td>
      <td className="px-2 py-1">
        <EditableCell
          value={entry.description}
          onChange={(v) => onChange(entry.id, 'description', v)}
          placeholder="摘要"
        />
      </td>
      <td className="px-2 py-1 relative" onClick={(e) => e.stopPropagation()}>
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
          // 少し遅延させてクリックイベントを先に処理
          setTimeout(() => {
            onChange(inputValue)
            setShowSuggest(false)
          }, 200)
        }}
        placeholder="CD"
        className="w-full px-1.5 py-1 text-sm border border-transparent hover:border-gray-300 focus:border-blue-400 focus:outline-none focus:bg-blue-50 rounded bg-transparent text-gray-800"
      />
      {showSuggest && filteredItems.length > 0 && (
        <div className="absolute left-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded shadow-lg z-30 max-h-40 overflow-auto">
          {filteredItems.map((item) => (
            <button
              key={item.code}
              onMouseDown={(e) => {
                e.preventDefault()
                setInputValue(item.code)
                onChange(item.code)
                setShowSuggest(false)
              }}
              className="w-full px-2 py-1 text-left text-xs hover:bg-blue-50 flex gap-1"
            >
              <span className="text-gray-500 w-10 shrink-0">{item.code}</span>
              <span>{item.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
