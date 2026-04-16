import { formatAmount, formatBalance } from '../lib/balance'
import type { CashEntry, BankEntry } from '../lib/types'

// ===== 現金出納帳テーブル =====

interface CashTableProps {
  entries: CashEntry[]
  carryOver: number
  onEdit: (index: number) => void
  onDelete: (index: number) => void
}

export function CashTransactionTable({ entries, carryOver, onEdit, onDelete }: CashTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-100 text-gray-600">
            <th className="px-3 py-2 text-left w-24">日付</th>
            <th className="px-3 py-2 text-left">摘要</th>
            <th className="px-3 py-2 text-left w-28">取引先</th>
            <th className="px-3 py-2 text-right w-28">収入</th>
            <th className="px-3 py-2 text-right w-28">支出</th>
            <th className="px-3 py-2 text-right w-28">残高</th>
            <th className="px-3 py-2 w-16"></th>
          </tr>
        </thead>
        <tbody>
          {/* 前月繰越行 */}
          <tr className="bg-gray-50 font-medium">
            <td className="px-3 py-2"></td>
            <td className="px-3 py-2 text-gray-500">前月繰越</td>
            <td className="px-3 py-2"></td>
            <td className="px-3 py-2"></td>
            <td className="px-3 py-2"></td>
            <td className="px-3 py-2 text-right">{formatBalance(carryOver)}</td>
            <td className="px-3 py-2"></td>
          </tr>

          {entries.length === 0 && (
            <tr>
              <td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                取引がまだありません。下のフォームから入力してください。
              </td>
            </tr>
          )}

          {entries.map((entry, i) => (
            <tr
              key={entry.id}
              className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
            >
              <td className="px-3 py-2 text-gray-600">{formatDate(entry.date)}</td>
              <td className="px-3 py-2">{entry.description}</td>
              <td className="px-3 py-2 text-gray-500 text-xs">{entry.counterparty}</td>
              <td className="px-3 py-2 text-right text-blue-600 font-medium">
                {formatAmount(entry.income)}
              </td>
              <td className="px-3 py-2 text-right text-red-600 font-medium">
                {formatAmount(entry.expense)}
              </td>
              <td className="px-3 py-2 text-right font-medium">{formatBalance(entry.balance)}</td>
              <td className="px-3 py-2">
                <div className="flex gap-1">
                  <button
                    onClick={() => onEdit(i)}
                    className="text-gray-400 hover:text-blue-500 text-xs"
                    title="編集"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => onDelete(i)}
                    className="text-gray-400 hover:text-red-500 text-xs"
                    title="削除"
                  >
                    削除
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ===== 通帳記録テーブル =====

interface BankTableProps {
  entries: BankEntry[]
  carryOver: number
  onEdit: (index: number) => void
  onDelete: (index: number) => void
}

export function BankTransactionTable({ entries, carryOver, onEdit, onDelete }: BankTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-100 text-gray-600">
            <th className="px-3 py-2 text-left w-24">日付</th>
            <th className="px-3 py-2 text-left">摘要（通帳）</th>
            <th className="px-3 py-2 text-left">取引内容</th>
            <th className="px-3 py-2 text-right w-28">入金</th>
            <th className="px-3 py-2 text-right w-28">出金</th>
            <th className="px-3 py-2 text-right w-28">残高</th>
            <th className="px-3 py-2 w-16"></th>
          </tr>
        </thead>
        <tbody>
          <tr className="bg-gray-50 font-medium">
            <td className="px-3 py-2"></td>
            <td className="px-3 py-2 text-gray-500">前月繰越</td>
            <td className="px-3 py-2"></td>
            <td className="px-3 py-2"></td>
            <td className="px-3 py-2"></td>
            <td className="px-3 py-2 text-right">{formatBalance(carryOver)}</td>
            <td className="px-3 py-2"></td>
          </tr>

          {entries.length === 0 && (
            <tr>
              <td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                取引がまだありません。下のフォームから入力してください。
              </td>
            </tr>
          )}

          {entries.map((entry, i) => (
            <tr
              key={entry.id}
              className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
            >
              <td className="px-3 py-2 text-gray-600">{formatDate(entry.date)}</td>
              <td className="px-3 py-2 text-xs">{entry.passbookDescription}</td>
              <td className="px-3 py-2 font-medium">{entry.transactionType}</td>
              <td className="px-3 py-2 text-right text-blue-600 font-medium">
                {formatAmount(entry.deposit)}
              </td>
              <td className="px-3 py-2 text-right text-red-600 font-medium">
                {formatAmount(entry.withdrawal)}
              </td>
              <td className="px-3 py-2 text-right font-medium">{formatBalance(entry.balance)}</td>
              <td className="px-3 py-2">
                <div className="flex gap-1">
                  <button
                    onClick={() => onEdit(i)}
                    className="text-gray-400 hover:text-blue-500 text-xs"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => onDelete(i)}
                    className="text-gray-400 hover:text-red-500 text-xs"
                  >
                    削除
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ヘルパー
function formatDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-')
  return `${parseInt(m)}/${parseInt(d)}`
}
