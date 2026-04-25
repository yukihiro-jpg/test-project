'use client'

import { useState } from 'react'

export type UploadItem = {
  id: string
  file: File
  label: string
  bankName: string
  branchName: string
  accountNumber: string
}

type Props = {
  startDate: string
  endDate: string
  onStartDateChange: (v: string) => void
  onEndDateChange: (v: string) => void
  items: UploadItem[]
  onItemsChange: (items: UploadItem[]) => void
  onAnalyze: () => void
  analyzing: boolean
}

export function UploadForm({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  items,
  onItemsChange,
  onAnalyze,
  analyzing
}: Props) {
  const [dragOver, setDragOver] = useState(false)

  const addFiles = (files: File[]) => {
    const newItems: UploadItem[] = files
      .filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))
      .map((f) => ({
        id: `${f.name}-${f.size}-${Date.now()}-${Math.random()}`,
        file: f,
        label: f.name.replace(/\.pdf$/i, ''),
        bankName: '',
        branchName: '',
        accountNumber: ''
      }))
    onItemsChange([...items, ...newItems])
  }

  const updateItem = (id: string, patch: Partial<UploadItem>) => {
    onItemsChange(items.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  }

  const removeItem = (id: string) => {
    onItemsChange(items.filter((it) => it.id !== id))
  }

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-lg shadow p-5 space-y-3">
        <h2 className="font-bold text-lg">①解析期間を指定</h2>
        <div className="flex flex-wrap gap-4 items-end">
          <label className="flex flex-col text-sm">
            <span className="mb-1 text-slate-600">開始日</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="border border-slate-300 rounded px-3 py-2"
            />
          </label>
          <label className="flex flex-col text-sm">
            <span className="mb-1 text-slate-600">終了日</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              className="border border-slate-300 rounded px-3 py-2"
            />
          </label>
        </div>
      </section>

      <section className="bg-white rounded-lg shadow p-5 space-y-3">
        <h2 className="font-bold text-lg">②通帳PDFをアップロード（複数可）</h2>
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            addFiles(Array.from(e.dataTransfer.files))
          }}
          className={`border-2 border-dashed rounded p-8 text-center transition ${
            dragOver ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50'
          }`}
        >
          <p className="text-slate-600 mb-2">PDFファイルをドラッグ＆ドロップ、または</p>
          <label className="inline-block bg-slate-700 text-white px-4 py-2 rounded cursor-pointer hover:bg-slate-800">
            ファイルを選択
            <input
              type="file"
              accept="application/pdf"
              multiple
              className="hidden"
              onChange={(e) => addFiles(Array.from(e.target.files || []))}
            />
          </label>
        </div>

        {items.length > 0 && (
          <div className="space-y-3">
            {items.map((it) => (
              <div key={it.id} className="border rounded p-3 bg-slate-50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-700">{it.file.name}</span>
                  <button
                    type="button"
                    onClick={() => removeItem(it.id)}
                    className="text-red-600 text-sm hover:underline"
                  >
                    削除
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                  <input
                    type="text"
                    placeholder="ラベル（例: 礼子通帳）"
                    value={it.label}
                    onChange={(e) => updateItem(it.id, { label: e.target.value })}
                    className="border border-slate-300 rounded px-2 py-1 text-sm"
                  />
                  <input
                    type="text"
                    placeholder="銀行名（例: ゆうちょ銀行）"
                    value={it.bankName}
                    onChange={(e) => updateItem(it.id, { bankName: e.target.value })}
                    className="border border-slate-300 rounded px-2 py-1 text-sm"
                  />
                  <input
                    type="text"
                    placeholder="支店名"
                    value={it.branchName}
                    onChange={(e) => updateItem(it.id, { branchName: e.target.value })}
                    className="border border-slate-300 rounded px-2 py-1 text-sm"
                  />
                  <input
                    type="text"
                    placeholder="口座番号"
                    value={it.accountNumber}
                    onChange={(e) => updateItem(it.id, { accountNumber: e.target.value })}
                    className="border border-slate-300 rounded px-2 py-1 text-sm"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white rounded-lg shadow p-5 space-y-3">
        <h2 className="font-bold text-lg">③解析を実行</h2>
        <button
          type="button"
          disabled={analyzing || items.length === 0 || !startDate || !endDate}
          onClick={onAnalyze}
          className="bg-blue-600 text-white px-6 py-3 rounded font-bold hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
        >
          {analyzing ? '解析中...' : `${items.length}件を解析する`}
        </button>
      </section>
    </div>
  )
}
