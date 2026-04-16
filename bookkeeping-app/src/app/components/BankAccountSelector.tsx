import { useState } from 'react'
import type { BankAccount } from '../lib/types'
import { v4 as uuidv4 } from 'uuid'

interface Props {
  accounts: BankAccount[]
  selectedAccountId: string | null
  onSelect: (accountId: string) => void
  onAddAccount: (account: BankAccount) => void
}

export default function BankAccountSelector({
  accounts,
  selectedAccountId,
  onSelect,
  onAddAccount,
}: Props) {
  const [showForm, setShowForm] = useState(false)
  const [bankName, setBankName] = useState('')
  const [branchName, setBranchName] = useState('')
  const [accountType, setAccountType] = useState('普通')
  const [accountNumber, setAccountNumber] = useState('')
  const [openingBalance, setOpeningBalance] = useState('')

  function handleAdd() {
    if (!bankName.trim() || !accountNumber.trim()) return

    const account: BankAccount = {
      id: uuidv4(),
      bankName: bankName.trim(),
      branchName: branchName.trim(),
      accountType,
      accountNumber: accountNumber.trim(),
      openingBalance: parseInt(openingBalance) || 0,
    }
    onAddAccount(account)
    setBankName('')
    setBranchName('')
    setAccountType('普通')
    setAccountNumber('')
    setOpeningBalance('')
    setShowForm(false)
  }

  function getDisplayName(a: BankAccount): string {
    return `${a.bankName} ${a.branchName} ${a.accountType} ${a.accountNumber}`
  }

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap">
        {accounts.map((account) => (
          <button
            key={account.id}
            onClick={() => onSelect(account.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedAccountId === account.id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            {getDisplayName(account)}
          </button>
        ))}
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 rounded-lg text-sm font-medium border border-dashed border-gray-300 text-gray-500 hover:bg-gray-50 hover:border-gray-400"
        >
          + 口座を追加
        </button>
      </div>

      {showForm && (
        <div className="mt-3 bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-sm font-medium text-gray-700 mb-3">新しい銀行口座を登録</div>
          <div className="grid grid-cols-5 gap-3">
            <div>
              <label className="text-xs text-gray-500">銀行名</label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="〇〇銀行"
                className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">支店名</label>
              <input
                type="text"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                placeholder="〇〇支店"
                className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">種別</label>
              <select
                value={accountType}
                onChange={(e) => setAccountType(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm"
              >
                <option value="普通">普通</option>
                <option value="当座">当座</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">口座番号</label>
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="1234567"
                className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">期首残高</label>
              <input
                type="number"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                placeholder="0"
                className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm text-right"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              キャンセル
            </button>
            <button
              onClick={handleAdd}
              disabled={!bankName.trim() || !accountNumber.trim()}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
            >
              登録する
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
