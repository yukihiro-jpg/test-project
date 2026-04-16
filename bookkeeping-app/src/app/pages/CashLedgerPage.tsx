import { useState, useEffect } from 'react'
import type { AppConfig, CashEntry } from '../lib/types'
import { validateCashEntry } from '../lib/validation'
import { getTotalIncome, getTotalExpense, getClosingBalance } from '../lib/balance'
import { useCashTransactions } from '../hooks/useTransactions'
import { useSuggestions } from '../hooks/useSuggestions'
import { CASH_DESCRIPTION_EXAMPLES } from '../lib/presets'
import MonthSelector, { generateMonthOptions, getCurrentMonthKey } from '../components/MonthSelector'
import BalanceSummary from '../components/BalanceSummary'
import { CashTransactionTable } from '../components/TransactionTable'
import { CashTransactionForm, type CashFormData } from '../components/TransactionForm'
import ReconcileModal from '../components/ReconcileModal'
import ExportButton from '../components/ExportButton'
import { exportCashLedger } from '../lib/ipc'
import type { ValidationError } from '../lib/validation'

interface Props {
  config: AppConfig
}

export default function CashLedgerPage({ config }: Props) {
  const monthOptions = generateMonthOptions(config.fiscalYearStart)
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey())
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [showReconcile, setShowReconcile] = useState(false)
  const [errors, setErrors] = useState<ValidationError[]>([])

  const { data, loading, loadMonth, addEntry, updateEntry, deleteEntry, setCarryOver, setReconciliation } =
    useCashTransactions()

  const {
    getSuggestedDescriptions,
    getCounterpartySuggestions,
    learnCashEntry,
  } = useSuggestions()

  const [counterpartyInput, setCounterpartyInput] = useState('')

  useEffect(() => {
    loadMonth(selectedMonth)
  }, [selectedMonth, loadMonth])

  function handleMonthChange(month: string) {
    setSelectedMonth(month)
    setEditingIndex(null)
    setErrors([])
  }

  async function handleSubmit(formData: CashFormData) {
    const entry: Partial<CashEntry> = {
      date: formData.date,
      description: formData.description,
      counterparty: formData.counterparty,
      income: formData.income ? parseInt(formData.income) : null,
      expense: formData.expense ? parseInt(formData.expense) : null,
    }

    const validationErrors = validateCashEntry(entry, selectedMonth)
    if (validationErrors.length > 0) {
      setErrors(validationErrors)
      return
    }
    setErrors([])

    if (editingIndex != null) {
      await updateEntry(editingIndex, entry)
      setEditingIndex(null)
    } else {
      await addEntry(entry as Omit<CashEntry, 'id' | 'balance' | 'createdAt' | 'updatedAt'>)
    }

    // 推測入力学習
    if (formData.counterparty) {
      await learnCashEntry(formData.counterparty, formData.description)
    }
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

  const entries = data?.entries ?? []
  const carryOver = data?.carryOver ?? 0
  const totalIncome = getTotalIncome(entries)
  const totalExpense = getTotalExpense(entries)
  const closingBalance = getClosingBalance(entries, carryOver)

  const editingEntry = editingIndex != null ? entries[editingIndex] : null
  const editFormData: CashFormData | undefined = editingEntry
    ? {
        date: editingEntry.date,
        description: editingEntry.description,
        counterparty: editingEntry.counterparty,
        income: editingEntry.income?.toString() ?? '',
        expense: editingEntry.expense?.toString() ?? '',
      }
    : undefined

  const descSuggestions = counterpartyInput
    ? getSuggestedDescriptions(counterpartyInput)
    : CASH_DESCRIPTION_EXAMPLES

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-800">現金出納帳</h1>
        <div className="flex items-center gap-3">
          <ExportButton
            onExport={() => exportCashLedger(selectedMonth, config.companyName)}
          />
          <button
            onClick={() => setShowReconcile(true)}
            className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 text-sm font-medium"
          >
            残高確認
          </button>
        </div>
      </div>

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
          totalIn={totalIncome}
          totalOut={totalExpense}
          closingBalance={closingBalance}
        />
      </div>

      {/* 実査結果表示 */}
      {data?.reconciliation && (
        <div
          className={`mb-4 px-4 py-3 rounded-lg text-sm ${
            data.reconciliation.difference === 0
              ? 'bg-green-50 text-green-700'
              : 'bg-yellow-50 text-yellow-700'
          }`}
        >
          最終確認: {new Date(data.reconciliation.date).toLocaleDateString('ja-JP')}
          {data.reconciliation.difference === 0
            ? ' - 残高一致 OK'
            : ` - 差額 ${data.reconciliation.difference.toLocaleString()}円`}
        </div>
      )}

      {/* 取引一覧 */}
      {loading ? (
        <div className="py-8 text-center text-gray-400">読み込み中...</div>
      ) : (
        <div className="mb-4 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <CashTransactionTable
            entries={entries}
            carryOver={carryOver}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </div>
      )}

      {/* 入力フォーム */}
      <CashTransactionForm
        month={selectedMonth}
        initialData={editFormData}
        onSubmit={handleSubmit}
        onCancel={editingIndex != null ? () => { setEditingIndex(null); setErrors([]) } : undefined}
        errors={errors}
        counterpartySuggestions={getCounterpartySuggestions()}
        descriptionSuggestions={descSuggestions}
        onCounterpartyChange={setCounterpartyInput}
      />

      {/* 実査モーダル */}
      {showReconcile && (
        <ReconcileModal
          bookBalance={closingBalance}
          onConfirm={async (actual) => {
            await setReconciliation(actual)
            setShowReconcile(false)
          }}
          onClose={() => setShowReconcile(false)}
        />
      )}
    </div>
  )
}
