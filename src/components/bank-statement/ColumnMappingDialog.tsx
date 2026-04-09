'use client'

import { useState } from 'react'
import type { RawTableRow, ColumnMapping } from '@/lib/bank-statement/types'

interface Props {
  rawPages: RawTableRow[][]
  onConfirm: (mapping: ColumnMapping) => void
  onCancel: () => void
}

const COLUMN_ROLES = [
  { key: 'dateColumn', label: '日付', color: 'bg-blue-100 border-blue-400' },
  { key: 'descriptionColumn', label: '摘要', color: 'bg-green-100 border-green-400' },
  { key: 'depositColumn', label: '入金', color: 'bg-yellow-100 border-yellow-400' },
  { key: 'withdrawalColumn', label: '出金', color: 'bg-red-100 border-red-400' },
  { key: 'balanceColumn', label: '残高', color: 'bg-purple-100 border-purple-400' },
] as const

export default function ColumnMappingDialog({ rawPages, onConfirm, onCancel }: Props) {
  const [mapping, setMapping] = useState<Record<string, number>>({
    dateColumn: -1,
    descriptionColumn: -1,
    depositColumn: -1,
    withdrawalColumn: -1,
    balanceColumn: -1,
  })

  // サンプルデータ（最初のページの最初の20行）
  const sampleRows = rawPages[0]?.slice(0, 20) || []
  const maxCols = Math.max(...sampleRows.map((r) => r.cells.length), 0)

  const handleColumnClick = (colIndex: number, roleKey: string) => {
    setMapping((prev) => ({
      ...prev,
      [roleKey]: prev[roleKey] === colIndex ? -1 : colIndex,
    }))
  }

  const getColumnRole = (colIndex: number): string | null => {
    for (const [key, value] of Object.entries(mapping)) {
      if (value === colIndex) return key
    }
    return null
  }

  const getColumnColor = (colIndex: number): string => {
    const role = getColumnRole(colIndex)
    if (!role) return ''
    return COLUMN_ROLES.find((r) => r.key === role)?.color || ''
  }

  const canConfirm =
    mapping.dateColumn >= 0 &&
    mapping.balanceColumn >= 0 &&
    (mapping.depositColumn >= 0 || mapping.withdrawalColumn >= 0)

  const handleConfirm = () => {
    onConfirm({
      dateColumn: mapping.dateColumn,
      descriptionColumn: mapping.descriptionColumn,
      depositColumn: mapping.depositColumn >= 0 ? mapping.depositColumn : mapping.withdrawalColumn,
      withdrawalColumn: mapping.withdrawalColumn >= 0 ? mapping.withdrawalColumn : mapping.depositColumn,
      balanceColumn: mapping.balanceColumn,
    })
  }

  const [activeRole, setActiveRole] = useState<string>('dateColumn')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-800">列のマッピング</h2>
          <p className="text-sm text-gray-500 mt-1">
            自動検出できませんでした。各列の役割を指定してください。
          </p>
        </div>

        <div className="p-4 border-b border-gray-100">
          <div className="flex gap-2 flex-wrap">
            {COLUMN_ROLES.map((role) => (
              <button
                key={role.key}
                onClick={() => setActiveRole(role.key)}
                className={`px-3 py-1.5 text-sm rounded border ${
                  activeRole === role.key
                    ? `${role.color} border-2 font-bold`
                    : 'bg-gray-50 border-gray-200 text-gray-600'
                } ${mapping[role.key] >= 0 ? 'ring-2 ring-offset-1' : ''}`}
              >
                {role.label}
                {mapping[role.key] >= 0 && ` (列${mapping[role.key] + 1})`}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            上のボタンで役割を選択してから、下のテーブルで該当する列のヘッダーをクリックしてください
          </p>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                {Array.from({ length: maxCols }, (_, i) => (
                  <th
                    key={i}
                    onClick={() => handleColumnClick(i, activeRole)}
                    className={`border border-gray-300 px-2 py-2 cursor-pointer hover:bg-blue-50 transition-colors ${getColumnColor(i)}`}
                  >
                    <div className="text-center">
                      <span className="block text-gray-400">列{i + 1}</span>
                      {getColumnRole(i) && (
                        <span className="block font-bold text-gray-700 mt-0.5">
                          {COLUMN_ROLES.find((r) => r.key === getColumnRole(i))?.label}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sampleRows.map((row, rowIdx) => (
                <tr key={rowIdx} className="hover:bg-gray-50">
                  {Array.from({ length: maxCols }, (_, colIdx) => (
                    <td
                      key={colIdx}
                      className={`border border-gray-200 px-2 py-1 ${getColumnColor(colIdx)}`}
                    >
                      {row.cells[colIdx] || ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-gray-200 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200"
          >
            キャンセル
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className={`flex-1 py-2 text-sm font-medium rounded-lg ${
              canConfirm
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            確定
          </button>
        </div>
      </div>
    </div>
  )
}
