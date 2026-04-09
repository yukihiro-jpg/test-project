'use client'

import type { JournalEntry } from '@/lib/bank-statement/types'
import { downloadCsv } from '@/lib/bank-statement/csv-generator'

interface Props {
  entries: JournalEntry[]
}

export default function CsvExportButton({ entries }: Props) {
  const handleExport = () => {
    if (entries.length === 0) {
      alert('エクスポートする仕訳データがありません')
      return
    }
    downloadCsv(entries)
  }

  return (
    <button
      onClick={handleExport}
      className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded"
    >
      CSV出力
    </button>
  )
}
