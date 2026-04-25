'use client'

import type { ParsedPassbook, Transaction } from '@/types'
import { toWarekiShort } from '@/lib/wareki'
import { PdfViewer } from './PdfViewer'

type Props = {
  passbook: ParsedPassbook
  pdfUrl?: string
  includedTxIds?: Set<string>
  onChange: (next: ParsedPassbook) => void
  onAddTx?: (txId: string) => void
}

const fmt = (n: number) => (n ? n.toLocaleString() : '')

export function PassbookEditor({ passbook, pdfUrl, includedTxIds, onChange, onAddTx }: Props) {
  const updateTx = (id: string, patch: Partial<Transaction>) => {
    onChange({
      ...passbook,
      transactions: passbook.transactions.map((tx) => (tx.id === id ? { ...tx, ...patch } : tx))
    })
  }
  const updatePurpose = (purpose: string) => {
    onChange({ ...passbook, purpose })
  }

  const computedEnd = passbook.transactions.reduce(
    (acc, tx) => acc + tx.deposit - tx.withdrawal,
    passbook.startBalance ?? 0
  )
  const declaredEnd = passbook.endBalance ?? 0
  const balanceOk = Math.abs(computedEnd - declaredEnd) < 0.5

  const meta = (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 text-sm">
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

      <label className="block text-sm">
        <span className="text-slate-500">用途（金融資産異動一覧表のヘッダに表示）</span>
        <input
          type="text"
          value={passbook.purpose || ''}
          onChange={(e) => updatePurpose(e.target.value)}
          placeholder="例: 生活費、事業資金"
          className="mt-1 w-full border border-slate-300 rounded px-2 py-1"
        />
      </label>

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
    </div>
  )

  const dataPanel = (
    <div className="flex flex-col h-full min-h-0">
      <div className="mb-3 flex-shrink-0">{meta}</div>
      <div className="flex-1 min-h-0 overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-700 text-white sticky top-0 z-10">
            <tr>
              <th className="px-2 py-1 text-center" title="金融資産異動一覧表への計上">計上</th>
              <th className="px-2 py-1 text-left">日付</th>
              <th className="px-2 py-1 text-left">摘要</th>
              <th className="px-2 py-1 text-right">入金</th>
              <th className="px-2 py-1 text-right">出金</th>
              <th className="px-2 py-1 text-right">残高</th>
              <th className="px-2 py-1 text-left">備考</th>
            </tr>
          </thead>
          <tbody>
            {passbook.transactions.map((tx) => {
              const isIncluded = includedTxIds?.has(tx.id) ?? false
              return (
              <tr key={tx.id} className={`border-t ${isIncluded ? 'bg-amber-50' : 'hover:bg-slate-50'}`}>
                <td className="px-1 py-0.5 text-center">
                  {isIncluded ? (
                    <span
                      className="inline-flex items-center justify-center w-7 h-6 rounded bg-amber-200 text-amber-900 font-bold text-xs"
                      title="一覧表に計上中（一覧表側で削除できます）"
                    >
                      ✓
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onAddTx?.(tx.id)}
                      disabled={!onAddTx}
                      className="px-2 py-0.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-slate-300"
                      title="金融資産異動一覧表に追加"
                    >
                      ＋追加
                    </button>
                  )}
                </td>
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
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ height: '80vh', minHeight: 600 }}>
      <div className="h-full min-h-0">
        {pdfUrl ? (
          <PdfViewer pdfUrl={pdfUrl} />
        ) : (
          <div className="h-full flex items-center justify-center text-slate-400 border rounded bg-slate-50">
            PDFが読み込まれていません
          </div>
        )}
      </div>
      <div className="h-full min-h-0">{dataPanel}</div>
    </div>
  )
}
