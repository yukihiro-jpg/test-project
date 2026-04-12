'use client'

import { useState, useEffect } from 'react'
import type { AccountItem, JournalEntry } from '@/lib/bank-statement/types'
import { getFixedJournals, addFixedJournal, deleteFixedJournal, type FixedJournalEntry } from '@/lib/bank-statement/fixed-journal-store'
import { createBlankEntry } from '@/lib/bank-statement/journal-mapper'
import { appendTempEntries } from '@/lib/bank-statement/temp-store'

interface Props {
  open: boolean
  onClose: () => void
  accountMaster: AccountItem[]
  onTempCountChange: (count: number) => void
}

export default function FixedJournalDialog({ open, onClose, accountMaster, onTempCountChange }: Props) {
  const [items, setItems] = useState<FixedJournalEntry[]>([])
  const [showAdd, setShowAdd] = useState(false)

  // 登録フォーム
  const [fDebitCode, setFDebitCode] = useState('')
  const [fDebitName, setFDebitName] = useState('')
  const [fCreditCode, setFCreditCode] = useState('')
  const [fCreditName, setFCreditName] = useState('')
  const [fTax, setFTax] = useState('')
  const [fAmount, setFAmount] = useState('')
  const [fDesc, setFDesc] = useState('')

  // 一括作成
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDate, setBulkDate] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [previewEntries, setPreviewEntries] = useState<JournalEntry[]>([])

  useEffect(() => { if (open) setItems(getFixedJournals()) }, [open])

  if (!open) return null

  const handleCodeInput = (code: string, setter: (c: string) => void, nameSetter: (n: string) => void) => {
    setter(code)
    const acc = accountMaster.find((a) => a.code === code)
    if (acc) nameSetter(acc.shortName || acc.name)
  }

  const handleAdd = () => {
    if (!fDebitCode || !fCreditCode || !fAmount) return
    addFixedJournal({
      debitCode: fDebitCode, debitName: fDebitName,
      creditCode: fCreditCode, creditName: fCreditName,
      taxType: fTax, amount: parseInt(fAmount.replace(/[^0-9]/g, '')) || 0,
      description: fDesc.slice(0, 25),
    })
    setItems(getFixedJournals())
    setShowAdd(false)
    setFDebitCode(''); setFDebitName(''); setFCreditCode(''); setFCreditName('')
    setFTax(''); setFAmount(''); setFDesc('')
  }

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelectedIds(next)
  }

  const selectAll = () => {
    if (selectedIds.size === items.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(items.map((i) => i.id)))
  }

  const handleCreateEntries = () => {
    if (selectedIds.size === 0 || !bulkDate) { alert('日付と対象を選択してください'); return }
    const date = bulkDate.replace(/-/g, '')
    const entries: JournalEntry[] = []
    for (const item of items) {
      if (!selectedIds.has(item.id)) continue
      const e = createBlankEntry()
      e.date = date
      e.debitCode = item.debitCode; e.debitName = item.debitName
      e.creditCode = item.creditCode; e.creditName = item.creditName
      e.debitAmount = item.amount; e.creditAmount = item.amount
      e.debitTaxType = item.taxType
      e.description = item.description; e.originalDescription = item.description
      entries.push(e)
    }
    setPreviewEntries(entries)
    setShowPreview(true)
  }

  const handleConfirmSave = () => {
    const count = appendTempEntries(previewEntries)
    onTempCountChange(count)
    setShowPreview(false)
    setSelectedIds(new Set())
    setBulkDate('')
    alert(`${previewEntries.length}件の仕訳を一時保存しました（合計${count}件）`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800">定型処理仕訳</h2>
          <button onClick={() => setShowAdd(!showAdd)}
            className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">
            + 新規登録
          </button>
        </div>

        {/* 登録フォーム */}
        {showAdd && (
          <div className="px-6 py-4 bg-blue-50 border-b border-blue-200">
            <div className="grid grid-cols-4 gap-2 mb-2">
              <div>
                <label className="text-xs text-gray-600">借方CD</label>
                <input type="text" value={fDebitCode}
                  onChange={(e) => handleCodeInput(e.target.value, setFDebitCode, setFDebitName)}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded" placeholder="コード" />
                <span className="text-xs text-gray-500">{fDebitName}</span>
              </div>
              <div>
                <label className="text-xs text-gray-600">貸方CD</label>
                <input type="text" value={fCreditCode}
                  onChange={(e) => handleCodeInput(e.target.value, setFCreditCode, setFCreditName)}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded" placeholder="コード" />
                <span className="text-xs text-gray-500">{fCreditName}</span>
              </div>
              <div>
                <label className="text-xs text-gray-600">金額</label>
                <input type="text" value={fAmount} onChange={(e) => setFAmount(e.target.value)}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-right" placeholder="0" />
              </div>
              <div>
                <label className="text-xs text-gray-600">税区</label>
                <input type="text" value={fTax} onChange={(e) => setFTax(e.target.value)}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded" placeholder="課仕10%" />
              </div>
            </div>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-xs text-gray-600">摘要（25文字以内）</label>
                <input type="text" value={fDesc} onChange={(e) => setFDesc(e.target.value.slice(0, 25))}
                  maxLength={25} className="w-full px-2 py-1 text-sm border border-gray-300 rounded" />
              </div>
              <button onClick={handleAdd} className="px-4 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">登録</button>
              <button onClick={() => setShowAdd(false)} className="px-3 py-1 text-sm bg-gray-200 rounded">取消</button>
            </div>
          </div>
        )}

        {/* 一括日付入力 + 作成ボタン */}
        {items.length > 0 && (
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-3">
            <button onClick={selectAll} className="text-xs text-blue-600 hover:underline">
              {selectedIds.size === items.length ? '全解除' : '全選択'}
            </button>
            <span className="text-xs text-gray-500">{selectedIds.size}件選択</span>
            <input type="date" value={bulkDate} onChange={(e) => setBulkDate(e.target.value)}
              className="px-2 py-1 text-sm border border-gray-300 rounded" />
            <button onClick={handleCreateEntries}
              disabled={selectedIds.size === 0 || !bulkDate}
              className="px-4 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-40">
              仕訳作成
            </button>
          </div>
        )}

        {/* 一覧 */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-gray-100">
              <tr>
                <th className="px-3 py-2 w-10 text-center border-b border-gray-300"></th>
                <th className="px-3 py-2 text-left border-b border-gray-300">借方科目</th>
                <th className="px-3 py-2 text-left border-b border-gray-300">貸方科目</th>
                <th className="px-3 py-2 text-right border-b border-gray-300">金額</th>
                <th className="px-3 py-2 text-left border-b border-gray-300">税区</th>
                <th className="px-3 py-2 text-left border-b border-gray-300">摘要</th>
                <th className="px-3 py-2 w-12 border-b border-gray-300"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 text-center">
                    <input type="checkbox" checked={selectedIds.has(item.id)}
                      onChange={() => toggleSelect(item.id)} className="rounded" />
                  </td>
                  <td className="px-3 py-2">
                    <span className="text-blue-700 font-bold">{item.debitCode}</span> {item.debitName}
                  </td>
                  <td className="px-3 py-2">
                    <span className="text-blue-700 font-bold">{item.creditCode}</span> {item.creditName}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{item.amount.toLocaleString()}</td>
                  <td className="px-3 py-2 text-xs">{item.taxType}</td>
                  <td className="px-3 py-2 text-xs text-gray-600">{item.description}</td>
                  <td className="px-3 py-2 text-center">
                    <button onClick={() => { deleteFixedJournal(item.id); setItems(getFixedJournals()) }}
                      className="text-xs text-red-500 hover:underline">削除</button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                  定型仕訳が登録されていません
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* プレビュー確認 */}
        {showPreview && (
          <div className="px-6 py-4 bg-green-50 border-t border-green-200">
            <h3 className="text-sm font-bold text-green-800 mb-2">
              作成される仕訳（{previewEntries.length}件）
            </h3>
            <div className="max-h-32 overflow-auto mb-3">
              {previewEntries.map((e, i) => (
                <div key={i} className="text-xs text-gray-700">
                  {e.date} | {e.debitCode} {e.debitName} → {e.creditCode} {e.creditName} | {e.debitAmount.toLocaleString()} | {e.description}
                </div>
              ))}
            </div>
            <p className="text-sm text-green-800 font-medium mb-2">
              この仕訳をCSVデータとして一時保存しますか？
            </p>
            <div className="flex gap-2">
              <button onClick={handleConfirmSave}
                className="px-4 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700">はい</button>
              <button onClick={() => setShowPreview(false)}
                className="px-4 py-1.5 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300">いいえ</button>
            </div>
          </div>
        )}

        <div className="px-6 py-3 border-t border-gray-200">
          <button onClick={onClose} className="px-4 py-2 text-sm bg-gray-100 rounded hover:bg-gray-200">閉じる</button>
        </div>
      </div>
    </div>
  )
}
