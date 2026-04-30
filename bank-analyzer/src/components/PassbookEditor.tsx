'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ParsedPassbook, Transaction } from '@/types'
import { PdfViewer, type PdfViewerHandle } from './PdfViewer'
import { NumberInput, WarekiInput } from './FormattedInputs'
import { computeBalanceMismatches } from '@/lib/balance-check'
import { parseLooseDate, toIsoDate } from '@/lib/wareki'

type Props = {
  passbook: ParsedPassbook
  pdfUrl?: string
  includedTxIds?: Set<string>
  onChange: (next: ParsedPassbook) => void
  onAddTx?: (txId: string) => void
}

const fmt = (n: number) => (n ? n.toLocaleString() : '')

const COL_KEYS = ['drag', 'mark', 'date', 'desc', 'deposit', 'withdrawal', 'balance', 'remarks', 'delete'] as const
type ColKey = (typeof COL_KEYS)[number]

const DEFAULT_WIDTHS: Record<ColKey, number> = {
  drag: 24,
  mark: 56,
  date: 200,
  desc: 196,
  deposit: 88,
  withdrawal: 88,
  balance: 110,
  remarks: 200,
  delete: 44
}

const COL_LABELS: Record<ColKey, string> = {
  drag: '',
  mark: '計上',
  date: '日付',
  desc: '摘要',
  deposit: '入金',
  withdrawal: '出金',
  balance: '残高',
  remarks: '備考',
  delete: '削除'
}

const COL_ALIGN: Record<ColKey, 'left' | 'center' | 'right'> = {
  drag: 'center',
  mark: 'center',
  date: 'left',
  desc: 'left',
  deposit: 'right',
  withdrawal: 'right',
  balance: 'right',
  remarks: 'left',
  delete: 'center'
}

const STORAGE_KEY = 'bank-analyzer-passbook-col-widths-v6'

