'use client'

import type { StatementPage } from '@/lib/bank-statement/types'

interface Props {
  page: StatementPage
}

export default function BalanceInfo({ page }: Props) {
  return (
    <div className="px-4 py-3 bg-white border-t border-gray-200 shrink-0">
      <div className="flex items-center justify-between text-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <span className="text-gray-500">開始残高:</span>
            <span className="font-medium text-gray-800">
              &yen;{page.openingBalance.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-gray-500">終了残高:</span>
            <span className="font-medium text-gray-800">
              &yen;{page.closingBalance.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="text-right">
          {page.isBalanceValid ? (
            <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium">
              OK
            </span>
          ) : (
            <div>
              <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-medium">
                残高不一致
              </span>
              <p className="text-xs text-red-500 mt-1">
                差額: &yen;{Math.abs(page.balanceDifference).toLocaleString()}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
