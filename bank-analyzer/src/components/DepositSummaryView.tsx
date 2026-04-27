'use client'

import type { DepositRow } from '@/types'
import { NumberInput } from './FormattedInputs'
import { toWareki } from '@/lib/wareki'

type Props = {
  rows: DepositRow[]
  referenceDate: string
  onReferenceDateChange: (v: string) => void
  onRowChange: (id: string, patch: Partial<DepositRow>) => void
  onAddBlankRow: () => void
  onRemoveRow: (id: string) => void
}

const fmt = (n: number) => (n ? n.toLocaleString() : '0')

export function DepositSummaryView({
  rows,
  referenceDate,
  onReferenceDateChange,
  onRowChange,
  onAddBlankRow,
  onRemoveRow
}: Props) {
  const totalAmount = rows.reduce((s, r) => s + (r.amount || 0), 0)
  const totalInterest = rows.reduce((s, r) => s + (r.accruedInterest || 0), 0)
  const grandTotal = totalAmount + totalInterest

  return (
    <div className="space-y-3">
      <section className="bg-slate-50 border border-slate-200 rounded p-3 flex flex-wrap items-center gap-3">
        <label className="text-sm font-bold text-slate-700">基準日:</label>
        <input
          type="text"
          value={referenceDate}
          onChange={(e) => onReferenceDateChange(e.target.value)}
          placeholder="例: 2026-02-20 または 令和8年2月20日"
          className="border border-slate-300 rounded px-2 py-1 text-sm w-56 font-mono"
        />
        {referenceDate && (
          <span className="text-xs text-slate-600">和暦: {toWareki(referenceDate)}</span>
        )}
        <button
          type="button"
          onClick={onAddBlankRow}
          className="ml-auto text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
        >
          ＋ 行を手動追加
        </button>
      </section>

      <h3 className="font-bold text-base">預金一覧</h3>
      <div className="overflow-x-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-800 text-white">
            <tr>
              <th className="px-2 py-1 border border-slate-700 text-left w-32">銀行名</th>
              <th className="px-2 py-1 border border-slate-700 text-left w-28">支店名</th>
              <th className="px-2 py-1 border border-slate-700 text-left w-28">種類</th>
              <th className="px-2 py-1 border border-slate-700 text-left w-32">口座番号</th>
              <th className="px-2 py-1 border border-slate-700 text-right w-32">金額</th>
              <th className="px-2 py-1 border border-slate-700 text-right w-28">経過利息</th>
              <th className="px-2 py-1 border border-slate-700 text-center w-20">残証有無</th>
              <th className="px-2 py-1 border border-slate-700 text-left">備考</th>
              <th className="px-2 py-1 border border-slate-700 text-center w-14">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-2 py-6 text-center text-slate-400 border bg-white"
                >
                  まだ預金行がありません。残高証明書をアップロードするか、右上の「＋
                  行を手動追加」ボタンで追加してください。
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t hover:bg-slate-50 bg-white">
                  <td className="px-1 py-0.5 border">
                    <input
                      type="text"
                      value={r.bankName}
                      onChange={(e) => onRowChange(r.id, { bankName: e.target.value })}
                      className="w-full border border-slate-200 rounded px-1 py-0.5"
                    />
                  </td>
                  <td className="px-1 py-0.5 border">
                    <input
                      type="text"
                      value={r.branchName}
                      onChange={(e) => onRowChange(r.id, { branchName: e.target.value })}
                      className="w-full border border-slate-200 rounded px-1 py-0.5"
                    />
                  </td>
                  <td className="px-1 py-0.5 border">
                    <input
                      type="text"
                      value={r.accountType}
                      onChange={(e) => onRowChange(r.id, { accountType: e.target.value })}
                      className="w-full border border-slate-200 rounded px-1 py-0.5"
                    />
                  </td>
                  <td className="px-1 py-0.5 border">
                    <input
                      type="text"
                      value={r.accountNumber}
                      onChange={(e) => onRowChange(r.id, { accountNumber: e.target.value })}
                      className="w-full border border-slate-200 rounded px-1 py-0.5"
                    />
                  </td>
                  <td className="px-1 py-0.5 border">
                    <NumberInput
                      value={r.amount || 0}
                      onChange={(v) => onRowChange(r.id, { amount: v })}
                    />
                  </td>
                  <td className="px-1 py-0.5 border">
                    <NumberInput
                      value={r.accruedInterest || 0}
                      onChange={(v) => onRowChange(r.id, { accruedInterest: v })}
                    />
                  </td>
                  <td className="px-1 py-0.5 border text-center">
                    <input
                      type="checkbox"
                      checked={r.hasCertificate}
                      onChange={(e) => onRowChange(r.id, { hasCertificate: e.target.checked })}
                      className="w-4 h-4"
                    />
                  </td>
                  <td className="px-1 py-0.5 border">
                    <input
                      type="text"
                      value={r.remarks}
                      onChange={(e) => onRowChange(r.id, { remarks: e.target.value })}
                      className="w-full border border-slate-200 rounded px-1 py-0.5"
                    />
                  </td>
                  <td className="px-1 py-0.5 border text-center">
                    <button
                      type="button"
                      onClick={() => onRemoveRow(r.id)}
                      className="px-2 py-0.5 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                      title="この行を削除"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="bg-slate-100 font-bold">
                <td colSpan={4} className="px-2 py-2 border text-right">
                  計
                </td>
                <td className="px-2 py-2 border text-right">{fmt(totalAmount)}</td>
                <td className="px-2 py-2 border text-right">{fmt(totalInterest)}</td>
                <td className="px-2 py-2 border" />
                <td className="px-2 py-2 border" />
                <td className="px-2 py-2 border" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {rows.length > 0 && (
        <div className="flex justify-end">
          <div className="border border-slate-700 px-4 py-2 bg-white inline-flex items-center gap-4">
            <span className="font-bold">合計（金額＋経過利息）:</span>
            <span className="font-bold text-lg">{fmt(grandTotal)} 円</span>
          </div>
        </div>
      )}
    </div>
  )
}
