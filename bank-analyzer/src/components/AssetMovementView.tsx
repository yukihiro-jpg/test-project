'use client'

import type { AssetMovementTable, ParsedPassbook } from '@/types'
import { toWareki } from '@/lib/wareki'

type Props = {
  table: AssetMovementTable
  passbooks: ParsedPassbook[]
  onConclusionChange: (rowId: string, value: number) => void
  onRemarksChange: (rowId: string, value: string) => void
}

const fmt = (n: number) => {
  if (!n) return ''
  return n < 0 ? `△${Math.abs(n).toLocaleString()}` : n.toLocaleString()
}

export function AssetMovementView({ table, passbooks, onConclusionChange, onRemarksChange }: Props) {
  const map = new Map(passbooks.map((p) => [p.passbookId, p]))

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm border">
        <thead>
          <tr className="bg-slate-800 text-white">
            <th rowSpan={3} className="px-2 py-1 border align-bottom">日付</th>
            {table.passbookOrder.map((id) => {
              const pb = map.get(id)
              return (
                <th key={`bank-${id}`} colSpan={2} className="px-2 py-1 border text-center">
                  {pb?.bankName || ''} {pb?.branchName || ''}
                </th>
              )
            })}
            <th rowSpan={2} className="px-2 py-1 border align-middle">結論</th>
            <th rowSpan={3} className="px-2 py-1 border align-bottom">備考</th>
          </tr>
          <tr className="bg-slate-700 text-white">
            {table.passbookOrder.map((id) => {
              const pb = map.get(id)
              return (
                <th key={`acc-${id}`} colSpan={2} className="px-2 py-1 border text-center text-xs">
                  口座番号: {pb?.accountNumber || ''}
                </th>
              )
            })}
          </tr>
          <tr className="bg-slate-600 text-white">
            {table.passbookOrder.flatMap((id) => [
              <th key={`dep-${id}`} className="px-2 py-1 border text-xs">入金</th>,
              <th key={`wd-${id}`} className="px-2 py-1 border text-xs">出金</th>
            ])}
            <th className="px-2 py-1 border text-xs">相続財産計上額</th>
          </tr>
        </thead>
        <tbody>
          {table.rows.length === 0 && (
            <tr>
              <td colSpan={3 + table.passbookOrder.length * 2} className="px-2 py-4 text-center text-slate-500 border">
                50万円以上の取引がありません
              </td>
            </tr>
          )}
          {table.rows.map((row) => (
            <tr key={row.id} className={row.isFundTransfer ? 'bg-blue-50' : 'hover:bg-slate-50'}>
              <td className="px-2 py-1 border whitespace-nowrap">{toWareki(row.date)}</td>
              {table.passbookOrder.flatMap((id) => {
                const entry = row.passbookEntries[id] || { deposit: 0, withdrawal: 0 }
                return [
                  <td key={`d-${id}-${row.id}`} className="px-2 py-1 border text-right">
                    {fmt(entry.deposit)}
                  </td>,
                  <td key={`w-${id}-${row.id}`} className="px-2 py-1 border text-right">
                    {fmt(-entry.withdrawal)}
                  </td>
                ]
              })}
              <td className="px-1 py-0.5 border">
                <input
                  type="number"
                  value={row.conclusionAmount || ''}
                  onChange={(e) => onConclusionChange(row.id, Number(e.target.value) || 0)}
                  className="w-28 border border-slate-200 rounded px-1 py-0.5 text-right"
                />
              </td>
              <td className="px-1 py-0.5 border">
                <input
                  type="text"
                  value={row.remarks}
                  onChange={(e) => onRemarksChange(row.id, e.target.value)}
                  className="w-full min-w-[16rem] border border-slate-200 rounded px-1 py-0.5"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