export function PassbookEditor({ passbook, pdfUrl, includedTxIds, onChange, onAddTx }: Props) {
  const pdfRef = useRef<PdfViewerHandle>(null)
  const tableScrollRef = useRef<HTMLDivElement>(null)
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null)
  const [widths, setWidths] = useState<Record<ColKey, number>>(DEFAULT_WIDTHS)
  const [mismatchCursor, setMismatchCursor] = useState(0)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [dragPosition, setDragPosition] = useState<'before' | 'after'>('before')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [lastClickedId, setLastClickedId] = useState<string | null>(null)

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
  const deleteTx = (id: string) => {
    const tx = passbook.transactions.find((t) => t.id === id)
    if (!tx) return
    const desc = tx.description ? `「${tx.description}」` : ''
    const dateLabel = tx.date || '日付不明'
    if (!confirm(`${dateLabel} ${desc} の取引行を削除します。よろしいですか？`)) return
    onChange({
      ...passbook,
      transactions: passbook.transactions.filter((t) => t.id !== id)
    })
  }
  const shiftTxYear = (id: string, deltaYears: number) => {
    const tx = passbook.transactions.find((t) => t.id === id)
    if (!tx) return
    const d = parseLooseDate(tx.date)
    if (!d) return
    const next = new Date(d)
    next.setFullYear(next.getFullYear() + deltaYears)
    updateTx(id, { date: toIsoDate(next) })
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
    // 入力欄やボタンをクリックした場合は通常の編集動作のみ
    const target = e.target as HTMLElement
    if (target.closest('input, button, select, textarea, a')) return

    // Ctrl/Cmd + クリック: 個別選択トグル
    if (e.ctrlKey || e.metaKey) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        if (next.has(tx.id)) next.delete(tx.id)
        else next.add(tx.id)
        return next
      })
      setLastClickedId(tx.id)
      return
    }

    // Shift + クリック: 範囲選択
    if (e.shiftKey && lastClickedId) {
      const ids = passbook.transactions.map((t) => t.id)
      const fromIdx = ids.indexOf(lastClickedId)
      const toIdx = ids.indexOf(tx.id)
      if (fromIdx >= 0 && toIdx >= 0) {
        const [s, en] = fromIdx < toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx]
        const rangeIds = ids.slice(s, en + 1)
        setSelectedIds((prev) => {
          const next = new Set(prev)
          for (const id of rangeIds) next.add(id)
          return next
        })
        return
      }
    }

    // 通常クリック: 選択解除 + PDFジャンプ
    setSelectedIds(new Set())
    setSelectedTxId(tx.id)
    setLastClickedId(tx.id)
    if (tx.pageNumber && pdfRef.current) {
      pdfRef.current.goToPage(tx.pageNumber)
    }
  }

  const addBlankRow = () => {
    const list = passbook.transactions
    const targetIdx = selectedTxId ? list.findIndex((t) => t.id === selectedTxId) : -1
    // 直近にクリックされた行があればその直前に挿入、なければ末尾に追加
    const reference =
      targetIdx >= 0 ? list[targetIdx] : list.length > 0 ? list[list.length - 1] : null
    const newTx: Transaction = {
      id: `${passbook.passbookId}-manual-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      date: reference?.date || '',
      description: '',
      deposit: 0,
      withdrawal: 0,
      balance: reference?.balance || 0,
      remarks: '手動追加',
      pageNumber: reference?.pageNumber
    }
    const next =
      targetIdx >= 0
        ? [...list.slice(0, targetIdx), newTx, ...list.slice(targetIdx)]
        : [...list, newTx]
    onChange({ ...passbook, transactions: next })
    setSelectedTxId(newTx.id)
  }

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return
    if (!confirm(`選択中の ${selectedIds.size} 行を削除します。よろしいですか？`)) return
    onChange({
      ...passbook,
      transactions: passbook.transactions.filter((t) => !selectedIds.has(t.id))
    })
    setSelectedIds(new Set())
  }

  const handleClearSelection = () => {
    setSelectedIds(new Set())
  }

  // ドラッグ&ドロップで取引行の並び替え
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggingId(id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }
  const handleDragEnd = () => {
    setDraggingId(null)
    setDragOverId(null)
  }
  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (id === draggingId) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const middle = rect.top + rect.height / 2
    setDragOverId(id)
    setDragPosition(e.clientY < middle ? 'before' : 'after')
  }
  const handleDragLeave = (e: React.DragEvent) => {
    // 子要素からのleaveは無視（チラつき防止）
    if ((e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) return
  }
  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    if (!draggingId || draggingId === targetId) {
      handleDragEnd()
      return
    }
    const txs = [...passbook.transactions]
    const fromIdx = txs.findIndex((t) => t.id === draggingId)
    const toIdx = txs.findIndex((t) => t.id === targetId)
    if (fromIdx === -1 || toIdx === -1) {
      handleDragEnd()
      return
    }
    const [moved] = txs.splice(fromIdx, 1)
    let insertAt = txs.findIndex((t) => t.id === targetId)
    if (dragPosition === 'after') insertAt += 1
    txs.splice(insertAt, 0, moved)
    onChange({ ...passbook, transactions: txs })
    handleDragEnd()
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
        {balanceCheck.pageBoundaryWarnings.length > 0 && (
          <ul className="text-xs text-amber-900 list-disc list-inside max-h-20 overflow-auto bg-amber-50 p-2 rounded">
            {balanceCheck.pageBoundaryWarnings.map((w, i) => (
              <li key={i}>
                {w.page}ページ目の開始残高(
                {w.pageStart.toLocaleString()}
                )が前ページ終了残高(
                {w.prevPageEnd.toLocaleString()}
                )と一致しません
              </li>
            ))}
          </ul>
        )}
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
      className={`relative px-1 py-1 select-none text-${COL_ALIGN[col]} border-r border-slate-500 last:border-r-0 text-[11px] font-semibold`}
    >
      {COL_LABELS[col]}
      <span
        onMouseDown={(e) => startResize(col, e)}
        className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize bg-transparent hover:bg-blue-400/50"
        title="ドラッグで列幅を変更"
      />
    </th>
  )

  const cellTd = 'border border-slate-300 p-0 align-middle'
  const cellInputBase =
    'w-full h-full px-1.5 py-0 bg-transparent border-0 outline-none text-[12px] focus:bg-blue-50 focus:outline focus:outline-2 focus:outline-blue-400 focus:-outline-offset-1'

  const dataPanel = (
    <div ref={tableScrollRef} className="h-full min-h-0 overflow-auto border border-slate-300">
      <table
        className="text-[12px] border-collapse"
        style={{ width: totalWidth, tableLayout: 'fixed' }}
      >
        <colgroup>
          {COL_KEYS.map((c) => (
            <col key={c} style={{ width: widths[c] }} />
          ))}
        </colgroup>
        <thead className="bg-slate-700 text-white sticky top-0 z-10">
          <tr style={{ height: 26 }}>{COL_KEYS.map(renderHeaderCell)}</tr>
        </thead>
        <tbody>
          {passbook.transactions.map((tx) => {
            const isIncluded = includedTxIds?.has(tx.id) ?? false
            const isSelected = selectedTxId === tx.id
            const isMultiSelected = selectedIds.has(tx.id)
            const mismatch = mismatchMap.get(tx.id)
            const rowClass = isMultiSelected
              ? 'bg-indigo-200 hover:bg-indigo-300'
              : mismatch
              ? isSelected
                ? 'bg-red-200'
                : 'bg-red-50 hover:bg-red-100'
              : isSelected
              ? 'bg-blue-100'
              : isIncluded
              ? 'bg-amber-50'
              : 'hover:bg-slate-50'
            const isDragging = draggingId === tx.id
            const isDragOverThis = dragOverId === tx.id && draggingId !== tx.id
            const dragIndicator =
              isDragOverThis && dragPosition === 'before'
                ? 'border-t-2 border-t-blue-500'
                : isDragOverThis && dragPosition === 'after'
                ? 'border-b-2 border-b-blue-500'
                : ''
            return (
              <tr
                key={tx.id}
                data-tx-id={tx.id}
                onDragOver={(e) => handleDragOver(e, tx.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, tx.id)}
                style={{ height: 24 }}
                className={`cursor-pointer ${rowClass} ${dragIndicator} ${isDragging ? 'opacity-40' : ''}`}
                onClick={(e) => handleRowClick(tx, e)}
              >
                <td
                  draggable
                  onDragStart={(e) => handleDragStart(e, tx.id)}
                  onDragEnd={handleDragEnd}
                  className={`${cellTd} text-center text-slate-400 select-none cursor-grab active:cursor-grabbing`}
                  title="ドラッグして並び替え"
                >
                  ≡
                </td>
                <td className={`${cellTd} text-center`}>
                  {isIncluded ? (
                    <span
                      className="inline-flex items-center justify-center w-6 h-5 rounded bg-amber-200 text-amber-900 font-bold text-[11px]"
                      title="一覧表に計上中"
                    >
                      ✓
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onAddTx?.(tx.id)}
                      disabled={!onAddTx}
                      className="px-1.5 py-0 h-5 text-[11px] bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-slate-300"
                      title="金融資産異動一覧表に追加"
                    >
                      ＋追加
                    </button>
                  )}
                </td>
                <td className={cellTd}>
                  <div className="flex items-center h-full">
                    <WarekiInput
                      value={tx.date}
                      onChange={(v) => updateTx(tx.id, { date: v })}
                      className={`${cellInputBase} text-left flex-1 min-w-0`}
                    />
                    <div className="flex items-center gap-0.5 px-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => shiftTxYear(tx.id, -1)}
                        className="text-[10px] text-slate-500 hover:text-blue-700 hover:bg-blue-100 px-0.5 leading-none"
                        title="この行の年を1年戻す"
                      >
                        ◀
                      </button>
                      <button
                        type="button"
                        onClick={() => shiftTxYear(tx.id, +1)}
                        className="text-[10px] text-slate-500 hover:text-blue-700 hover:bg-blue-100 px-0.5 leading-none"
                        title="この行の年を1年進める"
                      >
                        ▶
                      </button>
                      {tx.pageNumber && (
                        <span className="text-[10px] text-slate-400 leading-none">p{tx.pageNumber}</span>
                      )}
                    </div>
                  </div>
                </td>
                <td className={cellTd}>
                  <input
                    type="text"
                    value={tx.description}
                    onChange={(e) => updateTx(tx.id, { description: e.target.value })}
                    className={`${cellInputBase} text-left`}
                  />
                </td>
                <td className={cellTd}>
                  <NumberInput
                    value={tx.deposit || 0}
                    onChange={(v) => updateTx(tx.id, { deposit: v })}
                    className={`${cellInputBase} text-right`}
                  />
                </td>
                <td className={cellTd}>
                  <NumberInput
                    value={tx.withdrawal || 0}
                    onChange={(v) => updateTx(tx.id, { withdrawal: v })}
                    className={`${cellInputBase} text-right`}
                  />
                </td>
                <td
                  className={`${cellTd} ${mismatch ? 'bg-red-100 outline outline-2 outline-red-500 -outline-offset-2' : ''}`}
                  title={
                    mismatch
                      ? `期待値: ${mismatch.expected.toLocaleString()} / 実際: ${mismatch.actual.toLocaleString()}`
                      : undefined
                  }
                >
                  <div className="flex items-center h-full">
                    <NumberInput
                      value={tx.balance || 0}
                      onChange={(v) => updateTx(tx.id, { balance: v })}
                      className={`${cellInputBase} text-right flex-1`}
                    />
                    {mismatch && (
                      <span
                        className="text-red-600 text-[11px] px-1 flex-shrink-0"
                        title={`期待値: ${mismatch.expected.toLocaleString()}`}
                      >
                        ⚠
                      </span>
                    )}
                  </div>
                </td>
                <td className={cellTd}>
                  <input
                    type="text"
                    value={tx.remarks || ''}
                    onChange={(e) => updateTx(tx.id, { remarks: e.target.value })}
                    className={`${cellInputBase} text-left`}
                  />
                </td>
                <td className={`${cellTd} text-center`}>
                  <button
                    type="button"
                    onClick={() => deleteTx(tx.id)}
                    className="px-1.5 py-0 h-5 text-[11px] bg-red-600 text-white rounded hover:bg-red-700"
                    title="この取引行を削除"
                  >
                    ✕
                  </button>
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
        <div className="flex items-center gap-2 mb-1 text-xs">
          <button
            type="button"
            onClick={addBlankRow}
            className="px-2 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-[11px]"
            title="直近にクリックした行の1行上に空白行を追加（未選択なら末尾）"
          >
            ＋ 1行追加（選択行の上）
          </button>
          {selectedIds.size > 0 ? (
            <>
              <button
                type="button"
                onClick={handleDeleteSelected}
                className="px-2 py-0.5 bg-red-600 text-white rounded hover:bg-red-700 text-[11px]"
              >
                選択した {selectedIds.size} 行を削除
              </button>
              <button
                type="button"
                onClick={handleClearSelection}
                className="px-2 py-0.5 bg-slate-200 text-slate-800 rounded hover:bg-slate-300 text-[11px]"
              >
                選択解除
              </button>
            </>
          ) : (
            <span className="text-slate-500">
              行クリック=PDFジャンプ ／ Ctrl+クリック=個別選択 ／ Shift+クリック=範囲選択
            </span>
          )}
        </div>
        <div className="flex-1 min-h-0">{dataPanel}</div>
      </div>
    </div>
  )
}
