import { useState, useEffect } from 'react'
import type { AppConfig, PageType, BankAccount, CashLedgerMonth, BankBookMonth } from '../lib/types'
import { formatBalance } from '../lib/balance'
import { readCashMonth, readBankAccounts, readBankMonth } from '../lib/ipc'
import { getCurrentMonthKey } from '../components/MonthSelector'

interface Props {
  config: AppConfig
  onNavigate: (page: PageType) => void
}

interface DashboardData {
  cashBalance: number
  cashIncome: number
  cashExpense: number
  bankBalances: { account: BankAccount; balance: number }[]
  recentCashEntries: { date: string; description: string; amount: number; isIncome: boolean }[]
}

export default function DashboardPage({ config, onNavigate }: Props) {
  const [data, setData] = useState<DashboardData | null>(null)
  const currentMonth = getCurrentMonthKey()

  useEffect(() => {
    async function load() {
      // 現金出納帳の今月データ
      const cashData = await readCashMonth(currentMonth)
      const cashBalance = cashData?.entries.length
        ? cashData.entries[cashData.entries.length - 1].balance
        : cashData?.carryOver ?? 0
      const cashIncome = cashData?.entries.reduce((sum, e) => sum + (e.income ?? 0), 0) ?? 0
      const cashExpense = cashData?.entries.reduce((sum, e) => sum + (e.expense ?? 0), 0) ?? 0

      // 直近の現金取引
      const recentCashEntries = (cashData?.entries ?? [])
        .slice(-5)
        .reverse()
        .map((e) => ({
          date: e.date,
          description: e.description,
          amount: (e.income ?? 0) || (e.expense ?? 0),
          isIncome: (e.income ?? 0) > 0,
        }))

      // 銀行口座の残高
      const accounts = await readBankAccounts()
      const bankBalances: { account: BankAccount; balance: number }[] = []
      for (const account of accounts) {
        const bankData = await readBankMonth(account.id, currentMonth)
        const balance = bankData?.entries.length
          ? bankData.entries[bankData.entries.length - 1].balance
          : bankData?.carryOver ?? account.openingBalance
        bankBalances.push({ account, balance })
      }

      setData({
        cashBalance,
        cashIncome,
        cashExpense,
        bankBalances,
        recentCashEntries,
      })
    }
    load()
  }, [currentMonth])

  const monthLabel = (() => {
    const [y, m] = currentMonth.split('-')
    return `${y}年${parseInt(m)}月`
  })()

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-xl font-bold text-gray-800 mb-2">
        {config.companyName}
      </h1>
      <p className="text-sm text-gray-500 mb-6">{monthLabel}の概況</p>

      {!data ? (
        <div className="py-8 text-center text-gray-400">読み込み中...</div>
      ) : (
        <>
          {/* メインカード */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <DashboardCard
              label="現金残高"
              amount={data.cashBalance}
              onClick={() => onNavigate('cash-ledger')}
              color="green"
            />
            <DashboardCard
              label={`${monthLabel} 収入`}
              amount={data.cashIncome}
              color="blue"
            />
            <DashboardCard
              label={`${monthLabel} 支出`}
              amount={data.cashExpense}
              color="red"
            />
          </div>

          {/* 銀行口座残高 */}
          {data.bankBalances.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-medium text-gray-600 mb-3">銀行口座残高</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {data.bankBalances.map(({ account, balance }) => (
                  <button
                    key={account.id}
                    onClick={() => onNavigate('bank-book')}
                    className="bg-white rounded-xl border border-gray-200 p-4 text-left hover:border-blue-300 transition-colors"
                  >
                    <div className="text-xs text-gray-500 mb-1">
                      {account.bankName} {account.branchName}
                    </div>
                    <div className="text-xs text-gray-400 mb-2">
                      {account.accountType} {account.accountNumber}
                    </div>
                    <div className="text-lg font-bold text-gray-800">
                      {formatBalance(balance)}
                      <span className="text-xs ml-0.5 font-normal">円</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 直近の取引 */}
          <div className="mb-6">
            <h2 className="text-sm font-medium text-gray-600 mb-3">直近の現金取引</h2>
            {data.recentCashEntries.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
                <p className="mb-3">まだ取引が入力されていません</p>
                <button
                  onClick={() => onNavigate('cash-ledger')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                >
                  現金出納帳を開く
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {data.recentCashEntries.map((entry, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-0"
                  >
                    <div>
                      <span className="text-xs text-gray-400 mr-2">
                        {entry.date.split('-').slice(1).join('/')}
                      </span>
                      <span className="text-sm">{entry.description}</span>
                    </div>
                    <span
                      className={`font-medium text-sm ${
                        entry.isIncome ? 'text-blue-600' : 'text-red-600'
                      }`}
                    >
                      {entry.isIncome ? '+' : '-'}{entry.amount.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* クイックアクション */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => onNavigate('cash-ledger')}
              className="bg-white rounded-xl border border-gray-200 p-4 text-center hover:border-blue-300 transition-colors"
            >
              <div className="text-2xl mb-1">💴</div>
              <div className="text-sm font-medium">現金出納帳を入力</div>
            </button>
            <button
              onClick={() => onNavigate('bank-book')}
              className="bg-white rounded-xl border border-gray-200 p-4 text-center hover:border-blue-300 transition-colors"
            >
              <div className="text-2xl mb-1">🏦</div>
              <div className="text-sm font-medium">通帳を入力</div>
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function DashboardCard({
  label,
  amount,
  onClick,
  color,
}: {
  label: string
  amount: number
  onClick?: () => void
  color: 'green' | 'blue' | 'red'
}) {
  const colorMap = {
    green: 'bg-green-50 border-green-200 text-green-800',
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    red: 'bg-red-50 border-red-200 text-red-800',
  }

  const Component = onClick ? 'button' : 'div'
  return (
    <Component
      onClick={onClick}
      className={`rounded-xl border p-5 text-left ${colorMap[color]} ${
        onClick ? 'hover:shadow-md transition-shadow cursor-pointer' : ''
      }`}
    >
      <div className="text-xs font-medium opacity-70 mb-1">{label}</div>
      <div className="text-2xl font-bold">
        {formatBalance(amount)}
        <span className="text-sm ml-0.5 font-normal">円</span>
      </div>
    </Component>
  )
}
