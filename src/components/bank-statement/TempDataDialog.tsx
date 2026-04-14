'use client'

import { useState, useEffect } from 'react'
import type { JournalEntry } from '@/lib/bank-statement/types'
import { getTempEntries, saveTempEntries } from '@/lib/bank-statement/temp-store'

interface Props {
  open: boolean
  onClose: () => void
  onCountChange: (count: number) => void
}

export default function TempDataDialog({ open, onClose, onCountChange }: Props) {
  const [entries, setEntries] = useState<JournalEntry[]>([])

  useEffect(() => {
    if (open) setEntries(getTempEntries())
  }, [open])

  if (!open) return null

  const handleDelete = (id: string) => {
    const updated = entries.filter((e) => e.id !== id)
    saveTempEntries(updated)
    setEntries(updated)
    onCountChange(updated.length)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[85vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-800">一時保存データ確認</h2>
            <p className="text-sm text-gray-500">{entries.length}件の仕訳が一時保存されています</p>
          </div>
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
                <th className="px-3 py-2 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, idx) => (
                <tr key={e.id} className={`border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50`}>
                  <td className="px-3 py-1.5 text-xs">{e.date}</td>
                  <td className="px-3 py-1.5 text-xs font-bold text-gray-800">{e.debitCode}</td>
                  <td className="px-3 py-1.5 text-xs">{e.debitName}</td>
                  <td className="px-3 py-1.5 text-xs font-bold text-gray-800">{e.creditCode}</td>
                  <td className="px-3 py-1.5 text-xs">{e.creditName}</td>
                  <td className="px-3 py-1.5 text-xs text-right tabular-nums font-medium">
                    {(e.debitAmount || e.creditAmount || 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-1.5 text-xs">{e.debitTaxCode} {e.debitTaxType}</td>
                  <td className="px-3 py-1.5 text-xs text-gray-600">{e.description}</td>
                  <td className="px-3 py-1.5 text-center">
                    <button onClick={() => handleDelete(e.id)}
                      className="text-xs text-red-500 hover:underline">削除</button>
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-gray-400">一時保存データはありません</td></tr>
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
