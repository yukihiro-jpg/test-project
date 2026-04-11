'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
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
  isCompoundFirst?: boolean
  isCompoundLast?: boolean
  compoundAutoAmount?: number
  onSelect: (id: string) => void
  onChange: (id: string, field: keyof JournalEntry, value: string | number) => void
  onAddCompound: () => void
  onDelete: () => void
  onLearn: () => void
  onAddBlank: () => void
  onSubAccountRegister: (parentCode: string, subCode: string, name: string) => void
  onPatternClick?: (patternId: string) => void
}

const REQUIRED_FIELDS: (keyof JournalEntry)[] = ['debitCode', 'creditCode', 'debitTaxCode', 'debitTaxType']

function toHalfWidth(str: string): string {
  return str.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
    .replace(/[Ａ-Ｚａ-ｚ]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
}

export default function JournalEntryRow({
  entry, isSelected, accountMaster, subAccountMaster,
  isPageBoundary, pageLabel, runningBalance, rowNumber,
  isCompoundGroup, isCompoundFirst, isCompoundLast, compoundAutoAmount,
  onSelect, onChange, onAddCompound, onDelete, onLearn, onAddBlank, onSubAccountRegister, onPatternClick,
}: Props) {
  const amount = entry.debitAmount || entry.creditAmount || 0
  const hasAutoCalc = compoundAutoAmount != null
  const displayAmount = hasAutoCalc ? compoundAutoAmount : amount

  // 金額編集state
  const [editingAmount, setEditingAmount] = useState(false)
  const [amountStr, setAmountStr] = useState('')

  const handleAmountSave = useCallback((v: string) => {
    const num = parseInt(v.replace(/[^0-9]/g, '')) || 0
    // 借方と貸方の両方を同時更新するため、専用のフィールド名を使用
    onChange(entry.id, '_amount' as keyof JournalEntry, num)
    setEditingAmount(false)
  }, [entry.id, onChange])

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

  let bgClass: string
  if (isSelected) bgClass = 'bg-sky-100'
  else if (isCompoundGroup) bgClass = 'bg-violet-50'
  else bgClass = rowNumber % 2 === 0 ? 'bg-white' : 'bg-gray-50'

  return (
    <>
      {isPageBoundary && (
        <tr className="bg-teal-600">
          <td colSpan={11} className="px-3 py-1 text-xs font-bold text-white">{pageLabel} ページ</td>
        </tr>
      )}
      {isCompoundFirst && (
        <tr>
          <td colSpan={11} className="px-3 py-0.5 text-xs font-bold text-red-600 bg-red-50 border-t-2 border-l-2 border-r-2 border-red-400">複合仕訳</td>
        </tr>
      )}
      <tr
        className={`${bgClass} hover:bg-sky-50 cursor-pointer transition-colors`}
        style={{
          borderBottom: isCompoundLast ? '2px solid #f87171' : '1px solid #cbd5e1',
          borderLeft: isCompoundGroup ? '2px solid #f87171' : undefined,
          borderRight: isCompoundGroup ? '2px solid #f87171' : undefined,
        }}
        onClick={() => onSelect(entry.id)}
      >
        {/* 学習 */}
        <td style={CB} className="text-center">
          {entry.patternId ? (
            <button
              onClick={(e) => { e.stopPropagation(); onPatternClick?.(entry.patternId!) }}
              className="text-amber-500 hover:text-amber-600 text-base font-bold"
              title="パターン学習から生成（クリックで詳細）"
            >
              ★
            </button>
          ) : (
            <span className="text-gray-300 text-sm">—</span>
          )}
        </td>

        {/* 日付 */}
        <td style={CB}>
          <CellInput value={entry.date} onChange={(v) => onChange(entry.id, 'date', v)} placeholder="YYYYMMDD" halfWidth />
        </td>

        {/* 借方科目 */}
        <td style={CB} className={emptyBg('debitCode')}>
          <AccountField code={entry.debitCode} name={entry.debitName}
            subCode={entry.debitSubCode} subName={entry.debitSubName}
            accountMaster={accountMaster} subAccountMaster={subAccountMaster}
            onCodeChange={handleDebitCodeChange}
            onSubCodeChange={(sc, sn) => { onChange(entry.id, 'debitSubCode', sc); onChange(entry.id, 'debitSubName', sn) }}
            onSubAccountRegister={onSubAccountRegister} />
        </td>

        {/* 貸方科目 */}
        <td style={CB} className={emptyBg('creditCode')}>
          <AccountField code={entry.creditCode} name={entry.creditName}
            subCode={entry.creditSubCode} subName={entry.creditSubName}
            accountMaster={accountMaster} subAccountMaster={subAccountMaster}
            onCodeChange={handleCreditCodeChange}
            onSubCodeChange={(sc, sn) => { onChange(entry.id, 'creditSubCode', sc); onChange(entry.id, 'creditSubName', sn) }}
            onSubAccountRegister={onSubAccountRegister} />
        </td>

        {/* 金額 */}
        <td style={CB}>
          {hasAutoCalc ? (
            <span className="block px-2 py-1 text-sm text-right font-bold text-violet-700 tabular-nums">
              {displayAmount.toLocaleString()}
            </span>
          ) : editingAmount ? (
            <input type="text" inputMode="numeric" autoFocus
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value.replace(/[^0-9]/g, ''))}
              onBlur={() => handleAmountSave(amountStr)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); handleAmountSave(amountStr); navCell(e.currentTarget, 'right') }
                else if (e.key === 'Escape') setEditingAmount(false)
                else if (e.key === 'ArrowUp') { handleAmountSave(amountStr); navCell(e.currentTarget, 'up') }
                else if (e.key === 'ArrowDown') { handleAmountSave(amountStr); navCell(e.currentTarget, 'down') }
              }}
              className="w-full px-1.5 py-1 text-sm text-right bg-blue-50 border-0 outline-none ring-2 ring-blue-400 rounded font-medium tabular-nums" />
          ) : (
            <div tabIndex={0}
              onClick={(e) => { e.stopPropagation(); setAmountStr(amount ? String(amount) : ''); setEditingAmount(true); onSelect(entry.id) }}
              className="w-full px-1.5 py-1 text-sm text-right cursor-text rounded font-medium text-gray-800 tabular-nums hover:bg-gray-100 min-h-[28px]">
              {amount ? amount.toLocaleString() : ''}
            </div>
          )}
        </td>

        {/* 残高 */}
        <td style={CB} className="text-right px-2 py-1">
          <span className="text-sm font-medium text-gray-700 tabular-nums">
            {runningBalance != null ? runningBalance.toLocaleString() : ''}
          </span>
        </td>

        {/* 税CD */}
        <td style={CB} className={emptyBg('debitTaxCode')}>
          <CellInput value={entry.debitTaxCode} onChange={(v) => onChange(entry.id, 'debitTaxCode', v)} halfWidth />
        </td>

        {/* 税区分 */}
        <td style={CB} className={emptyBg('debitTaxType')}>
          <CellInput value={entry.debitTaxType} onChange={(v) => onChange(entry.id, 'debitTaxType', v)} />
        </td>

        {/* 摘要 */}
        <td style={CB}>
          <CellInput value={entry.description} onChange={(v) => onChange(entry.id, 'description', v)} placeholder="摘要" />
        </td>

        {/* 操作 */}
        <td className="px-1 py-1">
          <div className="flex items-center gap-0.5" onMouseDown={(e) => e.stopPropagation()}>
            <button onClick={onAddCompound} title="複合仕訳行を追加"
              className="w-6 h-6 flex items-center justify-center text-xs text-violet-600 hover:bg-violet-100 rounded font-bold border border-violet-200">+</button>
            <RowMenu onLearn={onLearn} onAddBlank={onAddBlank} onDelete={onDelete} />
          </div>
        </td>
      </tr>
    </>
  )
}

