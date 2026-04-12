'use client'

import { useRef, useState } from 'react'
import type { AccountItem, UploadConfig, DocumentType } from '@/lib/bank-statement/types'

interface Props {
  accountMaster: AccountItem[]
  onUpload: (config: UploadConfig) => void
  isLoading: boolean
}

const DOC_TYPES: { value: DocumentType; label: string }[] = [
  { value: 'bank-statement', label: '通帳' },
  { value: 'cash-book', label: '現金出納帳' },
  { value: 'sales-invoice', label: '売上請求書' },
  { value: 'purchase-invoice', label: '仕入請求書' },
  { value: 'receipt', label: 'レシート・領収書' },
]

export default function UploadDialog({ accountMaster, onUpload, isLoading }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [docType, setDocType] = useState<DocumentType>('bank-statement')
  const [accountCode, setAccountCode] = useState('')
  const [accountName, setAccountName] = useState('')
  const [debitCode, setDebitCode] = useState('')
  const [debitName, setDebitName] = useState('')
  const [creditCode, setCreditCode] = useState('')
  const [creditName, setCreditName] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleAccountSelect = (code: string, setter: (c: string) => void, nameSetter: (n: string) => void) => {
    setter(code)
    const item = accountMaster.find((a) => a.code === code)
    if (item) nameSetter(item.shortName || item.name)
  }

  const handleSubmit = () => {
    if (!selectedFile) return
    if (docType === 'bank-statement' || docType === 'cash-book') {
      if (!accountCode || !accountName) return
      onUpload({ documentType: docType, accountCode, accountName, file: selectedFile })
    } else if (docType === 'receipt') {
      // レシート: 貸方（支払原資）のみ
      if (!creditCode || !creditName) return
      onUpload({
        documentType: docType,
        accountCode: creditCode, accountName: creditName,
        creditCode, creditName,
        file: selectedFile,
      })
    } else {
      if (!debitCode || !creditCode) return
      onUpload({
        documentType: docType,
        accountCode: '', accountName: '',
        debitCode, debitName, creditCode, creditName,
        file: selectedFile,
      })
    }
    setIsOpen(false)
    setSelectedFile(null)
  }

  const isBankLike = docType === 'bank-statement' || docType === 'cash-book'
  const isInvoice = docType === 'sales-invoice' || docType === 'purchase-invoice'
  const isReceipt = docType === 'receipt'
  const canSubmit = selectedFile && !isLoading && (
    isBankLike ? (accountCode && accountName)
      : isReceipt ? (creditCode && creditName)
        : (debitCode && creditCode)
  )

  const acceptFiles = isReceipt ? '.pdf,.xlsx,.xls' : isInvoice ? '.pdf,.xlsx,.xls,.csv' : '.pdf,.xlsx,.xls'

  const renderAccountSelector = (label: string, code: string, onCodeChange: (c: string) => void, name: string, onNameChange: (n: string) => void, filterKeywords?: string[]) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {accountMaster.length > 0 ? (
        <select value={code}
          onChange={(e) => handleAccountSelect(e.target.value, onCodeChange, onNameChange)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">-- 科目を選択 --</option>
          {filterKeywords && (
            <optgroup label="候補">
              {accountMaster.filter((a) => filterKeywords.some((k) => a.name.includes(k) || a.shortName.includes(k)))
                .map((item) => (
                  <option key={item.code} value={item.code}>{item.code} - {item.shortName || item.name}</option>
                ))}
            </optgroup>
          )}
          <optgroup label="全科目">
            {accountMaster.map((item) => (
              <option key={`all-${item.code}`} value={item.code}>{item.code} - {item.shortName || item.name}</option>
            ))}
          </optgroup>
        </select>
      ) : (
        <div className="flex gap-2">
          <input type="text" value={code} onChange={(e) => onCodeChange(e.target.value)}
            placeholder="コード" className="w-20 px-2 py-2 border border-gray-300 rounded-lg text-sm" />
          <input type="text" value={name} onChange={(e) => onNameChange(e.target.value)}
            placeholder="科目名" className="flex-1 px-2 py-2 border border-gray-300 rounded-lg text-sm" />
        </div>
      )}
    </div>
  )

  return (
    <>
      <button onClick={() => setIsOpen(true)}
        className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded">
        アップロード
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-5 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-800">ファイルのアップロード</h2>
            </div>

            <div className="p-5 space-y-4">
              {/* 書類種別 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">書類の種類</label>
                <div className="flex gap-1">
                  {DOC_TYPES.map((dt) => (
                    <button key={dt.value}
                      onClick={() => setDocType(dt.value)}
                      className={`flex-1 py-2 text-sm rounded-lg font-medium transition-colors ${
                        docType === dt.value
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}>
                      {dt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ファイル選択 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ファイル ({isInvoice ? 'PDF/Excel/CSV' : 'PDF/Excel'})
                </label>
                <div onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50">
                  {selectedFile ? (
                    <div>
                      <p className="text-sm font-medium text-gray-800">{selectedFile.name}</p>
                      <p className="text-xs text-gray-500 mt-1">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">クリックしてファイルを選択</p>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept={acceptFiles}
                  onChange={(e) => { if (e.target.files?.[0]) setSelectedFile(e.target.files[0]) }}
                  className="hidden" />
              </div>

              {/* 科目選択 */}
              {isBankLike ? (
                renderAccountSelector(
                  docType === 'cash-book' ? '現金の勘定科目' : '通帳の勘定科目',
                  accountCode, setAccountCode, accountName, setAccountName,
                  docType === 'cash-book' ? ['現金'] : ['預金', '当座', '普通', '定期']
                )
              ) : isReceipt ? (
                <>
                  {renderAccountSelector(
                    '支払原資の勘定科目（貸方に設定されます）',
                    creditCode, setCreditCode, creditName, setCreditName,
                    ['現金', '預金', '普通']
                  )}
                  <p className="text-xs text-gray-500">
                    貸方コード {creditCode || '—'}、貸方科目 {creditName || '—'} で処理します。よろしいですか？
                  </p>
                </>
              ) : (
                <>
                  {renderAccountSelector(
                    docType === 'sales-invoice' ? '借方科目（売掛金等）' : '借方科目（仕入・経費等）',
                    debitCode, setDebitCode, debitName, setDebitName,
                    docType === 'sales-invoice' ? ['売掛', '未収'] : ['仕入', '経費', '消耗', '通信', '水道']
                  )}
                  {renderAccountSelector(
                    docType === 'sales-invoice' ? '貸方科目（売上等）' : '貸方科目（買掛金等）',
                    creditCode, setCreditCode, creditName, setCreditName,
                    docType === 'sales-invoice' ? ['売上', '収入'] : ['買掛', '未払']
                  )}
                </>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 flex gap-2">
              <button onClick={() => { setIsOpen(false); setSelectedFile(null) }}
                className="flex-1 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200">
                キャンセル
              </button>
              <button onClick={handleSubmit} disabled={!canSubmit}
                className={`flex-1 py-2 text-sm font-medium rounded-lg ${
                  canSubmit ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}>
                {isLoading ? '解析中...' : 'アップロード'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
