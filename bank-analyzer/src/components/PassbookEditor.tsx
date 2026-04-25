'use client'

import type { ParsedPassbook, Transaction } from '@/types'
import { toWarekiShort } from '@/lib/wareki'

type Props = {
  passbook: ParsedPassbook
  onChange: (next: ParsedPassbook) => void
}

const fmt = (n: number) => (n ? n.toLocaleString() : '')

export function PassbookEditor({ passbook, onChange }: Props) {
  const updateTx = (id: string, patch: Partial<Transaction>) => {
    onChange({
      ...passbook,
      transactions: passbook.transactions.map((tx) => (tx.id === id ? { ...tx, ...patch } : tx))
    })
  }

  const computedEnd = passbook.transactions.reduce(
    (acc, tx) => acc + tx.deposit - tx.withdrawal,
    passbook.startBalance ?? 0
  )
  const declaredEnd = passbook.endBalance ?? 0
  const balanceOk = Math.abs(computedEnd - declaredEnd) < 0.5

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div>
          <span className="text-slate-500">銀行名</span>
          <div className="font-medium">{passbook.bankName || '-'}</div>
        </div>
        <div>
          <span className="text-slate-500">支店</span>
          <div className="font-medium">{passbook.branchName || '-'}</div>
        </div>
        <div>
          <span className="text-slate-500">口座番号</span>
          <div className="font-medium">{passbook.accountNumber || '-'}</div>
        </div>
        <div>
          <span className="text-slate-500">ラベル</span>
          <div className="font-medium">{passbook.label}</div>
        </div>
      </div>

      <div className={`p-3 rounded text-sm ${balanceOk ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800'}`}>
        <div>開始残高: {fmt(passbook.startBalance ?? 0)} 円</div>
        <div>終了残高（申告）: {fmt(declaredEnd)} 円</div>
        <div>終了残高（計算上）: {fmt(computedEnd)} 円 {balanceOk ? '✓ 一致' : '⚠ 不一致'}</div>
        {passbook.warnings.length > 0 && (
          <ul className="mt-2 list-disc list-inside text-amber-900">
            {passbook.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border">
          <thead className="bg-slate-700 text-white">
            <tr>
              <th className="px-2 py-1 text-left">日付</th>
              <th className="px-2 py-1 text-left">摘要</th>
              <th className="px-2 py-1 text-right">入金</th>
              <th className="px-2 py-1 text-right">出金</th>
              <th className="px-2 py-1 text-right">残高</th>
              <th className="px-2 py-1 text-left">備考</th>
            </tr>
          </thead>
          <tbody>
            {passbook.transactions.map((tx) => (
              <tr key={tx.id} className="border-t hover:bg-slate-50">
                <td className="px-1 py-0.5">
                  <input
                    type="date"
                    value={tx.date}
                    onChange={(e) => updateTx(tx.id, { date: e.target.value })}
                    className="w-32 border border-slate-200 rounded px-1 py-0.5"
                  />
                  <div className="text-xs text-slate-500">{toWarekiShort(tx.date)}</div>
                </td>
                <td className="px-1 py-0.5">
                  <input
                    type="text"
                    value={tx.description}
                    onChange={(e) => updateTx(tx.id, { description: e.target.value })}
                    className="w-full border border-slate-200 rounded px-1 py-0.5"
                  />
                </td>
                <td className="px-1 py-0.5">
                  <input
                    type="number"
                    value={tx.deposit || ''}
                    onChange={(e) => updateTx(tx.id, { deposit: Number(e.target.value) || 0 })}
                    className="w-28 border border-slate-200 rounded px-1 py-0.5 text-right"
                  />
                </td>
                <td className="px-1 py-0.5">
                  <input
                    type="number"
                    value={tx.withdrawal || ''}
                    onChange={(e) => updateTx(tx.id, { withdrawal: Number(e.target.value) || 0 })}
                    className="w-28 border border-slate-200 rounded px-1 py-0.5 text-right"
                  />
                </td>
                <td className="px-1 py-0.5">
                  <input
                    type="number"
                    value={tx.balance || ''}
                    onChange={(e) => updateTx(tx.id, { balance: Number(e.target.value) || 0 })}
                    className="w-32 border border-slate-200 rounded px-1 py-0.5 text-right"
                  />
                </td>
                <td className="px-1 py-0.5">
                  <input
                    type="text"
                    value={tx.remarks || ''}
                    onChange={(e) => updateTx(tx.id, { remarks: e.target.value })}
                    className="w-full border border-slate-200 rounded px-1 py-0.5"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
