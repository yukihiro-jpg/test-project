'use client'

import type { JournalEntry, PatternLine } from '@/lib/bank-statement/types'

interface Props {
  open: boolean
  targetEntries: JournalEntry[] // 反映対象の仕訳
  patternLines: PatternLine[]    // 適用するパターン内容
  onConfirm: () => void
  onCancel: () => void
}

export default function ApplyPatternDialog({
  open, targetEntries, patternLines, onConfirm, onCancel,
}: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[85vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-800">パターン反映の確認</h2>
          <p className="text-sm text-gray-600 mt-1">
            以下の <span className="font-bold text-blue-600">{targetEntries.length}件</span> の仕訳に学習パターンを反映します。よろしいですか？
          </p>
        </div>

        {/* 適用パターン表示 */}
        <div className="px-6 py-3 bg-blue-50 border-b border-blue-200">
          <div className="text-xs font-bold text-blue-800 mb-1">適用するパターン</div>
          <table className="w-full text-xs border-collapse">
            <thead><tr className="text-blue-700">
              <th className="text-left py-0.5 pr-2">借方CD</th><th className="text-left py-0.5 pr-2">借方科目</th>
              <th className="text-left py-0.5 pr-2">貸方CD</th><th className="text-left py-0.5 pr-2">貸方科目</th>
              <th className="text-left py-0.5">摘要</th>
            </tr></thead>
            <tbody>{patternLines.map((line, i) => (
              <tr key={i}>
                <td className="py-0.5 pr-2 font-bold text-gray-800">{line.debitCode}</td>
                <td className="py-0.5 pr-2 text-gray-700">{line.debitName}</td>
                <td className="py-0.5 pr-2 font-bold text-gray-800">{line.creditCode}</td>
                <td className="py-0.5 pr-2 text-gray-700">{line.creditName}</td>
                <td className="py-0.5 text-gray-600">{line.description}</td>
              </tr>
            ))}</tbody>
          </table>
          {patternLines.length > 1 && (
            <span className="text-xs text-violet-600 font-medium">（複合仕訳 {patternLines.length}行に展開されます）</span>
          )}
        </div>

        {/* 反映対象一覧 */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-gray-100">
              <tr>
                <th className="px-3 py-2 text-left border-b border-gray-300 font-medium w-24">日付</th>
                <th className="px-3 py-2 text-left border-b border-gray-300 font-medium">通帳摘要（元）</th>
                <th className="px-3 py-2 text-right border-b border-gray-300 font-medium w-28">金額</th>
                <th className="px-3 py-2 text-left border-b border-gray-300 font-medium">借方CD</th>
                <th className="px-3 py-2 text-left border-b border-gray-300 font-medium">貸方CD</th>
              </tr>
            </thead>
            <tbody>
              {targetEntries.map((entry) => {
                const amount = entry.debitAmount || entry.creditAmount || 0
                return (
                  <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-1.5 text-xs">{entry.date}</td>
                    <td className="px-3 py-1.5 text-xs text-gray-700">{entry.originalDescription}</td>
                    <td className="px-3 py-1.5 text-xs text-right font-medium tabular-nums">
                      {amount.toLocaleString()}
                    </td>
                    <td className="px-3 py-1.5 text-xs text-gray-700">{entry.debitCode || '—'}</td>
                    <td className="px-3 py-1.5 text-xs text-gray-700">{entry.creditCode || '—'}
                    </td>
                  </tr>
                )
              })}
              {targetEntries.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-gray-400">
                    反映対象の仕訳がありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-3 border-t border-gray-200 flex gap-2">
          <button onClick={onCancel}
            className="flex-1 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200">
            キャンセル
          </button>
          <button onClick={onConfirm} disabled={targetEntries.length === 0}
            className="flex-1 py-2 text-sm bg-blue-600 text-white font-medium rounded hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">
            反映する
          </button>
        </div>
      </div>
    </div>
  )
}
