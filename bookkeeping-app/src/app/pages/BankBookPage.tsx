import { useState, useEffect } from 'react'
import type { AppConfig, BankAccount, BankEntry, AccountCode, CsvLearningData } from '../lib/types'
import { validateBankEntry } from '../lib/validation'
import { getTotalDeposit, getTotalWithdrawal, getClosingBalance } from '../lib/balance'
import { useBankTransactions } from '../hooks/useTransactions'
import { useSuggestions } from '../hooks/useSuggestions'
import { readBankAccounts, saveBankAccounts, exportBankBook, readAccountCodes, selectCsv, readCsvLearning, saveCsvLearning } from '../lib/ipc'
import MonthSelector, { generateMonthOptions, getCurrentMonthKey } from '../components/MonthSelector'
import BalanceSummary from '../components/BalanceSummary'
import { BankTransactionTable } from '../components/TransactionTable'
import { BankTransactionForm, type BankFormData } from '../components/TransactionForm'
import BankAccountSelector from '../components/BankAccountSelector'
import ExportButton from '../components/ExportButton'
import AlertModal from '../components/AlertModal'
import type { ValidationError } from '../lib/validation'

const KARIBARAI_KEYWORDS = ['仮払金', '仮払']
const KARIIRE_KEYWORDS = ['借入金入金', '借入', '融資', 'ローン']

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
  const [accountCodes, setAccountCodes] = useState<AccountCode[]>([])

  // アラート
  const [karibaraiAlert, setKaribaraiAlert] = useState(false)
  const [kariireAlert, setKariireAlert] = useState(false)
  const [exportAlert, setExportAlert] = useState(false)

  // CSV取り込み
  const [csvLearning, setCsvLearning] = useState<CsvLearningData>({
    descriptionToAccountCode: {},
    descriptionToTransactionType: {},
    descriptionToCounterparty: {},
  })
  const [csvImportCount, setCsvImportCount] = useState<number | null>(null)

  const { data, loading, loadMonth, addEntry, updateEntry, deleteEntry, setCarryOver } =
    useBankTransactions()

  const {
    getSuggestedTransactionTypes,
    getSuggestedTypeFromDescription,
    getCounterpartySuggestions,
    learnBankEntry,
  } = useSuggestions()

  const [counterpartyInput, setCounterpartyInput] = useState('')

  useEffect(() => {
    readBankAccounts().then((accs) => {
      setAccounts(accs)
      if (accs.length > 0 && !selectedAccountId) {
        setSelectedAccountId(accs[0].id)
      }
    })
    readAccountCodes().then(setAccountCodes)
    readCsvLearning().then(setCsvLearning)
  }, [])

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

  function checkAlerts(transactionType: string) {
    if (KARIBARAI_KEYWORDS.some((kw) => transactionType.includes(kw))) {
      setKaribaraiAlert(true)
    }
    if (KARIIRE_KEYWORDS.some((kw) => transactionType.includes(kw))) {
      setKariireAlert(true)
    }
  }

  async function handleSubmit(formData: BankFormData) {
    const entry: Partial<BankEntry> = {
      date: formData.date,
      passbookDescription: formData.passbookDescription,
      transactionType: formData.transactionType,
      accountCode: formData.accountCode || undefined,
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

    await learnBankEntry(
      formData.counterparty,
      formData.passbookDescription,
      formData.transactionType
    )

    checkAlerts(formData.transactionType)
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

  function handlePassbookDescChange(_value: string) {
    // 自動入力は form 内部で処理
  }

  // CSV取り込み
  async function handleCsvImport() {
    const csv = await selectCsv()
    if (!csv) return

    const lines = csv.split('\n').filter((l) => l.trim())
    if (lines.length === 0) return

    let importCount = 0
    const updatedLearning = { ...csvLearning }

    for (let i = 0; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
      if (cols.length < 3) continue

      const date = cols[0]
      const passbookDesc = cols[1]
      const deposit = parseInt(cols[2]) || null
      const withdrawal = parseInt(cols[3]) || null

      if (!date || !passbookDesc) continue
      if (!deposit && !withdrawal) continue

      // 学習データから自動入力
      const learnedType = updatedLearning.descriptionToTransactionType[passbookDesc]
      const learnedCounterparty = updatedLearning.descriptionToCounterparty[passbookDesc]
      const learnedCode = updatedLearning.descriptionToAccountCode[passbookDesc]

      const transactionType = learnedType?.type || ''
      const counterparty = learnedCounterparty?.counterparty || ''
      const accountCode = learnedCode?.code || undefined

      const entry: Omit<BankEntry, 'id' | 'balance' | 'createdAt' | 'updatedAt'> = {
        date,
        passbookDescription: passbookDesc,
        transactionType: transactionType || '仮払金',
        accountCode,
        counterparty,
        deposit,
        withdrawal,
      }

      await addEntry(entry)
      importCount++

      if (!transactionType) {
        // 未学習 → 仮払金として登録
      }
    }

    setCsvImportCount(importCount)
    setTimeout(() => setCsvImportCount(null), 5000)

    // 仮払金が含まれる可能性があるのでアラート
    if (importCount > 0) {
      setKaribaraiAlert(true)
    }
  }

  // CSV学習の更新（手動入力時にも学習データを蓄積）
  async function handleLearnFromEntry(passbookDesc: string, transactionType: string, counterparty: string, accountCode?: string) {
    if (!passbookDesc) return
    const updated = { ...csvLearning }

    if (transactionType) {
      const existing = updated.descriptionToTransactionType[passbookDesc]
      if (!existing || existing.count < 999) {
        updated.descriptionToTransactionType[passbookDesc] = {
          type: transactionType,
          count: (existing?.count || 0) + 1,
        }
      }
    }
    if (counterparty) {
      const existing = updated.descriptionToCounterparty[passbookDesc]
      updated.descriptionToCounterparty[passbookDesc] = {
        counterparty,
        count: (existing?.count || 0) + 1,
      }
    }
    if (accountCode) {
      const existing = updated.descriptionToAccountCode[passbookDesc]
      updated.descriptionToAccountCode[passbookDesc] = {
        code: accountCode,
        name: accountCodes.find((c) => c.code === accountCode)?.name || '',
        count: (existing?.count || 0) + 1,
      }
    }

    setCsvLearning(updated)
    await saveCsvLearning(updated)
  }

  async function handleExport() {
    const result = await exportBankBook(selectedAccountId!, selectedMonth, config.companyName, accountName)
    if (result) {
      setExportAlert(true)
    }
    return result
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
        accountCode: editingEntry.accountCode || '',
        counterparty: editingEntry.counterparty,
        deposit: editingEntry.deposit?.toString() ?? '',
        withdrawal: editingEntry.withdrawal?.toString() ?? '',
      }
    : undefined

  return (
    <div className="p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-800">通帳記録</h1>
        <div className="flex items-center gap-3">
          {selectedAccountId && (
            <>
              <button
                onClick={handleCsvImport}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
              >
                CSV取り込み
              </button>
              <ExportButton onExport={handleExport} />
            </>
          )}
        </div>
      </div>

      {csvImportCount !== null && (
        <div className="mb-4 px-4 py-3 bg-green-50 text-green-700 rounded-lg text-sm">
          {csvImportCount}件の取引をCSVから取り込みました。不明な取引は「仮払金」として登録されています。
        </div>
      )}

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
          <p className="text-sm">上の「+ ���座を追加」ボタンから口座を登��してください</p>
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
            onSubmit={async (formData) => {
              await handleSubmit(formData)
              await handleLearnFromEntry(
                formData.passbookDescription,
                formData.transactionType,
                formData.counterparty,
                formData.accountCode
              )
            }}
            onCancel={editingIndex != null ? () => { setEditingIndex(null); setErrors([]) } : undefined}
            errors={errors}
            counterpartySuggestions={getCounterpartySuggestions()}
            typeSuggestions={getSuggestedTransactionTypes(counterpartyInput)}
            onCounterpartyChange={setCounterpartyInput}
            onPassbookDescChange={handlePassbookDescChange}
            accountCodes={accountCodes}
          />
        </>
      )}

      {/* 仮払金アラート */}
      {karibaraiAlert && (
        <AlertModal
          title="確認資料のご提出をお願いします"
          type="warning"
          messages={[
            '不明な取引は「仮払金」として仮計上されています。',
            '請求書・領収書などの確認資料をPDFまたはFAXで税理士にお渡しください。',
            '資料が届き次第、正しい勘定科目に振り替えます。',
          ]}
          onClose={() => setKaribaraiAlert(false)}
        />
      )}

      {/* 借入アラート */}
      {kariireAlert && (
        <AlertModal
          title="借入に関する資料のご提出をお願いします"
          type="warning"
          messages={[
            '借入金の取引が記録されました。',
            '借入契約書・返済予定表・金銭消費貸借契約書などの詳細資料を税理士にお渡しください。',
            '利率・返済期間・担保の有無がわかる資料が必要です。',
          ]}
          onClose={() => setKariireAlert(false)}
        />
      )}

      {/* ダウンロード後アラート */}
      {exportAlert && (
        <AlertModal
          title="税理士への追加提出資料をご確���ください"
          type="info"
          messages={[
            'ダウンロードしたデータと合わせて、以下の資料もご用意ください：',
            '「仮払金」の取引がある場合 → 請求書・領収書等のPDFまたはFAX',
            '借入関連の取引がある場合 → 借入契約書・返済予定表',
            '固定資産の購入がある場合 → 売買契約書・納品書',
            '不明点がある場合は税理士にご相談ください。',
          ]}
          onClose={() => setExportAlert(false)}
        />
      )}
    </div>
  )
}
