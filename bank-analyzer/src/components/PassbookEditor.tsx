'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ParsedPassbook, Transaction } from '@/types'
import { PdfViewer, type PdfViewerHandle } from './PdfViewer'
import { NumberInput, WarekiInput } from './FormattedInputs'
import { computeBalanceMismatches } from '@/lib/balance-check'

type Props = {
  passbook: ParsedPassbook
  pdfUrl?: string
  includedTxIds?: Set<string>
  onChange: (next: ParsedPassbook) => void
  onAddTx?: (txId: string) => void
}

const fmt = (n: number) => (n ? n.toLocaleString() : '')

const COL_KEYS = ['mark', 'date', 'desc', 'deposit', 'withdrawal', 'balance', 'remarks'] as const
type ColKey = (typeof COL_KEYS)[number]

const DEFAULT_WIDTHS: Record<ColKey, number> = {
  mark: 64,
  date: 160,
  desc: 196,
  deposit: 88,
  withdrawal: 88,
  balance: 104,
  remarks: 200
}

const COL_LABELS: Record<ColKey, string> = {
  mark: '計上',
  date: '日付',
  desc: '摘要',
  deposit: '入金',
  withdrawal: '出金',
  balance: '残高',
  remarks: '備考'
}

const COL_ALIGN: Record<ColKey, 'left' | 'center' | 'right'> = {
  mark: 'center',
  date: 'left',
  desc: 'left',
  deposit: 'right',
  withdrawal: 'right',
  balance: 'right',
  remarks: 'left'
}

const STORAGE_KEY = 'bank-analyzer-passbook-col-widths-v3'

