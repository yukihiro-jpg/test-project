'use client'

import { useState } from 'react'

type Props = {
  keywords: string[]
  onChange: (next: string[]) => void
}

export function AtmKeywordsEditor({ keywords, onChange }: Props) {
  const [input, setInput] = useState('')
  const [open, setOpen] = useState(false)

  const add = () => {
    const v = input.trim()
    if (!v) return
    if (keywords.includes(v)) return
    onChange([...keywords, v])
    setInput('')
  }

  const remove = (kw: string) => onChange(keywords.filter((k) => k !== kw))

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-sm text-slate-700 font-medium"
      >
        {open ? '▼' : '▶'} ATM出金判定キーワード（{keywords.length}件）
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-slate-500">これらのキーワードが摘要に含まれる場合、備考欄を「不明金」と判定します。</p>
          <div className="flex flex-wrap gap-1">
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
            <button type="button" onClick={add} className="bg-slate-700 text-white px-3 py-1 rounded text-sm hover:bg-slate-800">
              追加
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
