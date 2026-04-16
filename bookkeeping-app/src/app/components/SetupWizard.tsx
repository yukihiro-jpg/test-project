import { useState } from 'react'
import type { AppConfig } from '../lib/types'
import { saveConfig, selectFolder } from '../lib/ipc'

interface Props {
  onComplete: (config: AppConfig) => void
}

export default function SetupWizard({ onComplete }: Props) {
  const [step, setStep] = useState(0)
  const [companyName, setCompanyName] = useState('')
  const [fiscalYearStart, setFiscalYearStart] = useState(1)
  const [dataFolder, setDataFolder] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const months = Array.from({ length: 12 }, (_, i) => i + 1)

  async function handleSelectFolder() {
    const folder = await selectFolder()
    if (folder) setDataFolder(folder)
  }

  async function handleFinish() {
    if (!companyName.trim()) {
      setError('会社名を入力してください')
      return
    }
    if (!dataFolder) {
      setError('保存先フォルダを選択してください')
      return
    }

    setSaving(true)
    try {
      const config: AppConfig = {
        companyName: companyName.trim(),
        fiscalYearStart,
        dataFolder,
        createdAt: new Date().toISOString(),
      }
      await saveConfig(config)
      onComplete(config)
    } catch (e) {
      setError('設定の保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-8">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">帳簿管理アプリ</h1>
          <p className="text-gray-500">初期設定を行います</p>
        </div>

        {/* ステップインジケーター */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[0, 1, 2].map((s) => (
            <div
              key={s}
              className={`w-3 h-3 rounded-full transition-colors ${
                s === step ? 'bg-blue-500' : s < step ? 'bg-blue-300' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-2 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        {/* Step 0: 会社名 */}
        {step === 0 && (
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">会社名（事業者名）</span>
              <input
                type="text"
                value={companyName}
                onChange={(e) => { setCompanyName(e.target.value); setError('') }}
                placeholder="例: 株式会社〇〇"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                autoFocus
              />
            </label>
            <p className="text-xs text-gray-400">
              Excelファイルの出力時にも使用されます
            </p>
            <button
              onClick={() => {
                if (!companyName.trim()) { setError('会社名を入力してください'); return }
                setError('')
                setStep(1)
              }}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              次へ
            </button>
          </div>
        )}

        {/* Step 1: 会計期間 */}
        {step === 1 && (
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">決算月（会計期間の最終月）</span>
              <select
                value={fiscalYearStart}
                onChange={(e) => setFiscalYearStart(Number(e.target.value))}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {months.map((m) => (
                  <option key={m} value={m}>
                    {m}月決算{m === 3 ? '（3月決算法人）' : m === 12 ? '（12月決算・個人事業）' : ''}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-xs text-gray-400">
              わからない場合は税理士にご確認ください。個人事業主の方は12月のままで結構です。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setStep(0)}
                className="flex-1 border border-gray-300 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                戻る
              </button>
              <button
                onClick={() => { setError(''); setStep(2) }}
                className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                次へ
              </button>
            </div>
          </div>
        )}

        {/* Step 2: 保存先フォルダ */}
        {step === 2 && (
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">データ保存先フォルダ</span>
              <div className="mt-1 flex gap-2">
                <input
                  type="text"
                  value={dataFolder}
                  readOnly
                  placeholder="フォルダを選択してください"
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-sm bg-gray-50"
                />
                <button
                  onClick={handleSelectFolder}
                  className="px-4 py-3 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium whitespace-nowrap"
                >
                  選択
                </button>
              </div>
            </label>
            <p className="text-xs text-gray-400">
              デスクトップや会計ソフトのフォルダなど、わかりやすい場所を選んでください。
              入力したデータはすべてこのフォルダに保存されます。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 border border-gray-300 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                戻る
              </button>
              <button
                onClick={handleFinish}
                disabled={saving}
                className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? '保存中...' : '設定を完了する'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
