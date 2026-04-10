'use client'

import { useState } from 'react'
import type { JournalEntry } from '@/lib/bank-statement/types'

interface Props {
  open: boolean
  entry: JournalEntry | null
  relatedEntries: JournalEntry[] // 複合仕訳の場合の全行
  onConfirm: (amountMin: number | null, amountMax: number | null, applyToAll: boolean) => void
  onCancel: () => void
}

export default function LearnPatternDialog({
  open, entry, relatedEntries, onConfirm, onCancel,
}: Props) {
  const [amountMin, setAmountMin] = useState('')
  const [amountMax, setAmountMax] = useState('')

  if (!open || !entry) return null

  const handleRegisterOnly = () => {
    const min = amountMin ? parseInt(amountMin.replace(/[^0-9]/g, '')) : null
    const max = amountMax ? parseInt(amountMax.replace(/[^0-9]/g, '')) : null
    onConfirm(min, max, false)
    setAmountMin(''); setAmountMax('')
  }

  const handleRegisterAndApply = () => {
    const min = amountMin ? parseInt(amountMin.replace(/[^0-9]/g, '')) : null
    const max = amountMax ? parseInt(amountMax.replace(/[^0-9]/g, '')) : null
    onConfirm(min, max, true)
    setAmountMin(''); setAmountMax('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-800">パターン学習</h2>
        </div>

        <div className="p-5 space-y-4">
          {/* 学習内容プレビュー */}
          <div className="p-3 bg-gray-50 rounded-lg text-sm">
            <div className="text-xs text-gray-500 mb-1">通帳摘要（元）</div>
            <div className="font-medium text-gray-800 mb-2">{entry.originalDescription || '—'}</div>
            <div className="text-xs text-gray-500 mb-1">学習する仕訳</div>
            {relatedEntries.map((e, i) => (
              <div key={i} className="text-xs text-gray-700">
                <span className="text-blue-700 font-bold">{e.debitCode}</span> {e.debitName}
                → <span className="text-blue-700 font-bold">{e.creditCode}</span> {e.creditName}
                {e.description && <span className="ml-2 text-gray-500">{e.description}</span>}
              </div>
            ))}
            {relatedEntries.length > 1 && (
              <span className="text-xs text-violet-600 font-medium">（複合仕訳 {relatedEntries.length}行）</span>
            )}
          </div>

          {/* 金額範囲設定 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              金額範囲（任意）— 空欄なら制限なし
            </label>
            <div className="flex items-center gap-2">
              <input type="text" value={amountMin} onChange={(e) => setAmountMin(e.target.value)}
                placeholder="下限" className="flex-1 px-2 py-1 text-sm text-right border border-gray-300 rounded" />
              <span className="text-sm text-gray-500">〜</span>
              <input type="text" value={amountMax} onChange={(e) => setAmountMax(e.target.value)}
                placeholder="上限" className="flex-1 px-2 py-1 text-sm text-right border border-gray-300 rounded" />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              この範囲内の金額のとき、このパターンが適用されます
            </p>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-200 flex gap-2">
          <button onClick={onCancel}
            className="flex-1 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200">
            キャンセル
          </button>
          <button onClick={handleRegisterOnly}
            className="flex-1 py-2 text-sm bg-blue-100 text-blue-700 font-medium rounded hover:bg-blue-200">
            登録のみ
          </button>
          <button onClick={handleRegisterAndApply}
            className="flex-1 py-2 text-sm bg-blue-600 text-white font-medium rounded hover:bg-blue-700">
            登録＋他データに反映
          </button>
        </div>
      </div>
    </div>
  )
}
