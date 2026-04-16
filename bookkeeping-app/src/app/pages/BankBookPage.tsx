import { useState, useEffect } from 'react'
import type { AppConfig, BankAccount, BankEntry } from '../lib/types'
import { validateBankEntry } from '../lib/validation'
import { getTotalDeposit, getTotalWithdrawal, getClosingBalance } from '../lib/balance'
import { useBankTransactions } from '../hooks/useTransactions'
import { useSuggestions } from '../hooks/useSuggestions'
import { readBankAccounts, saveBankAccounts, exportBankBook } from '../lib/ipc'
import MonthSelector, { generateMonthOptions, getCurrentMonthKey } from '../components/MonthSelector'
import BalanceSummary from '../components/BalanceSummary'
import { BankTransactionTable } from '../components/TransactionTable'
import { BankTransactionForm, type BankFormData } from '../components/TransactionForm'
import BankAccountSelector from '../components/BankAccountSelector'
import ExportButton from '../components/ExportButton'
import type { ValidationError } from '../lib/validation'

interface Props {
  config: AppConfig
}

export default function BankBookPage({ config }: Props) {
  const monthOptions = generateMonthOptions(config.fiscalYearStart)
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey())
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [errors, setErrors] = useState<ValidationError[]>([])

  const { data, loading, loadMonth, addEntry, updateEntry, deleteEntry, setCarryOver } =
    useBankTransactions()

  const {
    getSuggestedTransactionTypes,
    getSuggestedTypeFromDescription,
    getCounterpartySuggestions,
    learnBankEntry,
  } = useSuggestions()

  const [counterpartyInput, setCounterpartyInput] = useState('')

  // 口座一覧読み込み
  useEffect(() => {
    readBankAccounts().then((accs) => {
      setAccounts(accs)
      if (accs.length > 0 && !selectedAccountId) {
        setSelectedAccountId(accs[0].id)
      }
    })
  }, [])

  // 月/口座変更時にデータ読み込み
  useEffect(() => {
    if (selectedAccountId) {
      const account = accounts.find((a) => a.id === selectedAccountId)
      const defaultCarryOver = account?.openingBalance ?? 0
      loadMonth(selectedAccountId, selectedMonth, defaultCarryOver)
    }
  }, [selectedMonth, selectedAccountId, loadMonth, accounts])

  async function handleAddAccount(account: BankAccount) {
    const updated = [...accounts, account]
    await saveBankAccounts(updated)
    setAccounts(updated)
    setSelectedAccountId(account.id)
  }

  function handleMonthChange(month: string) {
    setSelectedMonth(month)
    setEditingIndex(null)
    setErrors([])
  }

  async function handleSubmit(formData: BankFormData) {
    const entry: Partial<BankEntry> = {
      date: formData.date,
      passbookDescription: formData.passbookDescription,
      transactionType: formData.transactionType,
      counterparty: formData.counterparty,
      deposit: formData.deposit ? parseInt(formData.deposit) : null,
      withdrawal: formData.withdrawal ? parseInt(formData.withdrawal) : null,
    }

    const validationErrors = validateBankEntry(entry, selectedMonth)
    if (validationErrors.length > 0) {
      setErrors(validationErrors)
      return
    }
    setErrors([])

    if (editingIndex != null) {
      await updateEntry(editingIndex, entry)
      setEditingIndex(null)
    } else {
      await addEntry(entry as Omit<BankEntry, 'id' | 'balance' | 'createdAt' | 'updatedAt'>)
    }

    // 推測入力学習
    await learnBankEntry(
      formData.counterparty,
      formData.passbookDescription,
      formData.transactionType
    )
  }

  async function handleDelete(index: number) {
    if (confirm('この取引を削除してもよろしいですか？')) {
      await deleteEntry(index)
    }
  }

  function handleEdit(index: number) {
    setEditingIndex(index)
    setErrors([])
  }

  function handlePassbookDescChange(value: string) {
    const suggested = getSuggestedTypeFromDescription(value)
    if (suggested) {
      // 自動入力（ユーザーが空の場合のみ）
      // Note: This is handled by the form internally for now
    }
  }

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId)
  const accountName = selectedAccount
    ? `${selectedAccount.bankName} ${selectedAccount.branchName} ${selectedAccount.accountType} ${selectedAccount.accountNumber}`
    : ''

  const entries = data?.entries ?? []
  const carryOver = data?.carryOver ?? 0
  const totalDeposit = getTotalDeposit(entries)
  const totalWithdrawal = getTotalWithdrawal(entries)
  const closingBalance = getClosingBalance(entries, carryOver)

  const editingEntry = editingIndex != null ? entries[editingIndex] : null
  const editFormData: BankFormData | undefined = editingEntry
    ? {
        date: editingEntry.date,
        passbookDescription: editingEntry.passbookDescription,
        transactionType: editingEntry.transactionType,
        counterparty: editingEntry.counterparty,
        deposit: editingEntry.deposit?.toString() ?? '',
        withdrawal: editingEntry.withdrawal?.toString() ?? '',
      }
    : undefined

  return (
    <div className="p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-800">通帳記録</h1>
        {selectedAccountId && (
          <ExportButton
            onExport={() =>
              exportBankBook(selectedAccountId!, selectedMonth, config.companyName, accountName)
            }
          />
        )}
      </div>

      {/* 口座選択 */}
      <div className="mb-4">
        <BankAccountSelector
          accounts={accounts}
          selectedAccountId={selectedAccountId}
          onSelect={setSelectedAccountId}
          onAddAccount={handleAddAccount}
        />
      </div>

      {!selectedAccountId ? (
        <div className="py-16 text-center text-gray-400">
          <p className="text-lg mb-2">銀行口座が登録されていません</p>
          <p className="text-sm">上の「+ 口座を追加」ボタンから口座を登録してください</p>
        </div>
      ) : (
        <>
          {/* 月選択 */}
          <div className="mb-4">
            <MonthSelector
              months={monthOptions}
              selectedMonth={selectedMonth}
              onSelect={handleMonthChange}
            />
          </div>

          {/* 前月繰越設定 */}
          <div className="mb-4 flex items-center gap-2 text-sm">
            <span className="text-gray-600">前月繰越:</span>
            <input
              type="number"
              value={carryOver}
              onChange={(e) => setCarryOver(parseInt(e.target.value) || 0)}
              className="w-32 border border-gray-300 rounded px-2 py-1 text-right text-sm"
            />
            <span className="text-gray-400">円</span>
          </div>

          {/* サマリー */}
          <div className="mb-4">
            <BalanceSummary
              carryOver={carryOver}
              totalIn={totalDeposit}
              totalOut={totalWithdrawal}
              closingBalance={closingBalance}
              inLabel="入金合計"
              outLabel="出金合計"
            />
          </div>

          {/* 取引一覧 */}
          {loading ? (
            <div className="py-8 text-center text-gray-400">読み込み中...</div>
          ) : (
            <div className="mb-4 bg-white rounded-xl border border-gray-200 overflow-hidden">
              <BankTransactionTable
                entries={entries}
                carryOver={carryOver}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            </div>
          )}

          {/* 入力フォーム */}
          <BankTransactionForm
            month={selectedMonth}
            initialData={editFormData}
            onSubmit={handleSubmit}
            onCancel={editingIndex != null ? () => { setEditingIndex(null); setErrors([]) } : undefined}
            errors={errors}
            counterpartySuggestions={getCounterpartySuggestions()}
            typeSuggestions={getSuggestedTransactionTypes(counterpartyInput)}
            onCounterpartyChange={setCounterpartyInput}
            onPassbookDescChange={handlePassbookDescChange}
          />
        </>
      )}
    </div>
  )
}
