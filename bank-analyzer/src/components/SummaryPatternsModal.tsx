'use client'

import { useEffect, useState } from 'react'
import {
  BUILT_IN_PATTERNS,
  generatePatternId,
  type SummaryPattern
} from '@/lib/summary-patterns'

type Props = {
  open: boolean
  customPatterns: SummaryPattern[]
  onChange: (next: SummaryPattern[]) => void
  onClose: () => void
}

export function SummaryPatternsModal({ open, customPatterns, onChange, onClose }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftLabel, setDraftLabel] = useState('')
  const [draftText, setDraftText] = useState('')

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const startNew = () => {
    setEditingId('new')
    setDraftLabel('')
    setDraftText('')
  }

  const startEdit = (p: SummaryPattern) => {
    setEditingId(p.id)
    setDraftLabel(p.label)
    setDraftText(p.text)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setDraftLabel('')
    setDraftText('')
  }

  const saveEdit = () => {
    const label = draftLabel.trim()
    const text = draftText.trimEnd()
    if (!label || !text) {
      alert('ラベルと本文の両方を入力してください')
      return
    }
    if (editingId === 'new') {
      onChange([...customPatterns, { id: generatePatternId(), label, text }])
    } else if (editingId) {
      onChange(customPatterns.map((p) => (p.id === editingId ? { ...p, label, text } : p)))
    }
    cancelEdit()
  }

  const remove = (id: string) => {
    if (!confirm('このパターンを削除します。よろしいですか？')) return
    onChange(customPatterns.filter((p) => p.id !== id))
    if (editingId === id) cancelEdit()
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-lg p-5 w-full max-w-3xl max-h-[88vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-lg">調査結果サマリー文の管理</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>

        <p className="text-xs text-slate-500 mb-3">
          ビルトインパターンは編集・削除できません。新規パターンを追加するか、自作パターンを編集してください。
        </p>

        <div className="mb-3">
          <button
            type="button"
            onClick={startNew}
            disabled={editingId === 'new'}
            className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 disabled:bg-slate-300"
          >
            ＋ 新規パターンを追加
          </button>
        </div>

        {editingId !== null && (
          <div className="border-2 border-blue-300 rounded p-3 mb-4 bg-blue-50 space-y-2">
            <div className="text-xs font-bold text-blue-800">
              {editingId === 'new' ? '新規パターン' : 'パターンを編集'}
            </div>
            <input
              type="text"
              value={draftLabel}
              onChange={(e) => setDraftLabel(e.target.value)}
              placeholder="ラベル（例: 不動産売却を含む案件）"
              className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
            />
            <textarea
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              placeholder="本文を入力。改行は Enter キー、段落の字下げには全角スペース「　」を行頭に。"
              rows={8}
              className="w-full border border-slate-300 rounded px-2 py-1 text-sm font-mono leading-relaxed"
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={cancelEdit}
                className="bg-slate-200 text-slate-800 px-3 py-1 rounded text-sm hover:bg-slate-300"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={saveEdit}
                className="bg-emerald-600 text-white px-3 py-1 rounded text-sm hover:bg-emerald-700"
              >
                保存
              </button>
            </div>
          </div>
        )}

        <h3 className="text-sm font-bold mt-4 mb-2 text-slate-700">登録済みパターン</h3>
        <ul className="space-y-2">
          {BUILT_IN_PATTERNS.map((p) => (
            <li key={p.id} className="border rounded p-3 bg-slate-50">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-sm">
                  {p.label}
                  <span className="ml-2 text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded">
                    ビルトイン
                  </span>
                </span>
              </div>
              <pre className="text-xs text-slate-700 whitespace-pre-wrap font-sans">{p.text}</pre>
            </li>
          ))}
          {customPatterns.map((p) => (
            <li key={p.id} className="border rounded p-3 bg-white">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-sm">
                  {p.label}
                  <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">自作</span>
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(p)}
                    className="text-xs bg-slate-700 text-white px-2 py-0.5 rounded hover:bg-slate-800"
                  >
                    編集
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(p.id)}
                    className="text-xs bg-red-600 text-white px-2 py-0.5 rounded hover:bg-red-700"
                  >
                    削除
                  </button>
                </div>
              </div>
              <pre className="text-xs text-slate-700 whitespace-pre-wrap font-sans">{p.text}</pre>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="bg-slate-200 text-slate-800 px-4 py-2 rounded text-sm hover:bg-slate-300"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  )
}
