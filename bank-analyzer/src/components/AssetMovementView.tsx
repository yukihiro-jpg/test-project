'use client'

import { useState } from 'react'
import type { AssetMovementTable, ParsedPassbook } from '@/types'
import { toWareki } from '@/lib/wareki'
import { SUMMARY_PATTERNS, findSummaryPattern } from '@/lib/summary-patterns'

type Props = {
  table: AssetMovementTable
  passbooks: ParsedPassbook[]
  summaryPatternId: string
  onSummaryPatternChange: (id: string) => void
  onConclusionChange: (rowId: string, value: number) => void
  onRemarksChange: (rowId: string, value: string) => void
  onRemoveRow?: (rowId: string) => void
}

const fmt = (n: number) => {
  if (!n) return ''
  return n < 0 ? `△${Math.abs(n).toLocaleString()}` : n.toLocaleString()
}

function ConclusionInput({
  value,
  onChange
}: {
  value: number
  onChange: (v: number) => void
}) {
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState<string>('')
  const display = focused
    ? draft
    : value
    ? value < 0
      ? `△${Math.abs(value).toLocaleString()}`
      : value.toLocaleString()
    : ''
  return (
    <input
      type="text"
      inputMode="numeric"
      value={display}
      onFocus={() => {
        setFocused(true)
        setDraft(value ? String(value) : '')
      }}
      onBlur={() => {
        setFocused(false)
        const cleaned = draft.replace(/[,，]/g, '').replace(/△/g, '-')
        const n = Number(cleaned)
        onChange(isNaN(n) ? 0 : n)
      }}
      onChange={(e) => setDraft(e.target.value)}
      className="w-32 border border-slate-200 rounded px-1 py-0.5 text-right"
    />
  )
}

export function AssetMovementView({
  table,
  passbooks,
  summaryPatternId,
  onSummaryPatternChange,
  onConclusionChange,
  onRemarksChange,
  onRemoveRow
}: Props) {
  const map = new Map(passbooks.map((p) => [p.passbookId, p]))

  const conclusionTotal = table.rows.reduce((acc, r) => acc + (r.conclusionAmount || 0), 0)
  const colspanLeft = 1 + table.passbookOrder.length * 2
  const summaryText = findSummaryPattern(summaryPatternId).text

  return (
    <div className="space-y-3">
      <section className="bg-slate-50 border border-slate-200 rounded p-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm font-bold text-slate-700">調査結果サマリー文:</label>
          <select
            value={summaryPatternId}
            onChange={(e) => onSummaryPatternChange(e.target.value)}
            className="border border-slate-300 rounded px-2 py-1 text-sm bg-white"
          >
            {SUMMARY_PATTERNS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <span className="text-xs text-slate-500">
            選択した文章は Excel 出力の表ヘッダ上に挿入されます
          </span>
        </div>
        <div className="bg-white border border-slate-200 rounded p-3 text-sm text-slate-800 whitespace-pre-line leading-relaxed">
          {summaryText}
        </div>
      </section>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border">
        <thead>
          <tr className="bg-slate-800 text-white">
            <th rowSpan={4} className="px-2 py-1 border align-bottom">日付</th>
            {table.passbookOrder.map((id) => {
              const pb = map.get(id)
              return (
                <th key={`bank-${id}`} colSpan={2} className="px-2 py-1 border text-center">
                  {pb?.bankName || ''} {pb?.branchName || ''}
                </th>
              )
            })}
            <th rowSpan={3} className="px-2 py-1 border align-middle">結論</th>
            <th rowSpan={4} className="px-2 py-1 border align-bottom">備考</th>
            <th rowSpan={4} className="px-2 py-1 border align-bottom w-16">操作</th>
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
            {table.passbookOrder.map((id) => {
              const pb = map.get(id)
              return (
                <th key={`purpose-${id}`} colSpan={2} className="px-2 py-1 border text-center text-xs">
                  用途: {pb?.purpose || '-'}
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
              <td colSpan={4 + table.passbookOrder.length * 2} className="px-2 py-4 text-center text-slate-500 border">
                計上対象の取引がありません
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
                <ConclusionInput
                  value={row.conclusionAmount || 0}
                  onChange={(v) => onConclusionChange(row.id, v)}
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
              <td className="px-1 py-0.5 border text-center">
                <button
                  type="button"
                  onClick={() => onRemoveRow?.(row.id)}
                  disabled={!onRemoveRow}
                  className="px-2 py-0.5 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-slate-300"
                  title="この行を一覧表から削除"
                >
                  ✕削除
                </button>
              </td>
            </tr>
          ))}
        </tbody>
        {table.rows.length > 0 && (
          <tfoot>
            <tr className="bg-slate-100 font-bold">
              <td colSpan={colspanLeft} className="px-2 py-2 border text-right">
                合計
              </td>
              <td className="px-2 py-2 border text-right">{fmt(conclusionTotal)}</td>
              <td className="px-2 py-2 border" />
              <td className="px-2 py-2 border" />
            </tr>
          </tfoot>
        )}
      </table>
      </div>
    </div>
  )
}
