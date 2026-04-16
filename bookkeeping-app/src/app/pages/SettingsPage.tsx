import { useState } from 'react'
import type { AppConfig } from '../lib/types'
import { useCompanySettings } from '../hooks/useCompanySettings'
import { selectFolder } from '../lib/ipc'

interface Props {
  config: AppConfig
  onConfigUpdate: (config: AppConfig) => void
}

export default function SettingsPage({ config, onConfigUpdate }: Props) {
  const { bankAccounts, updateConfig, addBankAccount, removeBankAccount } = useCompanySettings()
  const [companyName, setCompanyName] = useState(config.companyName)
  const [fiscalYearStart, setFiscalYearStart] = useState(config.fiscalYearStart)
  const [dataFolder, setDataFolder] = useState(config.dataFolder)
  const [saved, setSaved] = useState(false)

  // 新規口座フォーム
  const [showAccountForm, setShowAccountForm] = useState(false)
  const [newBank, setNewBank] = useState({ bankName: '', branchName: '', accountType: '普通', accountNumber: '', openingBalance: '' })

  async function handleSave() {
    const updated: AppConfig = {
      ...config,
      companyName,
      fiscalYearStart,
      dataFolder,
    }
    await updateConfig(updated)
    onConfigUpdate(updated)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  async function handleSelectFolder() {
    const folder = await selectFolder()
    if (folder) setDataFolder(folder)
  }

  async function handleAddAccount() {
    if (!newBank.bankName.trim() || !newBank.accountNumber.trim()) return
    const { v4: uuidv4 } = await import('uuid')
    await addBankAccount({
      id: uuidv4(),
      bankName: newBank.bankName,
      branchName: newBank.branchName,
      accountType: newBank.accountType,
      accountNumber: newBank.accountNumber,
      openingBalance: parseInt(newBank.openingBalance) || 0,
    })
    setNewBank({ bankName: '', branchName: '', accountType: '普通', accountNumber: '', openingBalance: '' })
    setShowAccountForm(false)
  }

  const months = Array.from({ length: 12 }, (_, i) => i + 1)

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-bold text-gray-800 mb-6">設定</h1>

      {/* 会社情報 */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-medium text-gray-600 mb-4">会社情報</h2>

        <label className="block mb-4">
          <span className="text-sm text-gray-700">会社名</span>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
          />
        </label>

        <label className="block mb-4">
          <span className="text-sm text-gray-700">決算月</span>
          <select
            value={fiscalYearStart}
            onChange={(e) => setFiscalYearStart(Number(e.target.value))}
            className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
          >
            {months.map((m) => (
              <option key={m} value={m}>{m}月決算</option>
            ))}
          </select>
        </label>

        <label className="block mb-4">
          <span className="text-sm text-gray-700">データ保存先フォルダ</span>
          <div className="mt-1 flex gap-2">
            <input
              type="text"
              value={dataFolder}
              readOnly
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-sm"
            />
            <button
              onClick={handleSelectFolder}
              className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 text-sm"
            >
              変更
            </button>
          </div>
        </label>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            保存
          </button>
          {saved && <span className="text-sm text-green-600">保存しました</span>}
        </div>
      </section>

      {/* 銀行口座管理 */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-gray-600">銀行口座</h2>
          <button
            onClick={() => setShowAccountForm(!showAccountForm)}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            + 口座を追加
          </button>
        </div>

        {bankAccounts.length === 0 && !showAccountForm && (
          <p className="text-sm text-gray-400 py-4 text-center">
            銀行口座が登録されていません
          </p>
        )}

        {bankAccounts.map((account) => (
          <div
            key={account.id}
            className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0"
          >
            <div>
              <div className="text-sm font-medium">
                {account.bankName} {account.branchName}
              </div>
              <div className="text-xs text-gray-400">
                {account.accountType} {account.accountNumber}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">
                期首残高: {account.openingBalance.toLocaleString()}円
              </span>
              <button
                onClick={async () => {
                  if (confirm(`${account.bankName}の口座を削除しますか？`)) {
                    await removeBankAccount(account.id)
                  }
                }}
                className="text-xs text-red-400 hover:text-red-600"
              >
                削除
              </button>
            </div>
          </div>
        ))}

        {showAccountForm && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs text-gray-500">銀行名</label>
                <input
                  type="text"
                  value={newBank.bankName}
                  onChange={(e) => setNewBank({ ...newBank, bankName: e.target.value })}
                  placeholder="〇〇銀行"
                  className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">支店名</label>
                <input
                  type="text"
                  value={newBank.branchName}
                  onChange={(e) => setNewBank({ ...newBank, branchName: e.target.value })}
                  placeholder="〇〇支店"
                  className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">種別</label>
                <select
                  value={newBank.accountType}
                  onChange={(e) => setNewBank({ ...newBank, accountType: e.target.value })}
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
                  value={newBank.accountNumber}
                  onChange={(e) => setNewBank({ ...newBank, accountNumber: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm"
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-500">期首残高</label>
                <input
                  type="number"
                  value={newBank.openingBalance}
                  onChange={(e) => setNewBank({ ...newBank, openingBalance: e.target.value })}
                  placeholder="0"
                  className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm text-right"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAccountForm(false)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleAddAccount}
                disabled={!newBank.bankName.trim() || !newBank.accountNumber.trim()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                登録
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
