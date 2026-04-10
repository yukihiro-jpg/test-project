'use client'

import { useState, useRef, useEffect } from 'react'
import type { JournalEntry, AccountItem, SubAccountItem } from '@/lib/bank-statement/types'

interface Props {
  entry: JournalEntry
  isSelected: boolean
  accountMaster: AccountItem[]
  subAccountMaster: SubAccountItem[]
  isPageBoundary?: boolean
  pageLabel?: string
  runningBalance?: number
  rowNumber: number
  isCompoundGroup?: boolean // 複合仕訳グループの一部か
  isCompoundLast?: boolean // 複合仕訳グループの最終行か（997自動計算）
  compoundAutoAmount?: number // 997の自動計算金額
  onSelect: (e?: React.MouseEvent) => void
  onChange: (id: string, field: keyof JournalEntry, value: string | number) => void
  onAddCompound: () => void
  onDelete: () => void
  onLearn: () => void
  onAddBlank: () => void
  onSubAccountRegister: (parentCode: string, subCode: string, name: string) => void
}

const REQUIRED_FIELDS: (keyof JournalEntry)[] = [
  'debitCode', 'creditCode', 'debitTaxCode', 'debitTaxType',
]

export default function JournalEntryRow({
  entry,
  isSelected,
  accountMaster,
  subAccountMaster,
  isPageBoundary,
  pageLabel,
  runningBalance,
  rowNumber,
  isCompoundGroup,
  isCompoundLast,
  compoundAutoAmount,
  onSelect,
  onChange,
  onAddCompound,
  onDelete,
  onLearn,
  onAddBlank,
  onSubAccountRegister,
}: Props) {
  const amount = entry.debitAmount || entry.creditAmount || 0

  const handleAmountChange = (v: string) => {
    const num = parseInt(v.replace(/[^0-9]/g, '')) || 0
    onChange(entry.id, 'debitAmount', num)
    onChange(entry.id, 'creditAmount', num)
  }

  const handleDebitCodeChange = (code: string) => {
    onChange(entry.id, 'debitCode', code)
    const account = accountMaster.find((a) => a.code === code)
    if (account) onChange(entry.id, 'debitName', account.shortName || account.name)
  }

  const handleCreditCodeChange = (code: string) => {
    onChange(entry.id, 'creditCode', code)
    const account = accountMaster.find((a) => a.code === code)
    if (account) onChange(entry.id, 'creditName', account.shortName || account.name)
  }

  const isEmpty = (field: keyof JournalEntry) => {
    const v = entry[field]
    return !v || (typeof v === 'string' && !v.trim())
  }

  const emptyBg = (field: keyof JournalEntry) =>
    REQUIRED_FIELDS.includes(field) && isEmpty(field) ? 'bg-rose-50' : ''

  // 複合仕訳最終行は997の差額を自動設定
  const displayAmount = isCompoundLast && compoundAutoAmount != null ? compoundAutoAmount : amount

  const bgClass = isSelected
    ? 'bg-blue-200'
    : isCompoundGroup
      ? rowNumber % 2 === 0 ? 'bg-indigo-50' : 'bg-indigo-50/50'
      : rowNumber % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'

  const compoundBar = isCompoundGroup ? 'border-l-4 border-l-indigo-400' : ''

  return (
    <>
      {isPageBoundary && (
        <tr className="bg-teal-600">
          <td colSpan={10} className="px-3 py-1 text-xs font-bold text-white">
            {pageLabel} ページ
          </td>
        </tr>
      )}
      <tr
        className={`${bgClass} ${compoundBar} hover:bg-blue-50 cursor-pointer border-b border-gray-200 transition-colors`}
        onClick={(e) => onSelect(e)}
        onFocus={() => onSelect()}
      >
        {/* 日付 */}
        <td className="px-2 py-1 border-r border-gray-200">
          <input type="text" value={entry.date}
            onChange={(e) => onChange(entry.id, 'date', e.target.value)}
            onKeyDown={handleCellNav} placeholder="YYYYMMDD"
            className="w-full px-1 py-0.5 text-sm bg-transparent border-0 outline-none focus:bg-blue-50 focus:ring-1 focus:ring-blue-400 rounded text-gray-800" />
        </td>

        {/* 借方科目 */}
        <td className={`px-1 py-1 border-r border-gray-200 ${emptyBg('debitCode')}`}>
          <AccountField code={entry.debitCode} name={entry.debitName}
            subCode={entry.debitSubCode} subName={entry.debitSubName}
            accountMaster={accountMaster} subAccountMaster={subAccountMaster}
            onCodeChange={handleDebitCodeChange}
            onSubCodeChange={(sc, sn) => { onChange(entry.id, 'debitSubCode', sc); onChange(entry.id, 'debitSubName', sn) }}
            onSubAccountRegister={onSubAccountRegister}
            placeholder="借方" />
        </td>

        {/* 貸方科目 */}
        <td className={`px-1 py-1 border-r border-gray-200 ${emptyBg('creditCode')}`}>
          <AccountField code={entry.creditCode} name={entry.creditName}
            subCode={entry.creditSubCode} subName={entry.creditSubName}
            accountMaster={accountMaster} subAccountMaster={subAccountMaster}
            onCodeChange={handleCreditCodeChange}
            onSubCodeChange={(sc, sn) => { onChange(entry.id, 'creditSubCode', sc); onChange(entry.id, 'creditSubName', sn) }}
            onSubAccountRegister={onSubAccountRegister}
            placeholder="貸方" />
        </td>

        {/* 金額 */}
        <td className="px-2 py-1 border-r border-gray-200">
          {isCompoundLast && compoundAutoAmount != null ? (
            <span className="block px-1 py-0.5 text-sm text-right font-medium text-indigo-700 tabular-nums">
              {displayAmount.toLocaleString()}
            </span>
          ) : (
            <input type="text" inputMode="numeric"
              value={amount ? amount.toLocaleString() : ''}
              onChange={(e) => handleAmountChange(e.target.value)}
              onFocus={(e) => { e.target.value = amount ? String(amount) : '' }}
              onBlur={(e) => handleAmountChange(e.target.value)}
              onKeyDown={handleCellNav} placeholder="0"
              className="w-full px-1 py-0.5 text-sm text-right bg-transparent border-0 outline-none focus:bg-blue-50 focus:ring-1 focus:ring-blue-400 rounded font-medium text-gray-800 tabular-nums" />
          )}
        </td>

        {/* 残高 */}
        <td className="px-2 py-1 border-r border-gray-200 text-right text-sm font-medium text-gray-700 tabular-nums">
          {runningBalance != null ? runningBalance.toLocaleString() : ''}
        </td>

        {/* 消費税CD */}
        <td className={`px-1 py-1 border-r border-gray-200 ${emptyBg('debitTaxCode')}`}>
          <input type="text" value={entry.debitTaxCode}
            onChange={(e) => onChange(entry.id, 'debitTaxCode', e.target.value)}
            onKeyDown={handleCellNav}
            className="w-full px-1 py-0.5 text-sm bg-transparent border-0 outline-none focus:bg-blue-50 focus:ring-1 focus:ring-blue-400 rounded text-gray-800" />
        </td>

        {/* 税区分 */}
        <td className={`px-1 py-1 border-r border-gray-200 ${emptyBg('debitTaxType')}`}>
          <input type="text" value={entry.debitTaxType}
            onChange={(e) => onChange(entry.id, 'debitTaxType', e.target.value)}
            onKeyDown={handleCellNav}
            className="w-full px-1 py-0.5 text-sm bg-transparent border-0 outline-none focus:bg-blue-50 focus:ring-1 focus:ring-blue-400 rounded text-gray-800" />
        </td>

        {/* 摘要 */}
        <td className="px-2 py-1 border-r border-gray-200">
          <input type="text" value={entry.description}
            onChange={(e) => onChange(entry.id, 'description', e.target.value)}
            onKeyDown={handleCellNav} placeholder="摘要"
            className="w-full px-1 py-0.5 text-sm bg-transparent border-0 outline-none focus:bg-blue-50 focus:ring-1 focus:ring-blue-400 rounded text-gray-800" />
        </td>

        {/* 操作 */}
        <td className="px-1 py-1" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-0.5">
            <button onClick={onAddCompound} title="複合仕訳行を追加"
              className="w-6 h-6 flex items-center justify-center text-xs text-indigo-500 hover:bg-indigo-50 rounded font-bold">
              +
            </button>
            <RowMenu onLearn={onLearn} onAddBlank={onAddBlank} onDelete={onDelete} />
          </div>
        </td>
      </tr>
    </>
  )
}