const CB: React.CSSProperties = { borderRight: '1px solid #94a3b8', padding: '2px 4px' }

function CellInput({ value, onChange, placeholder, halfWidth, align }: {
  value: string; onChange: (v: string) => void; placeholder?: string; halfWidth?: boolean; align?: string
}) {
  return (
    <input type="text" value={value}
      onChange={(e) => onChange(halfWidth ? toHalfWidth(e.target.value) : e.target.value)}
      onKeyDown={handleNav} placeholder={placeholder}
      inputMode={halfWidth ? 'numeric' : undefined}
      style={halfWidth ? { imeMode: 'disabled' } as React.CSSProperties : undefined}
      className={`w-full px-1.5 py-1 text-sm bg-transparent border-0 outline-none focus:bg-blue-50 focus:ring-1 focus:ring-blue-400 rounded text-gray-800 ${align === 'right' ? 'text-right font-medium tabular-nums' : ''}`} />
  )
}

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
  const [show, setShow] = useState(false)
  const [showSub, setShowSub] = useState(false)
  const [val, setVal] = useState(code)
  const [showNew, setShowNew] = useState(false)
  const [nsc, setNsc] = useState('')
  const [nsn, setNsn] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setVal(code) }, [code])
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setShow(false); setShowSub(false); setShowNew(false) } }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])

  const filtered = accountMaster
    .filter((a) => a.code.includes(val) || a.name.includes(val) || a.shortName.includes(val) || (a.association || '').includes(val))
    .slice(0, 12)
  const subs = subAccountMaster.filter((s) => s.parentCode === code)

  const confirm = (c: string) => { onCodeChange(c); setShow(false); if (subAccountMaster.filter((s) => s.parentCode === c).length > 0) setShowSub(true) }

  return (
    <div ref={ref} className="relative cursor-text" onClick={() => inputRef.current?.focus()}>
      <div className="flex items-center gap-1 min-h-[28px]">
        <input ref={inputRef} type="text" inputMode="numeric" value={val}
          onChange={(e) => { const v = toHalfWidth(e.target.value); setVal(v); setShow(true) }}
          onFocus={() => setShow(true)}
          onBlur={() => setTimeout(() => { if (!show) onCodeChange(val) }, 300)}
          onKeyDown={handleNav}
          style={{ imeMode: 'disabled' } as React.CSSProperties}
          className="w-12 shrink-0 px-1 py-0.5 text-sm text-blue-700 font-bold bg-transparent border-0 outline-none focus:bg-blue-50 focus:ring-1 focus:ring-blue-400 rounded" />
        <span className="text-sm text-gray-800 font-semibold truncate flex-1">{name}</span>
        {subName && <span className="text-xs text-gray-500 truncate">[{subName}]</span>}
      </div>

      {show && filtered.length > 0 && (
        <div className="absolute left-0 top-full mt-1 w-64 bg-white border border-gray-300 rounded-lg shadow-xl z-30 max-h-56 overflow-auto">
          {filtered.map((item) => (
            <button key={item.code}
              onMouseDown={(e) => { e.preventDefault(); setVal(item.code); confirm(item.code) }}
              className="w-full px-3 py-1.5 text-left text-sm hover:bg-blue-50 flex gap-2">
              <span className="text-blue-700 font-bold w-10 shrink-0">{item.code}</span>
              <span className="text-gray-800 font-medium">{item.shortName || item.name}</span>
            </button>
          ))}
          <button onMouseDown={(e) => { e.preventDefault(); setShow(false); setShowNew(true) }}
            className="w-full px-3 py-2 text-left text-xs text-blue-600 hover:bg-blue-50 border-t border-gray-100 font-medium">+ 新しく補助科目を登録する</button>
        </div>
      )}

      {showSub && subs.length > 0 && (
        <div className="absolute left-0 top-full mt-1 w-56 bg-white border border-gray-300 rounded-lg shadow-xl z-30 max-h-48 overflow-auto">
          <div className="px-3 py-1 text-xs text-gray-500 border-b border-gray-100 font-medium">補助科目を選択</div>
          {subs.map((s) => (
            <button key={s.subCode}
              onMouseDown={(e) => { e.preventDefault(); onSubCodeChange(s.subCode, s.shortName || s.name); setShowSub(false) }}
              className="w-full px-3 py-1.5 text-left text-sm hover:bg-blue-50 flex gap-2">
              <span className="text-blue-700 font-bold w-8 shrink-0">{s.subCode}</span>
              <span className="text-gray-800">{s.shortName || s.name}</span>
            </button>
          ))}
        </div>
      )}

      {showNew && (
        <div className="absolute left-0 top-full mt-1 w-64 bg-white border border-gray-300 rounded-lg shadow-xl z-30 p-3">
          <div className="text-xs font-bold text-gray-700 mb-2">補助科目を登録 (科目: {code})</div>
          <div className="space-y-2">
            <input type="text" value={nsc} onChange={(e) => setNsc(e.target.value)} placeholder="補助コード" className="w-full px-2 py-1 text-sm border border-gray-300 rounded" />
            <input type="text" value={nsn} onChange={(e) => setNsn(e.target.value)} placeholder="補助科目名" className="w-full px-2 py-1 text-sm border border-gray-300 rounded" />
            <div className="flex gap-2">
              <button onClick={() => setShowNew(false)} className="flex-1 py-1 text-xs bg-gray-100 rounded">キャンセル</button>
              <button onClick={() => { if (code && nsc && nsn) { onSubAccountRegister(code, nsc, nsn); onSubCodeChange(nsc, nsn); setShowNew(false); setNsc(''); setNsn('') } }}
                className="flex-1 py-1 text-xs bg-blue-600 text-white rounded">登録</button>
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

function handleNav(e: React.KeyboardEvent<HTMLInputElement>) {
  const el = e.currentTarget
  if (e.key === 'Enter') { e.preventDefault(); if (!navCell(el, 'right')) navCell(el, 'next-row') }
  else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); navCell(el, e.key === 'ArrowUp' ? 'up' : 'down') }
  else if (e.key === 'ArrowLeft' && el.selectionStart === 0) navCell(el, 'left')
  else if (e.key === 'ArrowRight' && el.selectionStart === el.value.length) navCell(el, 'right')
}

function navCell(current: HTMLElement, dir: 'up' | 'down' | 'left' | 'right' | 'next-row'): boolean {
  const td = current.closest('td'); if (!td) return false
  const tr = td.closest('tr'); if (!tr) return false
  const cells = Array.from(tr.querySelectorAll('td')); const ci = cells.indexOf(td)
  let tgt: Element | null = null

  if (dir === 'left') { for (let i = ci - 1; i >= 0; i--) if (cells[i].querySelector('input')) { tgt = cells[i]; break } }
  else if (dir === 'right') { for (let i = ci + 1; i < cells.length; i++) if (cells[i].querySelector('input')) { tgt = cells[i]; break } }
  else if (dir === 'next-row') {
    const tbody = tr.closest('tbody'); if (!tbody) return false
    const rows = Array.from(tbody.querySelectorAll('tr')); const ri = rows.indexOf(tr)
    const next = rows[ri + 1]; if (next) for (const c of Array.from(next.querySelectorAll('td'))) if (c.querySelector('input')) { tgt = c; break }
  } else {
    const tbody = tr.closest('tbody'); if (!tbody) return false
    const rows = Array.from(tbody.querySelectorAll('tr')); const ri = rows.indexOf(tr)
    const t = dir === 'up' ? rows[ri - 1] : rows[ri + 1]
    if (t) { const tc = Array.from(t.querySelectorAll('td')); if (tc[ci]) tgt = tc[ci] }
  }
  if (tgt) { const inp = tgt.querySelector('input') as HTMLInputElement | null; if (inp) { inp.focus(); return true } }
  return false
}
