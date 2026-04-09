'use client'

import { useRef, useState } from 'react'
import type { AccountItem } from '@/lib/bank-statement/types'
import {
  parseAccountMasterCsv,
  saveAccountMaster,
} from '@/lib/bank-statement/account-master'

interface Props {
  accountMaster: AccountItem[]
  onUpdate: (items: AccountItem[]) => void
}

export default function AccountMasterUploader({ accountMaster, onUpdate }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [showList, setShowList] = useState(false)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const items = parseAccountMasterCsv(text)
      if (items.length === 0) {
        alert('科目マスタCSVに有効なデータがありません。\n形式: 科目コード,科目名[,補助コード,補助名,税コード,税区分]')
        return
      }
      saveAccountMaster(items)
      onUpdate(items)
      alert(`${items.length}件の科目を読み込みました`)
    } catch {
      alert('CSVファイルの読み込みに失敗しました')
    }

    e.target.value = ''
  }

  return (
    <div className="relative">
      <button
        onClick={() =>
          accountMaster.length > 0 ? setShowList(!showList) : inputRef.current?.click()
        }
        className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded border border-gray-300"
      >
        科目マスタ {accountMaster.length > 0 && `(${accountMaster.length}件)`}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        onChange={handleFileChange}
        className="hidden"
      />

      {showList && (
        <div className="absolute right-0 top-full mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-auto">
          <div className="p-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-bold text-gray-700">
              登録済み科目 ({accountMaster.length}件)
            </span>
            <button
              onClick={() => inputRef.current?.click()}
              className="text-xs text-blue-600 hover:underline"
            >
              CSVを再読込
            </button>
          </div>
          <div className="divide-y divide-gray-50">
            {accountMaster.slice(0, 100).map((item, i) => (
              <div key={i} className="px-3 py-1.5 text-xs flex gap-2">
                <span className="text-gray-500 w-12 shrink-0">{item.code}</span>
                <span className="text-gray-800">{item.name}</span>
              </div>
            ))}
            {accountMaster.length > 100 && (
              <div className="px-3 py-2 text-xs text-gray-400 text-center">
                他 {accountMaster.length - 100}件
              </div>
            )}
          </div>
          <div className="p-2 border-t border-gray-100">
            <button
              onClick={() => setShowList(false)}
              className="w-full text-xs text-gray-500 hover:text-gray-700 py-1"
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
