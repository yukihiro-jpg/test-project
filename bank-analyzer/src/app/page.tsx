'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { UploadForm, type UploadItem } from '@/components/UploadForm'
import { PassbookEditor } from '@/components/PassbookEditor'
import { AssetMovementView } from '@/components/AssetMovementView'
import { AtmKeywordsEditor } from '@/components/AtmKeywordsEditor'
import { DEFAULT_ATM_KEYWORDS, loadAtmKeywords, saveAtmKeywords } from '@/lib/atm-keywords'
import { buildAssetMovementTable } from '@/lib/asset-movement'
import type { AssetMovementRow, ParsedPassbook } from '@/types'

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
  const [overrides, setOverrides] = useState<Record<string, Partial<AssetMovementRow>>>({})
  const [manualIncludes, setManualIncludes] = useState<string[]>([])
  const [manualExcludes, setManualExcludes] = useState<string[]>([])
  const [pdfUrls, setPdfUrls] = useState<Record<string, string>>({})
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
    <div className="space-y-6">
      <UploadForm
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        items={items}
        onItemsChange={setItems}
        onAnalyze={handleAnalyze}
        analyzing={analyzing}
      />

      <AtmKeywordsEditor keywords={atmKeywords} onChange={setAtmKeywords} />

      {progress.length > 0 && (
        <section className="bg-white rounded-lg shadow p-4">
          <h2 className="font-bold mb-2">解析進捗</h2>
          <ul className="text-sm space-y-1">
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
                <span>{p.fileName}</span>
                {p.message && <span className="text-red-600 text-xs">{p.message}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

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
    </div>
  )
}
