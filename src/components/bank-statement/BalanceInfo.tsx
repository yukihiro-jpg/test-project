'use client'

import type { StatementPage, JournalEntry } from '@/lib/bank-statement/types'

interface Props {
  page: StatementPage
  entries?: JournalEntry[]
  bankAccountCode?: string
}

export default function BalanceInfo({ page, entries, bankAccountCode }: Props) {
  const { openingBalance, closingBalance } = page

  // 仕訳データがあれば仕訳から入出金を計算（動的再検証）
  let totalDeposit = 0
  let totalWithdrawal = 0

  if (entries && bankAccountCode) {
    // 現在のページに属する仕訳から計算
    const pageEntries = entries.filter((e) =>
      page.transactions.some((t) => t.id === e.transactionId),
    )
    for (const entry of pageEntries) {
      const amount = entry.debitAmount || entry.creditAmount || 0
      if (entry.debitCode === bankAccountCode) {
        totalDeposit += amount
      } else if (entry.creditCode === bankAccountCode) {
        totalWithdrawal += amount
      }
    }
  } else {
    // 仕訳がなければ取引データから計算
    totalDeposit = page.transactions.reduce((sum, t) => sum + (t.deposit ?? 0), 0)
    totalWithdrawal = page.transactions.reduce((sum, t) => sum + (t.withdrawal ?? 0), 0)
  }

  const calculatedClosing = openingBalance + totalDeposit - totalWithdrawal
  const difference = calculatedClosing - closingBalance
  const isValid = Math.abs(difference) < 1

  return (
    <div className="px-4 py-3 bg-slate-50 border-t border-slate-300 shrink-0">
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <div className="space-y-0.5">
          <div className="flex justify-between">
            <span className="text-gray-500">開始残高:</span>
            <span className="font-medium text-gray-800">&yen;{openingBalance.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">入金合計:</span>
            <span className="font-medium text-blue-700">+&yen;{totalDeposit.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">出金合計:</span>
            <span className="font-medium text-red-600">-&yen;{totalWithdrawal.toLocaleString()}</span>
          </div>
        </div>

        <div className="space-y-0.5">
          <div className="flex justify-between">
            <span className="text-gray-500">計算残高:</span>
            <span className={`font-medium ${isValid ? 'text-gray-800' : 'text-red-600'}`}>
              &yen;{calculatedClosing.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">通帳残高:</span>
            <span className="font-medium text-gray-800">&yen;{closingBalance.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500">検証:</span>
            {isValid ? (
              <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-bold">
                OK 一致
              </span>
            ) : (
              <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-bold">
                不一致 &yen;{Math.abs(difference).toLocaleString()}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
