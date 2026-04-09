'use client'

import { useRef, useState } from 'react'
import type { AccountItem, UploadConfig } from '@/lib/bank-statement/types'

interface Props {
  accountMaster: AccountItem[]
  onUpload: (config: UploadConfig) => void
  isLoading: boolean
}

export default function UploadDialog({ accountMaster, onUpload, isLoading }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [accountCode, setAccountCode] = useState('')
  const [accountName, setAccountName] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setSelectedFile(file)
  }

  const handleAccountSelect = (code: string) => {
    setAccountCode(code)
    const item = accountMaster.find((a) => a.code === code)
    if (item) setAccountName(item.name)
  }

  const handleSubmit = () => {
    if (!selectedFile || !accountCode || !accountName) return
    onUpload({ accountCode, accountName, file: selectedFile })
    setIsOpen(false)
    setSelectedFile(null)
  }

  const canSubmit = selectedFile && accountCode && accountName && !isLoading

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded"
      >
        アップロード
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-5 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-800">通帳ファイルのアップロード</h2>
            </div>

            <div className="p-5 space-y-4">
              {/* ファイル選択 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  通帳ファイル (PDF/Excel)
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                >
                  {selectedFile ? (
                    <div>
                      <p className="text-sm font-medium text-gray-800">{selectedFile.name}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">クリックしてファイルを選択</p>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {/* 科目コード・科目名 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  通帳の勘定科目
                </label>
                {accountMaster.length > 0 ? (
                  <select
                    value={accountCode}
                    onChange={(e) => handleAccountSelect(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- 科目を選択 --</option>
                    {accountMaster
                      .filter((a) =>
                        a.name.includes('預金') ||
                        a.name.includes('当座') ||
                        a.name.includes('普通') ||
                        a.name.includes('定期') ||
                        a.code === accountCode,
                      )
                      .map((item) => (
                        <option key={item.code} value={item.code}>
                          {item.code} - {item.name}
                        </option>
                      ))}
                    <optgroup label="全科目">
                      {accountMaster.map((item) => (
                        <option key={`all-${item.code}`} value={item.code}>
                          {item.code} - {item.name}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={accountCode}
                        onChange={(e) => setAccountCode(e.target.value)}
                        placeholder="科目コード"
                        className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="text"
                        value={accountName}
                        onChange={(e) => setAccountName(e.target.value)}
                        placeholder="科目名（例：普通預金）"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <p className="text-xs text-gray-400">
                      科目マスタCSVをアップロードすると選択肢から選べます
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 flex gap-2">
              <button
                onClick={() => {
                  setIsOpen(false)
                  setSelectedFile(null)
                }}
                className="flex-1 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200"
              >
                キャンセル
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className={`flex-1 py-2 text-sm font-medium rounded-lg ${
                  canSubmit
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {isLoading ? '解析中...' : 'アップロード'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