// 操作メニュー
function RowMenu({ onLearn, onAddBlank, onDelete }: { onLearn: () => void; onAddBlank: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-gray-200 rounded-lg shadow-xl z-20">
          <button onClick={() => { onLearn(); setOpen(false) }} className="w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50">パターン学習</button>
          <button onClick={() => { onAddBlank(); setOpen(false) }} className="w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50">空白行を追加</button>
          <hr className="border-gray-100" />
          <button onClick={() => { onDelete(); setOpen(false) }} className="w-full px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50">削除</button>
        </div>
      )}
    </div>
  )
}

// 科目フィールド（CD+科目名+補助科目）
function AccountField({
  code, name, subCode, subName, accountMaster, subAccountMaster,
  onCodeChange, onSubCodeChange, onSubAccountRegister, placeholder,
}: {
  code: string; name: string; subCode?: string; subName?: string
  accountMaster: AccountItem[]; subAccountMaster: SubAccountItem[]
  onCodeChange: (code: string) => void
  onSubCodeChange: (code: string, name: string) => void
  onSubAccountRegister: (parentCode: string, subCode: string, name: string) => void
  placeholder: string
}) {
  const [showSuggest, setShowSuggest] = useState(false)
  const [showSubSuggest, setShowSubSuggest] = useState(false)
  const [inputValue, setInputValue] = useState(code)
  const [subInputValue, setSubInputValue] = useState(subCode || '')
  const [showNewSub, setShowNewSub] = useState(false)
  const [newSubCode, setNewSubCode] = useState('')
  const [newSubName, setNewSubName] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => { setInputValue(code) }, [code])
  useEffect(() => { setSubInputValue(subCode || '') }, [subCode])

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShowSuggest(false); setShowSubSuggest(false); setShowNewSub(false)
      }
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const filteredAccounts = accountMaster
    .filter((a) => a.code.includes(inputValue) || a.name.includes(inputValue) ||
      a.shortName.includes(inputValue) || (a.association || '').includes(inputValue))
    .slice(0, 12)

  const subAccounts = subAccountMaster.filter((s) => s.parentCode === code)
  const hasSubAccounts = subAccounts.length > 0

  const handleCodeConfirm = (c: string) => {
    onCodeChange(c)
    setShowSuggest(false)
    // 補助科目がある場合は補助科目選択を表示
    const subs = subAccountMaster.filter((s) => s.parentCode === c)
    if (subs.length > 0) setShowSubSuggest(true)
  }

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-0.5">
        <input type="text" value={inputValue}
          onChange={(e) => { setInputValue(e.target.value); setShowSuggest(true) }}
          onFocus={() => setShowSuggest(true)}
          onBlur={() => setTimeout(() => { if (!showSuggest) onCodeChange(inputValue) }, 300)}
          onKeyDown={handleCellNav}
          placeholder={placeholder}
          className="w-12 shrink-0 px-1 py-0.5 text-sm text-blue-700 font-medium bg-transparent border-0 outline-none focus:bg-blue-50 focus:ring-1 focus:ring-blue-400 rounded" />
        <span className="text-sm text-gray-600 truncate flex-1">{name}</span>
        {hasSubAccounts && subName && (
          <span className="text-xs text-gray-400 truncate">[{subName}]</span>
        )}
      </div>

      {/* 科目サジェスト */}
      {showSuggest && filteredAccounts.length > 0 && (
        <div className="absolute left-0 top-full mt-1 w-64 bg-white border border-gray-300 rounded-lg shadow-xl z-30 max-h-56 overflow-auto">
          {filteredAccounts.map((item) => (
            <button key={item.code}
              onMouseDown={(e) => { e.preventDefault(); setInputValue(item.code); handleCodeConfirm(item.code) }}
              className="w-full px-3 py-1.5 text-left text-sm hover:bg-blue-50 flex gap-2">
              <span className="text-blue-700 font-medium w-10 shrink-0">{item.code}</span>
              <span className="text-gray-700">{item.shortName || item.name}</span>
            </button>
          ))}
          <button onMouseDown={(e) => { e.preventDefault(); setShowSuggest(false); setShowNewSub(true) }}
            className="w-full px-3 py-2 text-left text-xs text-blue-600 hover:bg-blue-50 border-t border-gray-100 font-medium">
            + 新しく補助科目を登録する
          </button>
        </div>
      )}

      {/* 補助科目サジェスト */}
      {showSubSuggest && subAccounts.length > 0 && (
        <div className="absolute left-0 top-full mt-1 w-56 bg-white border border-gray-300 rounded-lg shadow-xl z-30 max-h-48 overflow-auto">
          <div className="px-3 py-1 text-xs text-gray-500 border-b border-gray-100">補助科目を選択</div>
          {subAccounts.map((s) => (
            <button key={s.subCode}
              onMouseDown={(e) => { e.preventDefault(); setSubInputValue(s.subCode); onSubCodeChange(s.subCode, s.shortName || s.name); setShowSubSuggest(false) }}
              className="w-full px-3 py-1.5 text-left text-sm hover:bg-blue-50 flex gap-2">
              <span className="text-blue-700 font-medium w-8 shrink-0">{s.subCode}</span>
              <span className="text-gray-700">{s.shortName || s.name}</span>
            </button>
          ))}
          <button onMouseDown={(e) => { e.preventDefault(); setShowSubSuggest(false); setShowNewSub(true) }}
            className="w-full px-3 py-2 text-left text-xs text-blue-600 hover:bg-blue-50 border-t border-gray-100 font-medium">
            + 新しく補助科目を登録する
          </button>
        </div>
      )}

      {/* 補助科目新規登録 */}
      {showNewSub && (
        <div className="absolute left-0 top-full mt-1 w-64 bg-white border border-gray-300 rounded-lg shadow-xl z-30 p-3">
          <div className="text-xs font-medium text-gray-700 mb-2">補助科目を登録 (科目: {code})</div>
          <div className="space-y-2">
            <input type="text" value={newSubCode} onChange={(e) => setNewSubCode(e.target.value)}
              placeholder="補助コード" className="w-full px-2 py-1 text-sm border border-gray-300 rounded" />
            <input type="text" value={newSubName} onChange={(e) => setNewSubName(e.target.value)}
              placeholder="補助科目名" className="w-full px-2 py-1 text-sm border border-gray-300 rounded" />
            <div className="flex gap-2">
              <button onClick={() => setShowNewSub(false)}
                className="flex-1 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200">キャンセル</button>
              <button onClick={() => {
                if (code && newSubCode && newSubName) {
                  onSubAccountRegister(code, newSubCode, newSubName)
                  onSubCodeChange(newSubCode, newSubName)
                  setShowNewSub(false); setNewSubCode(''); setNewSubName('')
                }
              }} className="flex-1 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">登録</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function handleCellNav(e: React.KeyboardEvent<HTMLInputElement>) {
  const el = e.currentTarget
  if (e.key === 'Enter') {
    e.preventDefault()
    if (!navigateCell(el, 'right')) navigateCell(el, 'next-row')
  } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    e.preventDefault()
    navigateCell(el, e.key === 'ArrowUp' ? 'up' : 'down')
  } else if (e.key === 'ArrowLeft' && el.selectionStart === 0) {
    navigateCell(el, 'left')
  } else if (e.key === 'ArrowRight' && el.selectionStart === el.value.length) {
    navigateCell(el, 'right')
  }
}

function navigateCell(current: HTMLElement, direction: 'up' | 'down' | 'left' | 'right' | 'next-row'): boolean {
  const td = current.closest('td')
  if (!td) return false
  const tr = td.closest('tr')
  if (!tr) return false
  const cells = Array.from(tr.querySelectorAll('td'))
  const cellIndex = cells.indexOf(td)
  let targetTd: Element | null = null

  if (direction === 'left') {
    for (let i = cellIndex - 1; i >= 0; i--) { if (cells[i].querySelector('input')) { targetTd = cells[i]; break } }
  } else if (direction === 'right') {
    for (let i = cellIndex + 1; i < cells.length; i++) { if (cells[i].querySelector('input')) { targetTd = cells[i]; break } }
  } else if (direction === 'next-row') {
    const tbody = tr.closest('tbody')
    if (!tbody) return false
    const rows = Array.from(tbody.querySelectorAll('tr'))
    const ri = rows.indexOf(tr)
    const next = rows[ri + 1]
    if (next) for (const c of Array.from(next.querySelectorAll('td'))) { if (c.querySelector('input')) { targetTd = c; break } }
  } else {
    const tbody = tr.closest('tbody')
    if (!tbody) return false
    const rows = Array.from(tbody.querySelectorAll('tr'))
    const ri = rows.indexOf(tr)
    const target = direction === 'up' ? rows[ri - 1] : rows[ri + 1]
    if (target) { const tc = Array.from(target.querySelectorAll('td')); if (tc[cellIndex]) targetTd = tc[cellIndex] }
  }

  if (targetTd) { const input = targetTd.querySelector('input') as HTMLInputElement | null; if (input) { input.focus(); return true } }
  return false
}
