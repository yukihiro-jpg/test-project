import { useState, useRef, useEffect } from 'react'
import type { ValidationError } from '../lib/validation'

// ===== 現金出納帳入力フォーム =====

export interface CashFormData {
  date: string
  description: string
  counterparty: string
  income: string
  expense: string
}

interface CashFormProps {
  month: string
  initialData?: CashFormData
  onSubmit: (data: CashFormData) => void
  onCancel?: () => void
  errors: ValidationError[]
  counterpartySuggestions: string[]
  descriptionSuggestions: string[]
  onCounterpartyChange?: (value: string) => void
}

export function CashTransactionForm({
  month,
  initialData,
  onSubmit,
  onCancel,
  errors,
  counterpartySuggestions,
  descriptionSuggestions,
  onCounterpartyChange,
}: CashFormProps) {
  const defaultDate = `${month}-${String(new Date().getDate()).padStart(2, '0')}`
  const [form, setForm] = useState<CashFormData>(
    initialData || { date: defaultDate, description: '', counterparty: '', income: '', expense: '' }
  )
  const dateRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!initialData) {
      setForm({ date: defaultDate, description: '', counterparty: '', income: '', expense: '' })
    }
  }, [month])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit(form)
  }

  function getError(field: string): string | undefined {
    return errors.find((e) => e.field === field)?.message
  }

  function handleReset() {
    setForm({ date: defaultDate, description: '', counterparty: '', income: '', expense: '' })
    dateRef.current?.focus()
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="text-sm font-medium text-gray-700 mb-3">
        {initialData ? '取引を編集' : '新しい取引を追加'}
      </div>
      <div className="grid grid-cols-6 gap-3">
        <div className="col-span-1">
          <label className="text-xs text-gray-500">日付</label>
          <input
            ref={dateRef}
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className={`w-full border rounded-lg px-2 py-2 text-sm ${getError('date') ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
          />
          {getError('date') && <p className="text-xs text-red-500 mt-1">{getError('date')}</p>}
        </div>
        <div className="col-span-2">
          <label className="text-xs text-gray-500">摘要</label>
          <input
            type="text"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="例: 文房具購入"
            list="cash-desc-list"
            className={`w-full border rounded-lg px-2 py-2 text-sm ${getError('description') ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
          />
          <datalist id="cash-desc-list">
            {descriptionSuggestions.map((s) => <option key={s} value={s} />)}
          </datalist>
          {getError('description') && <p className="text-xs text-red-500 mt-1">{getError('description')}</p>}
        </div>
        <div className="col-span-1">
          <label className="text-xs text-gray-500">取引先</label>
          <input
            type="text"
            value={form.counterparty}
            onChange={(e) => {
              setForm({ ...form, counterparty: e.target.value })
              onCounterpartyChange?.(e.target.value)
            }}
            placeholder="相手先"
            list="cash-cp-list"
            className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm"
          />
          <datalist id="cash-cp-list">
            {counterpartySuggestions.map((s) => <option key={s} value={s} />)}
          </datalist>
        </div>
        <div className="col-span-1">
          <label className="text-xs text-gray-500">収入</label>
          <input
            type="number"
            value={form.income}
            onChange={(e) => setForm({ ...form, income: e.target.value, expense: '' })}
            placeholder="0"
            min="0"
            className={`w-full border rounded-lg px-2 py-2 text-sm text-right text-blue-600 ${getError('income') ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
          />
          {getError('income') && <p className="text-xs text-red-500 mt-1">{getError('income')}</p>}
        </div>
        <div className="col-span-1">
          <label className="text-xs text-gray-500">支出</label>
          <input
            type="number"
            value={form.expense}
            onChange={(e) => setForm({ ...form, expense: e.target.value, income: '' })}
            placeholder="0"
            min="0"
            className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm text-right text-red-600"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            キャンセル
          </button>
        )}
        {!initialData && (
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            クリア
          </button>
        )}
        <button
          type="submit"
          className="px-6 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          {initialData ? '更新' : '追加'}
        </button>
      </div>
    </form>
  )
}

// ===== 通帳入力フォーム =====

export interface BankFormData {
  date: string
  passbookDescription: string
  transactionType: string
  counterparty: string
  deposit: string
  withdrawal: string
}

interface BankFormProps {
  month: string
  initialData?: BankFormData
  onSubmit: (data: BankFormData) => void
  onCancel?: () => void
  errors: ValidationError[]
  counterpartySuggestions: string[]
  typeSuggestions: string[]
  onCounterpartyChange?: (value: string) => void
  onPassbookDescChange?: (value: string) => void
}

export function BankTransactionForm({
  month,
  initialData,
  onSubmit,
  onCancel,
  errors,
  counterpartySuggestions,
  typeSuggestions,
  onCounterpartyChange,
  onPassbookDescChange,
}: BankFormProps) {
  const defaultDate = `${month}-${String(new Date().getDate()).padStart(2, '0')}`
  const [form, setForm] = useState<BankFormData>(
    initialData || { date: defaultDate, passbookDescription: '', transactionType: '', counterparty: '', deposit: '', withdrawal: '' }
  )

  useEffect(() => {
    if (!initialData) {
      setForm({ date: defaultDate, passbookDescription: '', transactionType: '', counterparty: '', deposit: '', withdrawal: '' })
    }
  }, [month])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit(form)
  }

  function getError(field: string): string | undefined {
    return errors.find((e) => e.field === field)?.message
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="text-sm font-medium text-gray-700 mb-3">
        {initialData ? '取引を編集' : '新しい取引を追加'}
      </div>
      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-2">
          <label className="text-xs text-gray-500">日付</label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className={`w-full border rounded-lg px-2 py-2 text-sm ${getError('date') ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
          />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-gray-500">摘要（通帳記載）</label>
          <input
            type="text"
            value={form.passbookDescription}
            onChange={(e) => {
              setForm({ ...form, passbookDescription: e.target.value })
              onPassbookDescChange?.(e.target.value)
            }}
            placeholder="通帳の印字内容"
            className={`w-full border rounded-lg px-2 py-2 text-sm ${getError('passbookDescription') ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
          />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-gray-500">取引内容</label>
          <input
            type="text"
            value={form.transactionType}
            onChange={(e) => setForm({ ...form, transactionType: e.target.value })}
            placeholder="例: 売上入金"
            list="bank-type-list"
            className={`w-full border rounded-lg px-2 py-2 text-sm font-medium ${getError('transactionType') ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
          />
          <datalist id="bank-type-list">
            {typeSuggestions.map((s) => <option key={s} value={s} />)}
          </datalist>
        </div>
        <div className="col-span-2">
          <label className="text-xs text-gray-500">取引先</label>
          <input
            type="text"
            value={form.counterparty}
            onChange={(e) => {
              setForm({ ...form, counterparty: e.target.value })
              onCounterpartyChange?.(e.target.value)
            }}
            placeholder="相手先"
            list="bank-cp-list"
            className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm"
          />
          <datalist id="bank-cp-list">
            {counterpartySuggestions.map((s) => <option key={s} value={s} />)}
          </datalist>
        </div>
        <div className="col-span-2">
          <label className="text-xs text-gray-500">入金</label>
          <input
            type="number"
            value={form.deposit}
            onChange={(e) => setForm({ ...form, deposit: e.target.value, withdrawal: '' })}
            placeholder="0"
            min="0"
            className={`w-full border rounded-lg px-2 py-2 text-sm text-right text-blue-600 ${getError('deposit') ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
          />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-gray-500">出金</label>
          <input
            type="number"
            value={form.withdrawal}
            onChange={(e) => setForm({ ...form, withdrawal: e.target.value, deposit: '' })}
            placeholder="0"
            min="0"
            className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm text-right text-red-600"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-3">
        {onCancel && (
          <button type="button" onClick={onCancel} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
            キャンセル
          </button>
        )}
        <button type="submit" className="px-6 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
          {initialData ? '更新' : '追加'}
        </button>
      </div>
    </form>
  )
}
