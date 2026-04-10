'use client'

import { useRef, useState } from 'react'
import type { AccountItem, SubAccountItem } from '@/lib/bank-statement/types'
import {
  parseAccountMasterFile,
  parseSubAccountMasterFile,
  saveAccountMaster,
  saveSubAccountMaster,
} from '@/lib/bank-statement/account-master'

// Shift-JIS / UTF-8 自動判定で読み込む
async function readFileWithEncoding(file: File): Promise<string> {
  // まずShift-JISで読む（JDLファイルは通常Shift-JIS）
  try {
    const buffer = await file.arrayBuffer()
    const sjisText = new TextDecoder('shift-jis').decode(buffer)
    // 文字化け判定: 置換文字(U+FFFD)が多ければUTF-8で再読み込み
    const replacementCount = (sjisText.match(/\ufffd/g) || []).length
    if (replacementCount < 3) return sjisText
  } catch { /* fallback */ }
  // UTF-8で読む
  return file.text()
}

interface Props {
  accountMaster: AccountItem[]
  subAccountMaster: SubAccountItem[]
  onAccountUpdate: (items: AccountItem[]) => void
  onSubAccountUpdate: (items: SubAccountItem[]) => void
}

export default function AccountMasterUploader({
  accountMaster,
  subAccountMaster,
  onAccountUpdate,
  onSubAccountUpdate,
}: Props) {
  const accountInputRef = useRef<HTMLInputElement>(null)
  const subAccountInputRef = useRef<HTMLInputElement>(null)
  const [showPanel, setShowPanel] = useState(false)

  const handleAccountFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await readFileWithEncoding(file)
    const items = parseAccountMasterFile(text)
    if (items.length === 0) {
      alert('科目データを読み取れませんでした。\nタブ区切りまたはCSV形式のファイルを選択してください。')
      return
    }
    saveAccountMaster(items)
    onAccountUpdate(items)
    alert(`勘定科目 ${items.length}件を登録しました`)
    e.target.value = ''
  }

  const handleSubAccountFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await readFileWithEncoding(file)
    const items = parseSubAccountMasterFile(text)
    if (items.length === 0) {
      alert('補助科目データを読み取れませんでした。\nタブ区切りまたはCSV形式のファイルを選択してください。')
      return
    }
    saveSubAccountMaster(items)
    onSubAccountUpdate(items)
    alert(`補助科目 ${items.length}件を登録しました`)
    e.target.value = ''
  }

  const totalSub = subAccountMaster.length

  return (
    <div className="relative">
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="px-3 py-1.5 text-xs font-medium bg-white/10 hover:bg-white/20 text-white rounded border border-white/20"
      >
        科目マスタ
        {accountMaster.length > 0 && (
          <span className="ml-1 text-white/70">({accountMaster.length})</span>
        )}
      </button>

      <input ref={accountInputRef} type="file" accept=".csv,.tsv,.txt" onChange={handleAccountFile} className="hidden" />
      <input ref={subAccountInputRef} type="file" accept=".csv,.tsv,.txt" onChange={handleSubAccountFile} className="hidden" />

      {showPanel && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-xl z-50">
          <div className="p-4 space-y-3">
            <h3 className="text-sm font-bold text-gray-800">マスタ登録</h3>

            {/* 勘定科目 */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-700">勘定科目</span>
                <span className="text-xs text-gray-500">{accountMaster.length}件</span>
              </div>
              <button
                onClick={() => accountInputRef.current?.click()}
                className="w-full py-2 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 text-gray-700"
              >
                科目チェックリストを読込
              </button>
            </div>

            {/* 補助科目 */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-700">補助科目</span>
                <span className="text-xs text-gray-500">{totalSub}件</span>
              </div>
              <button
                onClick={() => subAccountInputRef.current?.click()}
                className="w-full py-2 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 text-gray-700"
              >
                補助科目チェックリストを読込
              </button>
            </div>

            <p className="text-xs text-gray-400">
              TSV（タブ区切り）/ CSV / Shift-JIS対応
            </p>

            {/* リセットボタン */}
            {(accountMaster.length > 0 || totalSub > 0) && (
              <button
                onClick={() => {
                  if (confirm('登録済みの科目マスタ・補助科目マスタをすべて削除しますか？')) {
                    saveAccountMaster([])
                    saveSubAccountMaster([])
                    onAccountUpdate([])
                    onSubAccountUpdate([])
                  }
                }}
                className="w-full py-2 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50"
              >
                マスタをリセット
              </button>
            )}
          </div>

          {/* 登録済み科目プレビュー */}
          {accountMaster.length > 0 && (
            <div className="border-t border-gray-100 max-h-48 overflow-auto">
              {accountMaster.slice(0, 30).map((item, i) => (
                <div key={i} className="px-4 py-1 text-xs flex gap-2 hover:bg-gray-50">
                  <span className="text-gray-400 w-10 shrink-0">{item.code}</span>
                  <span className="text-gray-700 truncate">{item.shortName || item.name}</span>
                </div>
              ))}
              {accountMaster.length > 30 && (
                <div className="px-4 py-1 text-xs text-gray-400 text-center">
                  他 {accountMaster.length - 30}件
                </div>
              )}
            </div>
          )}

          <div className="p-2 border-t border-gray-100">
            <button
              onClick={() => setShowPanel(false)}
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
