'use client'

import { useEffect, useState } from 'react'
import { getProcessingStatuses, formatLastDate, type ProcessingStatus } from '@/lib/bank-statement/processing-status-store'

interface Props {
  clientId: string | null
  refreshKey?: number
}

export default function ProcessingStatusTable({ clientId, refreshKey }: Props) {
  const [statuses, setStatuses] = useState<ProcessingStatus[]>([])

  useEffect(() => {
    setStatuses(getProcessingStatuses())
  }, [clientId, refreshKey])

  if (statuses.length === 0) {
    return (
      <div className="mt-4 text-xs text-gray-400 text-center">
        まだ処理履歴がありません。通帳・現金出納帳などをアップロードして一時保存すると、ここに科目別の最終処理日が表示されます。
      </div>
    )
  }

  // 最終処理日の降順でソート
  const sorted = [...statuses].sort((a, b) => b.lastDate.localeCompare(a.lastDate))

  return (
    <div className="mt-6 max-w-3xl mx-auto">
      <div className="text-sm font-bold text-gray-700 mb-2">前回までの処理状況（科目コード別）</div>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 border-b border-gray-200">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-700 w-20">科目CD</th>
              <th className="px-3 py-2 text-left font-medium text-gray-700">科目名</th>
              <th className="px-3 py-2 text-center font-medium text-gray-700 w-32">最終処理日</th>
              <th className="px-3 py-2 text-center font-medium text-gray-700 w-20">件数</th>
              <th className="px-3 py-2 text-right font-medium text-gray-700 w-36">更新日時</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => (
              <tr key={s.accountCode} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-2 font-bold text-gray-800">{s.accountCode}</td>
                <td className="px-3 py-2 text-gray-700">{s.accountName || '—'}</td>
                <td className="px-3 py-2 text-center text-gray-800 font-medium">{formatLastDate(s.lastDate)}</td>
                <td className="px-3 py-2 text-center text-gray-500 text-xs">{s.transactionCount ?? '—'}</td>
                <td className="px-3 py-2 text-right text-xs text-gray-400">
                  {s.lastUpdated ? new Date(s.lastUpdated).toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
