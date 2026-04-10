'use client'

import type { StatementPage } from '@/lib/bank-statement/types'

interface Props {
  page: StatementPage
}

export default function BalanceInfo({ page }: Props) {
  const { transactions, openingBalance, closingBalance } = page

  // 入金合計・出金合計を計算
  const totalDeposit = transactions.reduce((sum, t) => sum + (t.deposit ?? 0), 0)
  const totalWithdrawal = transactions.reduce((sum, t) => sum + (t.withdrawal ?? 0), 0)
  const calculatedClosing = openingBalance + totalDeposit - totalWithdrawal
  const difference = calculatedClosing - closingBalance
  const isValid = Math.abs(difference) < 1

  return (
    <div className="px-4 py-3 bg-white border-t border-gray-200 shrink-0">
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        {/* 左列: 残高情報 */}
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

        {/* 右列: 検証結果 */}
        <div className="space-y-0.5">
          <div className="flex justify-between">
            <span className="text-gray-500">計算残高:</span>
            <span className="font-medium text-gray-800">&yen;{calculatedClosing.toLocaleString()}</span>
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
                不一致 差額&yen;{Math.abs(difference).toLocaleString()}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
