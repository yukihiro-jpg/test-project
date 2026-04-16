import { useState } from 'react'
import { formatBalance } from '../lib/balance'

interface Props {
  bookBalance: number
  onConfirm: (actualBalance: number) => void
  onClose: () => void
}

export default function ReconcileModal({ bookBalance, onConfirm, onClose }: Props) {
  const [amount, setAmount] = useState('')
  const actualBalance = amount ? parseInt(amount, 10) : null
  const difference = actualBalance != null ? actualBalance - bookBalance : null

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-bold text-gray-800 mb-4">現金残高の確認</h3>
        <p className="text-sm text-gray-600 mb-4">
          手元の現金を数えて、実際の残高を入力してください。
        </p>

        <div className="bg-gray-50 rounded-xl p-4 mb-4">
          <div className="text-xs text-gray-500 mb-1">帳簿上の残高</div>
          <div className="text-2xl font-bold">{formatBalance(bookBalance)} 円</div>
        </div>

        <label className="block mb-4">
          <span className="text-sm font-medium text-gray-700">実際の現金残高</span>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="手元の現金額を入力"
            min="0"
            className="mt-1 w-full border border-gray-300 rounded-lg px-4 py-3 text-lg text-right focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
        </label>

        {difference != null && !isNaN(difference) && (
          <div
            className={`rounded-xl p-4 mb-4 ${
              difference === 0
                ? 'bg-green-50 text-green-700'
                : 'bg-yellow-50 text-yellow-700'
            }`}
          >
            {difference === 0 ? (
              <div className="text-center">
                <div className="text-2xl mb-1">OK</div>
                <div className="text-sm font-medium">帳簿残高と一致しています</div>
              </div>
            ) : (
              <div>
                <div className="text-sm font-medium mb-1">差額があります</div>
                <div className="text-xl font-bold">
                  {difference > 0 ? '+' : ''}{formatBalance(difference)} 円
                </div>
                <p className="text-xs mt-2 opacity-80">
                  {difference > 0
                    ? '実際の残高が帳簿より多くなっています。入力漏れがないかご確認ください。'
                    : '実際の残高が帳簿より少なくなっています。入力漏れがないかご確認ください。'}
                </p>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 py-2 rounded-lg hover:bg-gray-50 text-sm"
          >
            閉じる
          </button>
          <button
            onClick={() => {
              if (actualBalance != null && !isNaN(actualBalance)) {
                onConfirm(actualBalance)
              }
            }}
            disabled={actualBalance == null || isNaN(actualBalance)}
            className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
          >
            記録する
          </button>
        </div>
      </div>
    </div>
  )
}
