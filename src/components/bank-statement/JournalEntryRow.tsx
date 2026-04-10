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
  isCompoundGroup?: boolean
  isCompoundFirst?: boolean // 複合仕訳グループの最初の行
  isCompoundLast?: boolean
  compoundAutoAmount?: number
  onSelect: (e?: React.MouseEvent) => void
  onChange: (id: string, field: keyof JournalEntry, value: string | number) => void
  onAddCompound: () => void
  onDelete: () => void
  onLearn: () => void
  onAddBlank: () => void
  onSubAccountRegister: (parentCode: string, subCode: string, name: string) => void
}

const REQUIRED_FIELDS: (keyof JournalEntry)[] = ['debitCode', 'creditCode', 'debitTaxCode', 'debitTaxType']

export default function JournalEntryRow({
  entry, isSelected, accountMaster, subAccountMaster,
  isPageBoundary, pageLabel, runningBalance, rowNumber,
  isCompoundGroup, isCompoundFirst, isCompoundLast, compoundAutoAmount,
  onSelect, onChange, onAddCompound, onDelete, onLearn, onAddBlank, onSubAccountRegister,
}: Props) {
  const amount = entry.debitAmount || entry.creditAmount || 0
  const displayAmount = compoundAutoAmount != null && compoundAutoAmount !== 0 ? compoundAutoAmount : amount

  const handleAmountChange = (v: string) => {
    const num = parseInt(v.replace(/[^0-9]/g, '')) || 0
    onChange(entry.id, 'debitAmount', num)
    onChange(entry.id, 'creditAmount', num)
  }

  const handleDebitCodeChange = (code: string) => {
    onChange(entry.id, 'debitCode', code)
    const acc = accountMaster.find((a) => a.code === code)
    if (acc) onChange(entry.id, 'debitName', acc.shortName || acc.name)
  }

  const handleCreditCodeChange = (code: string) => {
    onChange(entry.id, 'creditCode', code)
    const acc = accountMaster.find((a) => a.code === code)
    if (acc) onChange(entry.id, 'creditName', acc.shortName || acc.name)
  }

  const isEmpty = (f: keyof JournalEntry) => { const v = entry[f]; return !v || (typeof v === 'string' && !v.trim()) }
  const emptyBg = (f: keyof JournalEntry) => REQUIRED_FIELDS.includes(f) && isEmpty(f) ? 'bg-rose-50' : ''

  // 行の背景色
  let bgClass: string
  if (isSelected) {
    bgClass = 'bg-sky-100'
  } else if (isCompoundGroup) {
    bgClass = 'bg-violet-50'
  } else {
    bgClass = rowNumber % 2 === 0 ? 'bg-white' : 'bg-gray-50'
  }

  return (
    <>
      {isPageBoundary && (
        <tr className="bg-teal-600">
          <td colSpan={10} className="px-3 py-1 text-xs font-bold text-white">{pageLabel} ページ</td>
        </tr>
      )}
      {/* 複合仕訳の開始ヘッダー */}
      {isCompoundFirst && (
        <tr>
          <td colSpan={10} className="px-3 py-0.5 text-xs font-bold text-red-600 bg-red-50 border-t-2 border-l-2 border-r-2 border-red-400">
            複合仕訳
          </td>
        </tr>
      )}
      <tr
        className={`${bgClass} hover:bg-sky-50 cursor-pointer transition-colors`}
        style={{
          borderBottom: isCompoundLast ? '2px solid #f87171' : '1px solid #cbd5e1',
          borderLeft: isCompoundGroup ? '2px solid #f87171' : undefined,
          borderRight: isCompoundGroup ? '2px solid #f87171' : undefined,
        }}
        onClick={(e) => onSelect(e)}
        onFocus={() => onSelect()}
      >
        {/* 日付 */}
        <td style={cellBorder}>
          <CellInput value={entry.date} onChange={(v) => onChange(entry.id, 'date', v)} placeholder="YYYYMMDD" />
        </td>

        {/* 借方科目 */}
        <td style={cellBorder} className={emptyBg('debitCode')}>
          <AccountField code={entry.debitCode} name={entry.debitName}
            subCode={entry.debitSubCode} subName={entry.debitSubName}
            accountMaster={accountMaster} subAccountMaster={subAccountMaster}
            onCodeChange={handleDebitCodeChange}
            onSubCodeChange={(sc, sn) => { onChange(entry.id, 'debitSubCode', sc); onChange(entry.id, 'debitSubName', sn) }}
            onSubAccountRegister={onSubAccountRegister} />
        </td>

        {/* 貸方科目 */}
        <td style={cellBorder} className={emptyBg('creditCode')}>
          <AccountField code={entry.creditCode} name={entry.creditName}
            subCode={entry.creditSubCode} subName={entry.creditSubName}
            accountMaster={accountMaster} subAccountMaster={subAccountMaster}
            onCodeChange={handleCreditCodeChange}
            onSubCodeChange={(sc, sn) => { onChange(entry.id, 'creditSubCode', sc); onChange(entry.id, 'creditSubName', sn) }}
            onSubAccountRegister={onSubAccountRegister} />
        </td>

        {/* 金額 */}
        <td style={cellBorder}>
          {compoundAutoAmount != null && compoundAutoAmount !== 0 ? (
            <span className="block px-2 py-1 text-sm text-right font-bold text-violet-700 tabular-nums">
              {displayAmount.toLocaleString()}
            </span>
          ) : (
            <AmountInput value={amount} onChange={handleAmountChange} />
          )}
        </td>

        {/* 残高 */}
        <td style={cellBorder} className="text-right px-2 py-1">
          <span className="text-sm font-medium text-gray-700 tabular-nums">
            {runningBalance != null ? runningBalance.toLocaleString() : ''}
          </span>
        </td>

        {/* 税CD */}
        <td style={cellBorder} className={emptyBg('debitTaxCode')}>
          <CellInput value={entry.debitTaxCode} onChange={(v) => onChange(entry.id, 'debitTaxCode', v)} halfWidth />
        </td>

        {/* 税区分 */}
        <td style={cellBorder} className={emptyBg('debitTaxType')}>
          <CellInput value={entry.debitTaxType} onChange={(v) => onChange(entry.id, 'debitTaxType', v)} />
        </td>

        {/* 摘要 */}
        <td style={cellBorder}>
          <CellInput value={entry.description} onChange={(v) => onChange(entry.id, 'description', v)} placeholder="摘要" />
        </td>

        {/* 操作 */}
        <td className="px-1 py-1" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-0.5">
            <button onClick={onAddCompound} title="複合仕訳行を追加"
              className="w-6 h-6 flex items-center justify-center text-xs text-violet-600 hover:bg-violet-100 rounded font-bold border border-violet-200">+</button>
            <RowMenu onLearn={onLearn} onAddBlank={onAddBlank} onDelete={onDelete} />
          </div>
        </td>
      </tr>
    </>
  )
}