export function PassbookEditor({ passbook, pdfUrl, includedTxIds, onChange, onAddTx }: Props) {
  const pdfRef = useRef<PdfViewerHandle>(null)
  const tableScrollRef = useRef<HTMLDivElement>(null)
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null)
  const [widths, setWidths] = useState<Record<ColKey, number>>(DEFAULT_WIDTHS)
  const [mismatchCursor, setMismatchCursor] = useState(0)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed === 'object') {
          setWidths({ ...DEFAULT_WIDTHS, ...parsed })
        }
      }
    } catch {}
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(widths))
    } catch {}
  }, [widths])

  const updateTx = (id: string, patch: Partial<Transaction>) => {
    onChange({
      ...passbook,
      transactions: passbook.transactions.map((tx) => (tx.id === id ? { ...tx, ...patch } : tx))
    })
  }
  const updatePurpose = (purpose: string) => {
    onChange({ ...passbook, purpose })
  }
  const updateStartBalance = (v: number) => {
    onChange({ ...passbook, startBalance: v })
  }
  const updateEndBalance = (v: number) => {
    onChange({ ...passbook, endBalance: v })
  }

  const startBalanceValue = passbook.startBalance ?? 0
  const balanceCheck = useMemo(
    () => computeBalanceMismatches(passbook.transactions, startBalanceValue),
    [passbook.transactions, startBalanceValue]
  )
  const mismatchMap = useMemo(() => {
    const m = new Map<string, { expected: number; actual: number }>()
    for (const x of balanceCheck.mismatches) m.set(x.txId, { expected: x.expected, actual: x.actual })
    return m
  }, [balanceCheck])

  const jumpToMismatch = (txId: string) => {
    const sc = tableScrollRef.current
    if (!sc) return
    const row = sc.querySelector<HTMLTableRowElement>(`tr[data-tx-id="${CSS.escape(txId)}"]`)
    if (!row) return
    const top = row.offsetTop - sc.clientHeight / 3
    sc.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
    setSelectedTxId(txId)
  }
  const handleNextMismatch = () => {
    if (balanceCheck.mismatches.length === 0) return
    const idx = mismatchCursor % balanceCheck.mismatches.length
    jumpToMismatch(balanceCheck.mismatches[idx].txId)
    setMismatchCursor((c) => c + 1)
  }

  const handleRowClick = (tx: Transaction, e: React.MouseEvent) => {
    // 入力欄やボタンをクリックした場合は通常の編集動作のみ（PDFジャンプはしない）
    const target = e.target as HTMLElement
    if (target.closest('input, button, select, textarea, a')) return
    setSelectedTxId(tx.id)
    if (tx.pageNumber && pdfRef.current) {
      pdfRef.current.goToPage(tx.pageNumber)
    }
  }

  const startResize = (col: ColKey, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startW = widths[col]
    const onMove = (ev: MouseEvent) => {
      const next = Math.max(40, startW + (ev.clientX - startX))
      setWidths((w) => ({ ...w, [col]: next }))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    document.body.style.cursor = 'col-resize'
  }

  const computedEnd = balanceCheck.computedEnd
  const declaredEnd = passbook.endBalance ?? 0
  const balanceOk = balanceCheck.mismatches.length === 0 && Math.abs(computedEnd - declaredEnd) < 0.5

  const totalWidth = COL_KEYS.reduce((sum, k) => sum + widths[k], 0)

  const leftPanel = (
    <div className="flex flex-col h-full min-h-0 gap-2">
      <div className="flex-1 min-h-0">
        {pdfUrl ? (
          <PdfViewer ref={pdfRef} pdfUrl={pdfUrl} />
        ) : (
          <div className="h-full flex items-center justify-center text-slate-400 border rounded bg-slate-50">
            PDFが読み込まれていません
          </div>
        )}
      </div>
      <div className="flex-shrink-0 space-y-2 border rounded bg-white p-2">
        <div className="grid grid-cols-4 gap-2 text-xs">
          <div>
            <span className="text-slate-500">銀行名</span>
            <div className="font-medium truncate">{passbook.bankName || '-'}</div>
          </div>
          <div>
            <span className="text-slate-500">支店</span>
            <div className="font-medium truncate">{passbook.branchName || '-'}</div>
          </div>
          <div>
            <span className="text-slate-500">口座番号</span>
            <div className="font-medium truncate">{passbook.accountNumber || '-'}</div>
          </div>
          <div>
            <span className="text-slate-500">ラベル</span>
            <div className="font-medium truncate">{passbook.label}</div>
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 whitespace-nowrap">用途</span>
          <input
            type="text"
            value={passbook.purpose || ''}
            onChange={(e) => updatePurpose(e.target.value)}
            placeholder="例: 生活費、事業資金（一覧表ヘッダに表示）"
            className="flex-1 border border-slate-300 rounded px-2 py-1"
          />
        </label>
        <div
          className={`p-2 rounded text-xs space-y-1 ${
            balanceOk ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}
        >
          <div className="flex flex-wrap gap-x-4 gap-y-1 items-center">
            <label className="flex items-center gap-1">
              <span>開始残高:</span>
              <NumberInput
                value={startBalanceValue}
                onChange={updateStartBalance}
                className="w-28 border border-slate-300 rounded px-1 py-0.5 text-right bg-white"
              />
              <span>円</span>
            </label>
            <label className="flex items-center gap-1">
              <span>終了残高（申告）:</span>
              <NumberInput
                value={declaredEnd}
                onChange={updateEndBalance}
                className="w-28 border border-slate-300 rounded px-1 py-0.5 text-right bg-white"
              />
              <span>円</span>
            </label>
            <span>
              終了残高（計算上）: <strong>{fmt(computedEnd)}</strong> 円
            </span>
          </div>
          <div className="flex items-center gap-3">
            {balanceOk ? (
              <span className="font-bold">✓ 残高すべて一致</span>
            ) : (
              <>
                <span className="font-bold">⚠ 残高不一致: {balanceCheck.mismatches.length}行</span>
                <button
                  type="button"
                  onClick={handleNextMismatch}
                  className="bg-red-600 text-white px-2 py-0.5 rounded text-xs hover:bg-red-700"
                >
                  次の不一致へ →
                </button>
                {Math.abs(computedEnd - declaredEnd) > 0.5 && (
                  <span className="text-xs">
                    （計算と申告の差: {fmt(Math.abs(computedEnd - declaredEnd))}円）
                  </span>
                )}
              </>
            )}
          </div>
        </div>
        {passbook.warnings.length > 0 && (
          <ul className="text-xs text-amber-900 list-disc list-inside max-h-24 overflow-auto">
            {passbook.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )

  const renderHeaderCell = (col: ColKey) => (
    <th
      key={col}
      style={{ width: widths[col], minWidth: widths[col] }}
      className={`relative px-2 py-1 select-none text-${COL_ALIGN[col]} border-r border-slate-600 last:border-r-0`}
    >
      {COL_LABELS[col]}
      <span
        onMouseDown={(e) => startResize(col, e)}
        className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize bg-transparent hover:bg-blue-400/50"
        title="ドラッグで列幅を変更"
      />
    </th>
  )

  const dataPanel = (
    <div ref={tableScrollRef} className="h-full min-h-0 overflow-auto border rounded">
      <table className="text-sm" style={{ width: totalWidth, tableLayout: 'fixed' }}>
        <colgroup>
          {COL_KEYS.map((c) => (
            <col key={c} style={{ width: widths[c] }} />
          ))}
        </colgroup>
        <thead className="bg-slate-700 text-white sticky top-0 z-10">
          <tr>{COL_KEYS.map(renderHeaderCell)}</tr>
        </thead>
        <tbody>
          {passbook.transactions.map((tx) => {
            const isIncluded = includedTxIds?.has(tx.id) ?? false
            const isSelected = selectedTxId === tx.id
            const mismatch = mismatchMap.get(tx.id)
            const rowClass = mismatch
              ? isSelected
                ? 'bg-red-200'
                : 'bg-red-100 hover:bg-red-200'
              : isSelected
              ? 'bg-blue-100'
              : isIncluded
              ? 'bg-amber-50'
              : 'hover:bg-slate-50'
            return (
              <tr
                key={tx.id}
                data-tx-id={tx.id}
                className={`border-t cursor-pointer ${rowClass}`}
                onClick={(e) => handleRowClick(tx, e)}
              >
                <td className="px-1 py-0.5 text-center">
                  {isIncluded ? (
                    <span
                      className="inline-flex items-center justify-center w-7 h-6 rounded bg-amber-200 text-amber-900 font-bold text-xs"
                      title="一覧表に計上中（一覧表側で削除できます）"
                    >
                      ✓
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onAddTx?.(tx.id)}
                      disabled={!onAddTx}
                      className="px-2 py-0.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-slate-300"
                      title="金融資産異動一覧表に追加"
                    >
                      ＋追加
                    </button>
                  )}
                </td>
                <td className="px-1 py-0.5">
                  <WarekiInput value={tx.date} onChange={(v) => updateTx(tx.id, { date: v })} />
                  {tx.pageNumber && (
                    <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                      p.{tx.pageNumber}
                    </div>
                  )}
                </td>
                <td className="px-1 py-0.5">
                  <input
                    type="text"
                    value={tx.description}
                    onChange={(e) => updateTx(tx.id, { description: e.target.value })}
                    className="w-full border border-slate-200 rounded px-1 py-0.5"
                  />
                </td>
                <td className="px-1 py-0.5">
                  <NumberInput
                    value={tx.deposit || 0}
                    onChange={(v) => updateTx(tx.id, { deposit: v })}
                  />
                </td>
                <td className="px-1 py-0.5">
                  <NumberInput
                    value={tx.withdrawal || 0}
                    onChange={(v) => updateTx(tx.id, { withdrawal: v })}
                  />
                </td>
                <td className="px-1 py-0.5">
                  <NumberInput
                    value={tx.balance || 0}
                    onChange={(v) => updateTx(tx.id, { balance: v })}
                    className={`w-full border rounded px-1 py-0.5 text-right ${
                      mismatch ? 'border-red-500 bg-red-50' : 'border-slate-200'
                    }`}
                  />
                  {mismatch && (
                    <div
                      className="text-[10px] text-red-700 mt-0.5 leading-tight"
                      title={`計算上の期待値: ${mismatch.expected.toLocaleString()}`}
                    >
                      期待値: {mismatch.expected.toLocaleString()}
                    </div>
                  )}
                </td>
                <td className="px-1 py-0.5">
                  <input
                    type="text"
                    value={tx.remarks || ''}
                    onChange={(e) => updateTx(tx.id, { remarks: e.target.value })}
                    className="w-full border border-slate-200 rounded px-1 py-0.5"
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ height: '85vh', minHeight: 600 }}>
      {leftPanel}
      <div className="flex flex-col h-full min-h-0">
        <div className="text-xs text-slate-500 mb-1">
          ヒント: 行をクリックすると左のPDFが該当ページにジャンプします。列ヘッダ右端をドラッグで列幅変更。
        </div>
        <div className="flex-1 min-h-0">{dataPanel}</div>
      </div>
    </div>
  )
}
