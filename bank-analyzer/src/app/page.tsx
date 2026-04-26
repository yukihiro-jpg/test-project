'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { PassbookEditor } from '@/components/PassbookEditor'
import { AssetMovementView } from '@/components/AssetMovementView'
import { AtmKeywordsModal } from '@/components/AtmKeywordsModal'
import { DEFAULT_ATM_KEYWORDS, loadAtmKeywords, saveAtmKeywords } from '@/lib/atm-keywords'
import { buildAssetMovementTable } from '@/lib/asset-movement'
import type { AssetMovementRow, ParsedPassbook, UploadItem } from '@/types'

type ProgressEntry = {
  fileName: string
  status: 'pending' | 'analyzing' | 'done' | 'error'
  message?: string
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)))
  }
  return btoa(binary)
}

export default function HomePage() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [items, setItems] = useState<UploadItem[]>([])
  const [analyzing, setAnalyzing] = useState(false)
  const [progress, setProgress] = useState<ProgressEntry[]>([])
  const [passbooks, setPassbooks] = useState<ParsedPassbook[]>([])
  const [activeTab, setActiveTab] = useState<string>('movement')
  const [atmKeywords, setAtmKeywords] = useState<string[]>(DEFAULT_ATM_KEYWORDS)
  const [atmModalOpen, setAtmModalOpen] = useState(false)
  const [overrides, setOverrides] = useState<Record<string, Partial<AssetMovementRow>>>({})
  const [manualIncludes, setManualIncludes] = useState<string[]>([])
  const [manualExcludes, setManualExcludes] = useState<string[]>([])
  const [pdfUrls, setPdfUrls] = useState<Record<string, string>>({})
  const [dragOver, setDragOver] = useState(false)
  const pdfUrlsRef = useRef<Record<string, string>>({})

  useEffect(() => {
    setAtmKeywords(loadAtmKeywords())
  }, [])

  useEffect(() => {
    return () => {
      for (const url of Object.values(pdfUrlsRef.current)) URL.revokeObjectURL(url)
    }
  }, [])

  useEffect(() => {
    saveAtmKeywords(atmKeywords)
  }, [atmKeywords])

  const includesSet = useMemo(() => new Set(manualIncludes), [manualIncludes])
  const excludesSet = useMemo(() => new Set(manualExcludes), [manualExcludes])

  const assetTable = useMemo(
    () =>
      buildAssetMovementTable(passbooks, atmKeywords, {
        manualOverrides: overrides,
        manualIncludes: includesSet,
        manualExcludes: excludesSet
      }),
    [passbooks, atmKeywords, overrides, includesSet, excludesSet]
  )

  const includedTxIds = useMemo(() => {
    const s = new Set<string>()
    for (const row of assetTable.rows) {
      for (const id of row.sourceTransactionIds) s.add(id)
    }
    return s
  }, [assetTable])

  const handleAddTx = (txId: string) => {
    setManualExcludes((prev) => prev.filter((id) => id !== txId))
    setManualIncludes((prev) => (prev.includes(txId) ? prev : [...prev, txId]))
  }

  const handleRemoveRow = (rowId: string) => {
    const row = assetTable.rows.find((r) => r.id === rowId)
    if (!row) return
    const txIds = row.sourceTransactionIds
    setManualIncludes((prev) => prev.filter((id) => !txIds.includes(id)))
    setManualExcludes((prev) => Array.from(new Set([...prev, ...txIds])))
  }

  const addFiles = (files: File[]) => {
    const next: UploadItem[] = files
      .filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))
      .map((f) => ({
        id: `${f.name}-${f.size}-${Date.now()}-${Math.random()}`,
        file: f,
        label: f.name.replace(/\.pdf$/i, ''),
        bankName: '',
        branchName: '',
        accountNumber: ''
      }))
    setItems([...items, ...next])
  }

  const updateItem = (id: string, patch: Partial<UploadItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  }

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id))
  }

  const handleAnalyze = async () => {
    setAnalyzing(true)
    setPassbooks([])
    setOverrides({})
    setManualIncludes([])
    setManualExcludes([])
    for (const url of Object.values(pdfUrlsRef.current)) URL.revokeObjectURL(url)
    pdfUrlsRef.current = {}
    setPdfUrls({})
    setProgress(items.map((it) => ({ fileName: it.file.name, status: 'pending' })))

    const results: ParsedPassbook[] = []
    const newUrls: Record<string, string> = {}
    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      setProgress((p) => p.map((e, idx) => (idx === i ? { ...e, status: 'analyzing' } : e)))
      try {
        const pdfBase64 = await fileToBase64(it.file)
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            passbookId: it.id,
            fileName: it.file.name,
            label: it.label,
            bankName: it.bankName,
            branchName: it.branchName,
            accountNumber: it.accountNumber,
            startDate,
            endDate,
            pdfBase64
          })
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'unknown' }))
          throw new Error(err.error || `HTTP ${res.status}`)
        }
        const data = await res.json()
        results.push(data.passbook)
        const url = URL.createObjectURL(it.file)
        newUrls[data.passbook.passbookId] = url
        setProgress((p) => p.map((e, idx) => (idx === i ? { ...e, status: 'done' } : e)))
      } catch (err) {
        setProgress((p) =>
          p.map((e, idx) => (idx === i ? { ...e, status: 'error', message: (err as Error).message } : e))
        )
      }
    }

    setPassbooks(results)
    pdfUrlsRef.current = newUrls
    setPdfUrls(newUrls)
    if (results.length > 0) setActiveTab('movement')
    setAnalyzing(false)
  }

  const updatePassbook = (next: ParsedPassbook) => {
    setPassbooks((prev) => prev.map((p) => (p.passbookId === next.passbookId ? next : p)))
  }

  const downloadExcel = async () => {
    const res = await fetch('/api/excel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passbooks, assetTable })
    })
    if (!res.ok) {
      alert('Excel生成に失敗しました')
      return
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bank-analysis-${new Date().toISOString().slice(0, 10)}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3" style={{ height: 'calc(100vh - 180px)', minHeight: 480 }}>
        <div className="grid grid-rows-[auto_1fr] gap-3 min-h-0">
          <section className="bg-white rounded-lg shadow p-3">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold text-sm">①解析期間</h2>
              <button
                type="button"
                onClick={() => setAtmModalOpen(true)}
                className="text-xs bg-slate-200 text-slate-800 px-2 py-1 rounded hover:bg-slate-300"
              >
                ATM出金判定キーワード（{atmKeywords.length}件）
              </button>
            </div>
            <div className="flex flex-wrap gap-3 items-end">
              <label className="flex flex-col text-xs">
                <span className="mb-1 text-slate-600">開始日</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="border border-slate-300 rounded px-2 py-1 text-sm"
                />
              </label>
              <label className="flex flex-col text-xs">
                <span className="mb-1 text-slate-600">終了日</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="border border-slate-300 rounded px-2 py-1 text-sm"
                />
              </label>
              <button
                type="button"
                disabled={analyzing || items.length === 0 || !startDate || !endDate}
                onClick={handleAnalyze}
                className="bg-blue-600 text-white px-4 py-2 rounded font-bold text-sm hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
              >
                {analyzing ? '解析中…' : `${items.length}件を解析`}
              </button>
            </div>
            {progress.length > 0 && (
              <ul className="mt-2 text-xs space-y-0.5 max-h-20 overflow-auto">
                {progress.map((p, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span
                      className={
                        p.status === 'done'
                          ? 'text-green-600'
                          : p.status === 'error'
                          ? 'text-red-600'
                          : p.status === 'analyzing'
                          ? 'text-blue-600'
                          : 'text-slate-400'
                      }
                    >
                      {p.status === 'done' ? '✓' : p.status === 'error' ? '✗' : p.status === 'analyzing' ? '⏳' : '・'}
                    </span>
                    <span className="truncate">{p.fileName}</span>
                    {p.message && <span className="text-red-600">{p.message}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="bg-white rounded-lg shadow p-3 flex flex-col min-h-0">
            <h2 className="font-bold text-sm mb-2">②通帳PDFをアップロード</h2>
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                addFiles(Array.from(e.dataTransfer.files))
              }}
              className={`flex-1 min-h-0 border-2 border-dashed rounded p-4 text-center flex flex-col items-center justify-center transition ${
                dragOver ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50'
              }`}
            >
              <p className="text-slate-600 mb-2 text-sm">PDFをドラッグ＆ドロップ</p>
              <label className="inline-block bg-slate-700 text-white px-3 py-1.5 rounded cursor-pointer hover:bg-slate-800 text-sm">
                ファイルを選択
                <input
                  type="file"
                  accept="application/pdf"
                  multiple
                  className="hidden"
                  onChange={(e) => addFiles(Array.from(e.target.files || []))}
                />
              </label>
              {items.length > 0 && (
                <p className="mt-2 text-xs text-slate-500">{items.length}件登録済み（右側で銀行情報を入力）</p>
              )}
            </div>
          </section>
        </div>

        <section className="bg-white rounded-lg shadow p-3 flex flex-col min-h-0">
          <h2 className="font-bold text-sm mb-2">③金融機関情報の登録</h2>
          <div className="flex-1 min-h-0 overflow-auto">
            {items.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                左下からPDFをアップロードすると、ここに各通帳の入力欄が表示されます
              </div>
            ) : (
              <ul className="space-y-2">
                {items.map((it) => (
                  <li key={it.id} className="border rounded p-2 bg-slate-50">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-xs text-slate-700 truncate">{it.file.name}</span>
                      <button
                        type="button"
                        onClick={() => removeItem(it.id)}
                        className="text-red-600 text-xs hover:underline ml-2 flex-shrink-0"
                      >
                        削除
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <input
                        type="text"
                        placeholder="ラベル（例: 礼子通帳）"
                        value={it.label}
                        onChange={(e) => updateItem(it.id, { label: e.target.value })}
                        className="border border-slate-300 rounded px-2 py-1 text-xs"
                      />
                      <input
                        type="text"
                        placeholder="銀行名（例: ゆうちょ銀行）"
                        value={it.bankName}
                        onChange={(e) => updateItem(it.id, { bankName: e.target.value })}
                        className="border border-slate-300 rounded px-2 py-1 text-xs"
                      />
                      <input
                        type="text"
                        placeholder="支店名"
                        value={it.branchName}
                        onChange={(e) => updateItem(it.id, { branchName: e.target.value })}
                        className="border border-slate-300 rounded px-2 py-1 text-xs"
                      />
                      <input
                        type="text"
                        placeholder="口座番号"
                        value={it.accountNumber}
                        onChange={(e) => updateItem(it.id, { accountNumber: e.target.value })}
                        className="border border-slate-300 rounded px-2 py-1 text-xs"
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      {passbooks.length > 0 && (
        <section className="bg-white rounded-lg shadow p-4 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex flex-wrap gap-1 border-b">
              <button
                type="button"
                onClick={() => setActiveTab('movement')}
                className={`px-3 py-2 text-sm ${
                  activeTab === 'movement' ? 'border-b-2 border-blue-600 font-bold text-blue-700' : 'text-slate-600'
                }`}
              >
                金融資産異動一覧表
              </button>
              {passbooks.map((p) => (
                <button
                  key={p.passbookId}
                  type="button"
                  onClick={() => setActiveTab(p.passbookId)}
                  className={`px-3 py-2 text-sm ${
                    activeTab === p.passbookId ? 'border-b-2 border-blue-600 font-bold text-blue-700' : 'text-slate-600'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={downloadExcel}
              className="bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700 text-sm font-bold"
            >
              Excelダウンロード
            </button>
          </div>

          {activeTab === 'movement' ? (
            <AssetMovementView
              table={assetTable}
              passbooks={passbooks}
              onConclusionChange={(rowId, value) =>
                setOverrides((prev) => ({ ...prev, [rowId]: { ...prev[rowId], conclusionAmount: value } }))
              }
              onRemarksChange={(rowId, value) =>
                setOverrides((prev) => ({ ...prev, [rowId]: { ...prev[rowId], remarks: value } }))
              }
              onRemoveRow={handleRemoveRow}
            />
          ) : (
            (() => {
              const pb = passbooks.find((p) => p.passbookId === activeTab)
              return pb ? (
                <PassbookEditor
                  passbook={pb}
                  pdfUrl={pdfUrls[pb.passbookId]}
                  includedTxIds={includedTxIds}
                  onChange={updatePassbook}
                  onAddTx={handleAddTx}
                />
              ) : null
            })()
          )}
        </section>
      )}

      <AtmKeywordsModal
        open={atmModalOpen}
        keywords={atmKeywords}
        onChange={setAtmKeywords}
        onClose={() => setAtmModalOpen(false)}
      />
    </div>
  )
}
