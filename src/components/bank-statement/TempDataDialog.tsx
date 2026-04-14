'use client'

import { useState, useEffect, useCallback } from 'react'
import type { JournalEntry } from '@/lib/bank-statement/types'
import { getTempEntries, saveTempEntries } from '@/lib/bank-statement/temp-store'

interface Props {
  open: boolean
  onClose: () => void
  onCountChange: (count: number) => void
}

export default function TempDataDialog({ open, onClose, onCountChange }: Props) {
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [lastClickedIdx, setLastClickedIdx] = useState<number | null>(null)

  useEffect(() => {
    if (open) { setEntries(getTempEntries()); setSelected(new Set()) }
  }, [open])

  if (!open) return null

  const handleRowClick = (id: string, idx: number, e: React.MouseEvent) => {
    const next = new Set(selected)

    if (e.shiftKey && lastClickedIdx !== null) {
      // Shift+クリック: 範囲選択
      const [from, to] = lastClickedIdx < idx ? [lastClickedIdx, idx] : [idx, lastClickedIdx]
      for (let i = from; i <= to; i++) next.add(entries[i].id)
    } else if (e.ctrlKey || e.metaKey) {
      // Ctrl+クリック: トグル
      next.has(id) ? next.delete(id) : next.add(id)
    } else {
      // 通常クリック: 単一選択
      next.clear()
      next.add(id)
    }

    setSelected(next)
    setLastClickedIdx(idx)
  }

  const selectAll = () => {
    if (selected.size === entries.length) setSelected(new Set())
    else setSelected(new Set(entries.map((e) => e.id)))
  }

  const handleDeleteSelected = () => {
    if (selected.size === 0) return
    if (!confirm(`${selected.size}件の仕訳を削除しますか？`)) return
    const updated = entries.filter((e) => !selected.has(e.id))
    saveTempEntries(updated)
    setEntries(updated)
    setSelected(new Set())
    onCountChange(updated.length)
  }

  const handleDeleteAll = () => {
    if (!confirm(`全${entries.length}件の一時保存データを削除しますか？`)) return
    saveTempEntries([])
    setEntries([])
    setSelected(new Set())
    onCountChange(0)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[85vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-800">一時保存データ確認</h2>
            <p className="text-sm text-gray-500">{entries.length}件の仕訳が一時保存されています</p>
          </div>
          <div className="flex items-center gap-2">
            {selected.size > 0 && (
              <button onClick={handleDeleteSelected}
                className="px-3 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700 font-medium">
                選択削除 ({selected.size}件)
              </button>
            )}
            <button onClick={handleDeleteAll}
              className="px-3 py-1.5 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300">
              全削除
            </button>
          </div>
        </div>

        {/* 操作バー */}
        <div className="px-6 py-2 bg-gray-50 border-b border-gray-200 flex items-center gap-3 text-xs text-gray-500">
          <button onClick={selectAll} className="text-blue-600 hover:underline">
            {selected.size === entries.length ? '全解除' : '全選択'}
          </button>
          <span>{selected.size}件選択</span>
          <span className="text-gray-400">※ Shift+クリックで範囲選択、Ctrl+クリックで追加選択</span>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-gray-600 text-white">
              <tr>
                <th className="px-3 py-2 text-left font-medium w-24">日付</th>
                <th className="px-3 py-2 text-left font-medium">借方CD</th>
                <th className="px-3 py-2 text-left font-medium">借方科目</th>
                <th className="px-3 py-2 text-left font-medium">貸方CD</th>
                <th className="px-3 py-2 text-left font-medium">貸方科目</th>
                <th className="px-3 py-2 text-right font-medium w-24">金額</th>
                <th className="px-3 py-2 text-left font-medium w-16">消費税</th>
                <th className="px-3 py-2 text-left font-medium">摘要</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, idx) => (
                <tr key={e.id}
                  onClick={(ev) => handleRowClick(e.id, idx, ev)}
                  className={`border-b border-gray-100 cursor-pointer transition-colors ${
                    selected.has(e.id)
                      ? 'bg-blue-100'
                      : idx % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-gray-50 hover:bg-blue-50'
                  }`}>
                  <td className="px-3 py-1.5 text-xs">{e.date}</td>
                  <td className="px-3 py-1.5 text-xs font-bold text-gray-800">{e.debitCode}</td>
                  <td className="px-3 py-1.5 text-xs">{e.debitName}</td>
                  <td className="px-3 py-1.5 text-xs font-bold text-gray-800">{e.creditCode}</td>
                  <td className="px-3 py-1.5 text-xs">{e.creditName}</td>
                  <td className="px-3 py-1.5 text-xs text-right tabular-nums font-medium">
                    {(e.debitAmount || e.creditAmount || 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-1.5 text-xs">{e.debitTaxCode} {e.debitTaxType?.slice(0, 2)}</td>
                  <td className="px-3 py-1.5 text-xs text-gray-600">{e.description}</td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-400">一時保存データはありません</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-3 border-t border-gray-200">
          <button onClick={onClose} className="px-4 py-2 text-sm bg-gray-100 rounded hover:bg-gray-200">閉じる</button>
        </div>
      </div>
    </div>
  )
}
