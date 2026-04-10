'use client'

import { useEffect, useState } from 'react'
import type { PatternEntry } from '@/lib/bank-statement/types'
import { getPatterns } from '@/lib/bank-statement/pattern-store'

interface Props {
  open: boolean
  patternId: string | null
  onClose: () => void
}

export default function PatternDetailDialog({ open, patternId, onClose }: Props) {
  const [pattern, setPattern] = useState<PatternEntry | null>(null)

  useEffect(() => {
    if (open && patternId) {
      const patterns = getPatterns()
      setPattern(patterns.find((p) => p.id === patternId) || null)
    }
  }, [open, patternId])

  if (!open || !pattern) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800">
            <span className="text-amber-500">★</span> 学習パターン詳細
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl">&times;</button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <div className="text-xs text-gray-500 mb-1">通帳摘要（元）</div>
            <div className="text-sm font-medium text-gray-800">{pattern.keyword}</div>
          </div>

          <div>
            <div className="text-xs text-gray-500 mb-1">金額範囲</div>
            <div className="text-sm text-gray-800">
              {pattern.amountMin != null ? `¥${pattern.amountMin.toLocaleString()}` : '制限なし'}
              {' 〜 '}
              {pattern.amountMax != null ? `¥${pattern.amountMax.toLocaleString()}` : '制限なし'}
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-500 mb-1">仕訳内容</div>
            <div className="bg-gray-50 rounded-lg p-3 space-y-1">
              {pattern.lines.map((line, i) => (
                <div key={i} className="text-xs text-gray-700">
                  <span className="text-blue-700 font-bold">{line.debitCode}</span>
                  {' '}{line.debitName}
                  <span className="mx-2 text-gray-400">→</span>
                  <span className="text-blue-700 font-bold">{line.creditCode}</span>
                  {' '}{line.creditName}
                  {line.description && <div className="ml-4 text-gray-500">摘要: {line.description}</div>}
                </div>
              ))}
              {pattern.lines.length > 1 && (
                <div className="text-xs text-violet-600 font-medium pt-1">（複合仕訳 {pattern.lines.length}行）</div>
              )}
            </div>
          </div>

          <div className="text-xs text-gray-500">使用回数: {pattern.useCount}回</div>
        </div>

        <div className="px-5 py-3 border-t border-gray-200">
          <button onClick={onClose}
            className="w-full py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200">
            閉じる
          </button>
        </div>
      </div>
    </div>
  )
}
