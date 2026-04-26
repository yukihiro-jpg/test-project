'use client'

import { useEffect, useState } from 'react'

type Props = {
  open: boolean
  keywords: string[]
  onChange: (next: string[]) => void
  onClose: () => void
}

export function AtmKeywordsModal({ open, keywords, onChange, onClose }: Props) {
  const [input, setInput] = useState('')

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const add = () => {
    const v = input.trim()
    if (!v) return
    if (keywords.includes(v)) return
    onChange([...keywords, v])
    setInput('')
  }

  const remove = (kw: string) => onChange(keywords.filter((k) => k !== kw))

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-lg p-5 w-full max-w-xl max-h-[80vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-lg">ATM出金判定キーワード（{keywords.length}件）</h2>
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
          これらのキーワードが摘要に含まれる取引のみを「不明金」として金融資産異動一覧表に自動計上します。
        </p>
        <div className="flex flex-wrap gap-1 mb-3">
          {keywords.map((kw) => (
            <span key={kw} className="inline-flex items-center bg-slate-100 px-2 py-1 rounded text-xs">
              {kw}
              <button type="button" onClick={() => remove(kw)} className="ml-1 text-red-600 hover:text-red-800">
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="新しいキーワード"
            className="border border-slate-300 rounded px-2 py-1 text-sm flex-1"
          />
          <button
            type="button"
            onClick={add}
            className="bg-slate-700 text-white px-3 py-1 rounded text-sm hover:bg-slate-800"
          >
            追加
          </button>
        </div>
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