const cellBorder: React.CSSProperties = { borderRight: '1px solid #94a3b8', padding: '2px 4px' }

// 全角→半角変換
function toHalfWidth(str: string): string {
  return str.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
    .replace(/[Ａ-Ｚａ-ｚ]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
}

// 汎用セル入力
function CellInput({ value, onChange, placeholder, align, onFocus, onBlur, halfWidth }: {
  value: string; onChange: (v: string) => void; placeholder?: string; align?: string
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void
  halfWidth?: boolean
}) {
  return (
    <input type="text" value={value}
      onChange={(e) => onChange(halfWidth ? toHalfWidth(e.target.value) : e.target.value)}
      onFocus={onFocus} onBlur={onBlur}
      onKeyDown={handleCellNav} placeholder={placeholder}
      inputMode={halfWidth ? 'numeric' : undefined}
      style={halfWidth ? { imeMode: 'disabled' } as React.CSSProperties : undefined}
      className={`w-full px-1.5 py-1 text-sm bg-transparent border-0 outline-none focus:bg-blue-50 focus:ring-1 focus:ring-blue-400 rounded text-gray-800 ${align === 'right' ? 'text-right font-medium tabular-nums' : ''}`} />
  )
}

// 科目フィールド
function AccountField({
  code, name, subCode, subName, accountMaster, subAccountMaster,
  onCodeChange, onSubCodeChange, onSubAccountRegister,
}: {
  code: string; name: string; subCode?: string; subName?: string
  accountMaster: AccountItem[]; subAccountMaster: SubAccountItem[]
  onCodeChange: (code: string) => void
  onSubCodeChange: (code: string, name: string) => void
  onSubAccountRegister: (parentCode: string, subCode: string, name: string) => void
}) {
  const [showSuggest, setShowSuggest] = useState(false)
  const [showSubSuggest, setShowSubSuggest] = useState(false)
  const [inputValue, setInputValue] = useState(code)
  const [showNewSub, setShowNewSub] = useState(false)
  const [newSubCode, setNewSubCode] = useState('')
  const [newSubName, setNewSubName] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setInputValue(code) }, [code])
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setShowSuggest(false); setShowSubSuggest(false); setShowNewSub(false) }
    }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])

  const filtered = accountMaster
    .filter((a) => a.code.includes(inputValue) || a.name.includes(inputValue) || a.shortName.includes(inputValue) || (a.association || '').includes(inputValue))
    .slice(0, 12)

  const subAccounts = subAccountMaster.filter((s) => s.parentCode === code)

  const handleConfirm = (c: string) => {
    onCodeChange(c); setShowSuggest(false)
    if (subAccountMaster.filter((s) => s.parentCode === c).length > 0) setShowSubSuggest(true)
  }

  // セル全体をクリックしたらinputにフォーカス
  const handleCellClick = () => { inputRef.current?.focus() }

  return (
    <div ref={ref} className="relative cursor-text" onClick={handleCellClick}>
      <div className="flex items-center gap-1 min-h-[28px]">
        <input ref={inputRef} type="text" inputMode="numeric" value={inputValue}
          onChange={(e) => { const v = toHalfWidth(e.target.value); setInputValue(v); setShowSuggest(true) }}
          onFocus={() => setShowSuggest(true)}
          onBlur={() => setTimeout(() => { if (!showSuggest) onCodeChange(inputValue) }, 300)}
          onKeyDown={handleCellNav}
          style={{ imeMode: 'disabled' } as React.CSSProperties}
          className="w-12 shrink-0 px-1 py-0.5 text-sm text-blue-700 font-bold bg-transparent border-0 outline-none focus:bg-blue-50 focus:ring-1 focus:ring-blue-400 rounded" />
        <span className="text-sm text-gray-800 font-semibold truncate flex-1">{name}</span>
        {subName && <span className="text-xs text-gray-500 truncate">[{subName}]</span>}
      </div>

      {showSuggest && filtered.length > 0 && (
        <div className="absolute left-0 top-full mt-1 w-64 bg-white border border-gray-300 rounded-lg shadow-xl z-30 max-h-56 overflow-auto">
          {filtered.map((item) => (
            <button key={item.code}
              onMouseDown={(e) => { e.preventDefault(); setInputValue(item.code); handleConfirm(item.code) }}
              className="w-full px-3 py-1.5 text-left text-sm hover:bg-blue-50 flex gap-2">
              <span className="text-blue-700 font-bold w-10 shrink-0">{item.code}</span>
              <span className="text-gray-800 font-medium">{item.shortName || item.name}</span>
            </button>
          ))}
          <button onMouseDown={(e) => { e.preventDefault(); setShowSuggest(false); setShowNewSub(true) }}
            className="w-full px-3 py-2 text-left text-xs text-blue-600 hover:bg-blue-50 border-t border-gray-100 font-medium">+ 新しく補助科目を登録する</button>
        </div>
      )}

      {showSubSuggest && subAccounts.length > 0 && (
        <div className="absolute left-0 top-full mt-1 w-56 bg-white border border-gray-300 rounded-lg shadow-xl z-30 max-h-48 overflow-auto">
          <div className="px-3 py-1 text-xs text-gray-500 border-b border-gray-100 font-medium">補助科目を選択</div>
          {subAccounts.map((s) => (
            <button key={s.subCode}
              onMouseDown={(e) => { e.preventDefault(); onSubCodeChange(s.subCode, s.shortName || s.name); setShowSubSuggest(false) }}
              className="w-full px-3 py-1.5 text-left text-sm hover:bg-blue-50 flex gap-2">
              <span className="text-blue-700 font-bold w-8 shrink-0">{s.subCode}</span>
              <span className="text-gray-800">{s.shortName || s.name}</span>
            </button>
          ))}
          <button onMouseDown={(e) => { e.preventDefault(); setShowSubSuggest(false); setShowNewSub(true) }}
            className="w-full px-3 py-2 text-left text-xs text-blue-600 hover:bg-blue-50 border-t border-gray-100 font-medium">+ 新しく補助科目を登録する</button>
        </div>
      )}

      {showNewSub && (
        <div className="absolute left-0 top-full mt-1 w-64 bg-white border border-gray-300 rounded-lg shadow-xl z-30 p-3">
          <div className="text-xs font-bold text-gray-700 mb-2">補助科目を登録 (科目: {code})</div>
          <div className="space-y-2">
            <input type="text" value={newSubCode} onChange={(e) => setNewSubCode(e.target.value)} placeholder="補助コード" className="w-full px-2 py-1 text-sm border border-gray-300 rounded" />
            <input type="text" value={newSubName} onChange={(e) => setNewSubName(e.target.value)} placeholder="補助科目名" className="w-full px-2 py-1 text-sm border border-gray-300 rounded" />
            <div className="flex gap-2">
              <button onClick={() => setShowNewSub(false)} className="flex-1 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200">キャンセル</button>
              <button onClick={() => {
                if (code && newSubCode && newSubName) {
                  onSubAccountRegister(code, newSubCode, newSubName); onSubCodeChange(newSubCode, newSubName)
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

function RowMenu({ onLearn, onAddBlank, onDelete }: { onLearn: () => void; onAddBlank: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded text-xs">...</button>
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

// 金額入力コンポーネント（フォーカス時は数値編集、非フォーカス時はカンマ表示）
function AmountInput({ value, onChange }: { value: number; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [editStr, setEditStr] = useState('')

  return editing ? (
    <input type="text" inputMode="numeric" autoFocus
      value={editStr}
      onChange={(e) => setEditStr(e.target.value.replace(/[^0-9]/g, ''))}
      onFocus={(e) => e.target.select()}
      onBlur={() => { onChange(editStr); setEditing(false) }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { onChange(editStr); setEditing(false); handleCellNav(e) }
        else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { onChange(editStr); setEditing(false); handleCellNav(e) }
        else if (e.key === 'Escape') setEditing(false)
      }}
      className="w-full px-1.5 py-1 text-sm text-right bg-blue-50 border-0 outline-none ring-1 ring-blue-400 rounded font-medium tabular-nums" />
  ) : (
    <div tabIndex={0}
      onClick={() => { setEditStr(value ? String(value) : ''); setEditing(true) }}
      onFocus={() => { setEditStr(value ? String(value) : ''); setEditing(true) }}
      className="w-full px-1.5 py-1 text-sm text-right cursor-text rounded font-medium text-gray-800 tabular-nums hover:bg-gray-100 min-h-[28px]">
      {value ? value.toLocaleString() : ''}
    </div>
  )
}

function handleCellNav(e: React.KeyboardEvent<HTMLInputElement>) {
  const el = e.currentTarget
  if (e.key === 'Enter') { e.preventDefault(); if (!navigateCell(el, 'right')) navigateCell(el, 'next-row') }
  else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); navigateCell(el, e.key === 'ArrowUp' ? 'up' : 'down') }
  else if (e.key === 'ArrowLeft' && el.selectionStart === 0) navigateCell(el, 'left')
  else if (e.key === 'ArrowRight' && el.selectionStart === el.value.length) navigateCell(el, 'right')
}

function navigateCell(current: HTMLElement, dir: 'up' | 'down' | 'left' | 'right' | 'next-row'): boolean {
  const td = current.closest('td'); if (!td) return false
  const tr = td.closest('tr'); if (!tr) return false
  const cells = Array.from(tr.querySelectorAll('td'))
  const ci = cells.indexOf(td)
  let target: Element | null = null

  if (dir === 'left') { for (let i = ci - 1; i >= 0; i--) if (cells[i].querySelector('input')) { target = cells[i]; break } }
  else if (dir === 'right') { for (let i = ci + 1; i < cells.length; i++) if (cells[i].querySelector('input')) { target = cells[i]; break } }
  else if (dir === 'next-row') {
    const tbody = tr.closest('tbody'); if (!tbody) return false
    const rows = Array.from(tbody.querySelectorAll('tr')); const ri = rows.indexOf(tr)
    const next = rows[ri + 1]; if (next) for (const c of Array.from(next.querySelectorAll('td'))) if (c.querySelector('input')) { target = c; break }
  } else {
    const tbody = tr.closest('tbody'); if (!tbody) return false
    const rows = Array.from(tbody.querySelectorAll('tr')); const ri = rows.indexOf(tr)
    const tgt = dir === 'up' ? rows[ri - 1] : rows[ri + 1]
    if (tgt) { const tc = Array.from(tgt.querySelectorAll('td')); if (tc[ci]) target = tc[ci] }
  }
  if (target) { const inp = target.querySelector('input') as HTMLInputElement | null; if (inp) { inp.focus(); return true } }
  return false
}
