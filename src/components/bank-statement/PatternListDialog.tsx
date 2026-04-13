'use client'

import { useState, useEffect } from 'react'
import type { PatternEntry } from '@/lib/bank-statement/types'
import {
  getPatterns,
  savePatterns,
  deletePattern,
  exportPatterns,
  importPatterns,
  clearPatterns,
} from '@/lib/bank-statement/pattern-store'

interface Props {
  open: boolean
  onClose: () => void
}

export default function PatternListDialog({ open, onClose }: Props) {
  const [patterns, setPatterns] = useState<PatternEntry[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editMin, setEditMin] = useState('')
  const [editMax, setEditMax] = useState('')

  useEffect(() => {
    if (open) setPatterns(getPatterns())
  }, [open])

  if (!open) return null

  const handleSaveRange = (id: string) => {
    const updated = patterns.map((p) => {
      if (p.id !== id) return p
      return {
        ...p,
        amountMin: editMin ? parseInt(editMin) : null,
        amountMax: editMax ? parseInt(editMax) : null,
      }
    })
    savePatterns(updated)
    setPatterns(updated)
    setEditingId(null)
  }

  const handleDelete = (id: string) => {
    deletePattern(id)
    setPatterns(getPatterns())
  }

  const handleExport = () => {
    const data = exportPatterns()
    const blob = new Blob([data], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `パターン学習_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
  }

  const handleImport = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const text = await file.text()
      const count = importPatterns(text)
      setPatterns(getPatterns())
      alert(`${count}件のパターンをインポートしました`)
    }
    input.click()
  }

  const handleClear = () => {
    if (confirm('すべてのパターン学習データを削除しますか？')) {
      clearPatterns()
      setPatterns([])
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800">学習済みパターン一覧 ({patterns.length}件)</h2>
          <div className="flex items-center gap-2">
            <button onClick={handleImport} className="px-3 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200">インポート</button>
            <button onClick={handleExport} className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200">エクスポート</button>
            <button onClick={handleClear} className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200">全削除</button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-gray-100">
              <tr>
                <th className="px-3 py-2 text-left border-b border-gray-300 font-medium">通帳摘要（元）</th>
                <th className="px-3 py-2 text-left border-b border-gray-300 font-medium">仕訳内容</th>
                <th className="px-3 py-2 text-center border-b border-gray-300 font-medium w-28">金額下限</th>
                <th className="px-3 py-2 text-center border-b border-gray-300 font-medium w-28">金額上限</th>
                <th className="px-3 py-2 text-center border-b border-gray-300 font-medium w-16">回数</th>
                <th className="px-3 py-2 text-center border-b border-gray-300 font-medium w-16">操作</th>
              </tr>
            </thead>
            <tbody>
              {patterns.map((p) => (
                <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <span className="font-medium text-gray-800">{p.keyword}</span>
                  </td>
                  <td className="px-3 py-2">
                    {p.lines.map((line, i) => (
                      <div key={i} className="text-xs text-gray-600 flex gap-2">
                        <span className="font-medium text-gray-800">{line.debitCode}</span>
                        <span>{line.debitName}</span>
                        <span className="font-medium text-gray-800">{line.creditCode}</span>
                        <span>{line.creditName}</span>
                        {line.description && <span className="text-gray-500">{line.description}</span>}
                      </div>
                    ))}
                    {p.lines.length > 1 && (
                      <span className="text-xs text-violet-600 font-medium">（複合仕訳 {p.lines.length}行）</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {editingId === p.id ? (
                      <input type="text" value={editMin} onChange={(e) => setEditMin(e.target.value)}
                        className="w-20 px-1 py-0.5 text-xs border border-gray-300 rounded text-right" placeholder="なし" />
                    ) : (
                      <span className="text-xs text-gray-600">
                        {p.amountMin != null ? p.amountMin.toLocaleString() : '—'}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {editingId === p.id ? (
                      <input type="text" value={editMax} onChange={(e) => setEditMax(e.target.value)}
                        className="w-20 px-1 py-0.5 text-xs border border-gray-300 rounded text-right" placeholder="なし" />
                    ) : (
                      <span className="text-xs text-gray-600">
                        {p.amountMax != null ? p.amountMax.toLocaleString() : '—'}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center text-xs text-gray-500">{p.useCount}</td>
                  <td className="px-3 py-2 text-center">
                    {editingId === p.id ? (
                      <button onClick={() => handleSaveRange(p.id)}
                        className="text-xs text-blue-600 hover:underline">保存</button>
                    ) : (
                      <div className="flex items-center gap-1 justify-center">
                        <button onClick={() => {
                          setEditingId(p.id)
                          setEditMin(p.amountMin != null ? String(p.amountMin) : '')
                          setEditMax(p.amountMax != null ? String(p.amountMax) : '')
                        }} className="text-xs text-blue-600 hover:underline">編集</button>
                        <button onClick={() => handleDelete(p.id)}
                          className="text-xs text-red-600 hover:underline">削除</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {patterns.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-gray-400">
                    パターンがまだ学習されていません。<br />
                    仕訳を作成してCSV出力すると自動的に学習されます。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-3 border-t border-gray-200">
          <button onClick={onClose}
            className="px-4 py-2 text-sm bg-gray-100 rounded hover:bg-gray-200">閉じる</button>
        </div>
      </div>
    </div>
  )
}
