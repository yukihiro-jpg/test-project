'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { PassbookEditor } from '@/components/PassbookEditor'
import { AssetMovementView } from '@/components/AssetMovementView'
import { AtmKeywordsModal } from '@/components/AtmKeywordsModal'
import { DepositSummaryView } from '@/components/DepositSummaryView'
import { DEFAULT_ATM_KEYWORDS, loadAtmKeywords, saveAtmKeywords } from '@/lib/atm-keywords'
import { buildAssetMovementTable } from '@/lib/asset-movement'
import {
  DEFAULT_SUMMARY_PATTERN_ID,
  findSummaryPattern,
  getAllPatterns,
  loadCustomPatterns,
  loadSummaryPatternId,
  saveCustomPatterns,
  saveSummaryPatternId,
  type SummaryPattern
} from '@/lib/summary-patterns'
import { SummaryPatternsModal } from '@/components/SummaryPatternsModal'
import type {
  AssetMovementRow,
  BalanceCertUploadItem,
  DepositRow,
  ParsedBalanceCert,
  ParsedPassbook,
  UploadItem
} from '@/types'

type ProgressEntry = {
  id: string
  fileName: string
  status: 'pending' | 'uploading' | 'analyzing' | 'done' | 'error'
  message?: string
  uploadPct?: number
  startedAt?: number
  finishedAt?: number
}

const MAX_PARALLEL = 3

function uploadWithProgress(
  url: string,
  form: FormData,
  onUploadProgress: (pct: number) => void,
  onUploadDone: () => void
): Promise<{ status: number; statusText: string; body: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) onUploadProgress(e.loaded / e.total)
    })
    xhr.upload.addEventListener('load', () => onUploadDone())
    xhr.addEventListener('load', () => {
      resolve({ status: xhr.status, statusText: xhr.statusText, body: xhr.responseText })
    })
    xhr.addEventListener('error', () => reject(new Error('ネットワークエラー')))
    xhr.addEventListener('abort', () => reject(new Error('中断されました')))
    xhr.addEventListener('timeout', () => reject(new Error('タイムアウト')))
    xhr.send(form)
  })
}

export default function HomePage() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [items, setItems] = useState<UploadItem[]>([])
  const [analyzing, setAnalyzing] = useState(false)
  const [progress, setProgress] = useState<ProgressEntry[]>([])
  const [passbooks, setPassbooks] = useState<ParsedPassbook[]>([])
  const [activeTab, setActiveTab] = useState<string>('movement')
  const [screen, setScreen] = useState<'upload' | 'results'>('upload')
  const [atmKeywords, setAtmKeywords] = useState<string[]>(DEFAULT_ATM_KEYWORDS)
  const [atmModalOpen, setAtmModalOpen] = useState(false)
  const [summaryPatternId, setSummaryPatternId] = useState<string>(DEFAULT_SUMMARY_PATTERN_ID)
  const [customPatterns, setCustomPatterns] = useState<SummaryPattern[]>([])
  const [summaryModalOpen, setSummaryModalOpen] = useState(false)
  const [overrides, setOverrides] = useState<Record<string, Partial<AssetMovementRow>>>({})
  const [manualIncludes, setManualIncludes] = useState<string[]>([])
  const [manualExcludes, setManualExcludes] = useState<string[]>([])
  const [pdfUrls, setPdfUrls] = useState<Record<string, string>>({})
  const [dragOver, setDragOver] = useState(false)
  const [certDragOver, setCertDragOver] = useState(false)
  const [tick, setTick] = useState(0)
  const pdfUrlsRef = useRef<Record<string, string>>({})

  // 残高証明書関連
  const [certItems, setCertItems] = useState<BalanceCertUploadItem[]>([])
  const [parsedCerts, setParsedCerts] = useState<ParsedBalanceCert[]>([])
  const [depositRows, setDepositRows] = useState<DepositRow[]>([])
  const [referenceDate, setReferenceDate] = useState('')

  useEffect(() => {
    if (!analyzing) return
    const t = setInterval(() => setTick((v) => v + 1), 1000)
    return () => clearInterval(t)
  }, [analyzing])

  useEffect(() => {
    setAtmKeywords(loadAtmKeywords())
    setSummaryPatternId(loadSummaryPatternId())
    setCustomPatterns(loadCustomPatterns())
  }, [])

  useEffect(() => {
    saveSummaryPatternId(summaryPatternId)
  }, [summaryPatternId])

  useEffect(() => {
    saveCustomPatterns(customPatterns)
  }, [customPatterns])

  const allPatterns = useMemo(() => getAllPatterns(customPatterns), [customPatterns])

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

  const addCertFiles = (files: File[]) => {
    const next: BalanceCertUploadItem[] = files
      .filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))
      .map((f) => ({
        id: `cert-${f.name}-${f.size}-${Date.now()}-${Math.random()}`,
        file: f
      }))
    setCertItems([...certItems, ...next])
  }
  const removeCertItem = (id: string) => {
    setCertItems((prev) => prev.filter((it) => it.id !== id))
  }

  const handleDepositRowChange = (id: string, patch: Partial<DepositRow>) => {
    setDepositRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }
  const handleAddBlankDepositRow = () => {
    setDepositRows((prev) => [
      ...prev,
      {
        id: `manual-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        bankName: '',
        branchName: '',
        accountType: '',
        accountNumber: '',
        amount: 0,
        accruedInterest: 0,
        hasCertificate: false,
        remarks: ''
      }
    ])
  }
  const handleRemoveDepositRow = (id: string) => {
    if (!confirm('この行を預金一覧から削除します。よろしいですか？')) return
    setDepositRows((prev) => prev.filter((r) => r.id !== id))
  }

  const handleAnalyze = async () => {
    setAnalyzing(true)
    setPassbooks([])
    setParsedCerts([])
    setDepositRows([])
    setOverrides({})
    setManualIncludes([])
    setManualExcludes([])
    for (const url of Object.values(pdfUrlsRef.current)) URL.revokeObjectURL(url)
    pdfUrlsRef.current = {}
    setPdfUrls({})

    const passbookProgress: ProgressEntry[] = items.map((it) => ({
      id: it.id,
      fileName: `[通帳] ${it.file.name}`,
      status: 'pending'
    }))
    const certProgress: ProgressEntry[] = certItems.map((it) => ({
      id: it.id,
      fileName: `[残高証明] ${it.file.name}`,
      status: 'pending'
    }))
    setProgress([...passbookProgress, ...certProgress])

    const updateProgressById = (id: string, patch: Partial<ProgressEntry>) => {
      setProgress((p) => p.map((e) => (e.id === id ? { ...e, ...patch } : e)))
    }

    // ----- 通帳の解析 -----
    const passbookResults: ParsedPassbook[] = []
    const newUrls: Record<string, string> = {}
    const passbookQueue = [...items]
    const processPassbook = async (it: UploadItem) => {
      updateProgressById(it.id, { status: 'uploading', uploadPct: 0, startedAt: Date.now() })
      try {
        const form = new FormData()
        form.append('file', it.file)
        form.append('passbookId', it.id)
        form.append('fileName', it.file.name)
        form.append('label', it.label)
        form.append('bankName', it.bankName)
        form.append('branchName', it.branchName)
        form.append('accountNumber', it.accountNumber)
        form.append('startDate', startDate)
        form.append('endDate', endDate)
        const r = await uploadWithProgress(
          '/api/analyze',
          form,
          (pct) => updateProgressById(it.id, { uploadPct: pct }),
          () => updateProgressById(it.id, { status: 'analyzing', uploadPct: 1 })
        )
        if (r.status < 200 || r.status >= 300) {
          let msg = `HTTP ${r.status} ${r.statusText}`
          try {
            const j = JSON.parse(r.body)
            if (j?.error) msg = j.error
          } catch {}
          throw new Error(msg)
        }
        const data = JSON.parse(r.body)
        passbookResults.push(data.passbook)
        const url = URL.createObjectURL(it.file)
        newUrls[data.passbook.passbookId] = url
        updateProgressById(it.id, { status: 'done', finishedAt: Date.now() })
      } catch (err) {
        updateProgressById(it.id, {
          status: 'error',
          message: (err as Error).message || '不明なエラー',
          finishedAt: Date.now()
        })
      }
    }

    // ----- 残高証明書の解析 -----
    const certResults: ParsedBalanceCert[] = []
    const certQueue = [...certItems]
    const processCert = async (it: BalanceCertUploadItem) => {
      updateProgressById(it.id, { status: 'uploading', uploadPct: 0, startedAt: Date.now() })
      try {
        const form = new FormData()
        form.append('file', it.file)
        form.append('certId', it.id)
        form.append('fileName', it.file.name)
        const r = await uploadWithProgress(
          '/api/analyze-balance',
          form,
          (pct) => updateProgressById(it.id, { uploadPct: pct }),
          () => updateProgressById(it.id, { status: 'analyzing', uploadPct: 1 })
        )
        if (r.status < 200 || r.status >= 300) {
          let msg = `HTTP ${r.status} ${r.statusText}`
          try {
            const j = JSON.parse(r.body)
            if (j?.error) msg = j.error
          } catch {}
          throw new Error(msg)
        }
        const data = JSON.parse(r.body)
        certResults.push(data.cert)
        updateProgressById(it.id, { status: 'done', finishedAt: Date.now() })
      } catch (err) {
        updateProgressById(it.id, {
          status: 'error',
          message: (err as Error).message || '不明なエラー',
          finishedAt: Date.now()
        })
      }
    }

    const workers: Promise<void>[] = []
    const totalSlots = Math.min(MAX_PARALLEL, passbookQueue.length + certQueue.length)
    for (let i = 0; i < totalSlots; i++) {
      workers.push(
        (async () => {
          while (passbookQueue.length > 0 || certQueue.length > 0) {
            const passbook = passbookQueue.shift()
            if (passbook) {
              await processPassbook(passbook)
              continue
            }
            const cert = certQueue.shift()
            if (cert) {
              await processCert(cert)
              continue
            }
            return
          }
        })()
      )
    }
    await Promise.all(workers)

    setPassbooks(passbookResults)
    pdfUrlsRef.current = newUrls
    setPdfUrls(newUrls)
    setParsedCerts(certResults)

    // 残高証明書の行を depositRows に集約。基準日も最初のものから推測
    const allDepositRows: DepositRow[] = []
    let inferredRefDate = ''
    for (const c of certResults) {
      allDepositRows.push(...c.rows)
      if (!inferredRefDate && c.referenceDate) inferredRefDate = c.referenceDate
    }
    setDepositRows(allDepositRows)
    if (inferredRefDate && !referenceDate) setReferenceDate(inferredRefDate)

    const haveResults = passbookResults.length > 0 || certResults.length > 0
    if (haveResults) {
      setActiveTab(passbookResults.length > 0 ? 'movement' : 'deposit')
      setScreen('results')
    }
    setAnalyzing(false)
  }

  const updatePassbook = (next: ParsedPassbook) => {
    setPassbooks((prev) => prev.map((p) => (p.passbookId === next.passbookId ? next : p)))
  }

  const downloadExcel = async () => {
    const summaryText = findSummaryPattern(allPatterns, summaryPatternId).text
    const res = await fetch('/api/excel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        passbooks,
        assetTable,
        summaryText,
        depositRows,
        referenceDate
      })
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

  // 解析データのJSON保存
  const downloadStateJson = () => {
    const state = {
      version: 1,
      savedAt: new Date().toISOString(),
      startDate,
      endDate,
      referenceDate,
      passbooks,
      parsedCerts,
      depositRows,
      overrides,
      manualIncludes,
      manualExcludes,
      summaryPatternId,
      customPatterns,
      atmKeywords
    }
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bank-analyzer-state-${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/:/g, '-')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // 解析データのJSON読込み
  const handleLoadStateFiles = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const state = JSON.parse(text)
      if (typeof state !== 'object' || !state || state.version !== 1) {
        alert('対応していないファイル形式です（version 1 のJSONのみ対応）')
        return
      }
      // PDF Object URL は復元できないので破棄
      for (const url of Object.values(pdfUrlsRef.current)) URL.revokeObjectURL(url)
      pdfUrlsRef.current = {}
      setPdfUrls({})

      if (typeof state.startDate === 'string') setStartDate(state.startDate)
      if (typeof state.endDate === 'string') setEndDate(state.endDate)
      if (typeof state.referenceDate === 'string') setReferenceDate(state.referenceDate)
      if (Array.isArray(state.passbooks)) setPassbooks(state.passbooks)
      if (Array.isArray(state.parsedCerts)) setParsedCerts(state.parsedCerts)
      if (Array.isArray(state.depositRows)) setDepositRows(state.depositRows)
      if (state.overrides && typeof state.overrides === 'object') setOverrides(state.overrides)
      if (Array.isArray(state.manualIncludes)) setManualIncludes(state.manualIncludes)
      if (Array.isArray(state.manualExcludes)) setManualExcludes(state.manualExcludes)
      if (typeof state.summaryPatternId === 'string') setSummaryPatternId(state.summaryPatternId)
      if (Array.isArray(state.customPatterns)) setCustomPatterns(state.customPatterns)
      if (Array.isArray(state.atmKeywords)) setAtmKeywords(state.atmKeywords)

      const hasResults =
        (Array.isArray(state.passbooks) && state.passbooks.length > 0) ||
        (Array.isArray(state.depositRows) && state.depositRows.length > 0)
      if (hasResults) {
        setActiveTab(state.passbooks?.length > 0 ? 'movement' : 'deposit')
        setScreen('results')
      }
      alert(
        `解析データを復元しました。\n保存日時: ${state.savedAt || '不明'}\n\n注: PDFビューアは表示されません（PDFファイル自体はJSONに保存できないため）。\n  データの編集・Excel出力は可能です。`
      )
    } catch (err) {
      alert(`読み込みエラー: ${(err as Error).message}`)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow flex">
        <button
          type="button"
          onClick={() => setScreen('upload')}
          className={`px-5 py-2.5 text-sm font-bold border-b-2 transition ${
            screen === 'upload'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          ① アップロード・期間指定・通帳登録
        </button>
        <button
          type="button"
          onClick={() => setScreen('results')}
          disabled={passbooks.length === 0 && depositRows.length === 0 && parsedCerts.length === 0}
          className={`px-5 py-2.5 text-sm font-bold border-b-2 transition ${
            screen === 'results'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-700 disabled:text-slate-300 disabled:cursor-not-allowed'
          }`}
        >
          ② 解析結果
          {(passbooks.length > 0 || certItems.length > 0) && (
            <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
              通帳{passbooks.length} / 残証{parsedCerts.length}
            </span>
          )}
        </button>
      </div>

      {screen === 'upload' && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3" style={{ height: 'calc(100vh - 220px)', minHeight: 480 }}>
        <div className="grid grid-rows-[auto_1fr] gap-3 min-h-0">
          <section className="bg-white rounded-lg shadow p-3">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold text-sm">①解析期間</h2>
              <div className="flex items-center gap-1">
                <label
                  className="text-xs bg-slate-600 text-white px-2 py-1 rounded hover:bg-slate-700 cursor-pointer"
                  title="以前保存したJSONを読み込んで作業を再開"
                >
                  📂 JSON読込
                  <input
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={(e) => {
                      handleLoadStateFiles(e.target.files)
                      e.target.value = ''
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setAtmModalOpen(true)}
                  className="text-xs bg-slate-200 text-slate-800 px-2 py-1 rounded hover:bg-slate-300"
                >
                  ATM出金判定キーワード（{atmKeywords.length}件）
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 items-end">
              <label className="flex flex-col text-xs">
                <span className="mb-1 text-slate-600">開始日（西暦/和暦）</span>
                <input
                  type="text"
                  placeholder="2025-01-01 / 令和7年1月1日"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="border border-slate-300 rounded px-2 py-1 text-sm w-44 font-mono"
                />
              </label>
              <label className="flex flex-col text-xs">
                <span className="mb-1 text-slate-600">終了日（西暦/和暦）</span>
                <input
                  type="text"
                  placeholder="2026-04-30 / 令和8年4月30日"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="border border-slate-300 rounded px-2 py-1 text-sm w-44 font-mono"
                />
              </label>
              <label className="flex flex-col text-xs">
                <span className="mb-1 text-slate-600">基準日（残高証明書用）</span>
                <input
                  type="text"
                  placeholder="2026-02-20 / 令和8年2月20日"
                  value={referenceDate}
                  onChange={(e) => setReferenceDate(e.target.value)}
                  className="border border-slate-300 rounded px-2 py-1 text-sm w-44 font-mono"
                />
              </label>
              <button
                type="button"
                disabled={
                  analyzing ||
                  (items.length === 0 && certItems.length === 0) ||
                  (items.length > 0 && (!startDate || !endDate))
                }
                onClick={handleAnalyze}
                className="bg-blue-600 text-white px-4 py-2 rounded font-bold text-sm hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
              >
                {analyzing
                  ? '解析中…'
                  : `${items.length + certItems.length}件を解析`}
              </button>
            </div>
            {progress.length > 0 && (
              <ul className="mt-2 text-xs space-y-1 max-h-32 overflow-auto">
                {progress.map((p) => {
                  const elapsed = p.startedAt
                    ? Math.floor(((p.finishedAt ?? Date.now()) - p.startedAt) / 1000)
                    : 0
                  const stageLabel =
                    p.status === 'pending'
                      ? '待機中'
                      : p.status === 'uploading'
                      ? `送信中 ${Math.round((p.uploadPct ?? 0) * 100)}%`
                      : p.status === 'analyzing'
                      ? 'Gemini解析中'
                      : p.status === 'done'
                      ? '完了'
                      : 'エラー'
                  const icon =
                    p.status === 'done'
                      ? '✓'
                      : p.status === 'error'
                      ? '✗'
                      : p.status === 'analyzing' || p.status === 'uploading'
                      ? '⏳'
                      : '・'
                  const color =
                    p.status === 'done'
                      ? 'text-green-600'
                      : p.status === 'error'
                      ? 'text-red-600'
                      : p.status === 'analyzing' || p.status === 'uploading'
                      ? 'text-blue-600'
                      : 'text-slate-400'
                  return (
                    <li key={p.id} className="flex items-center gap-2" data-tick={tick}>
                      <span className={`${color} w-4 text-center`}>{icon}</span>
                      <span className="truncate flex-1">{p.fileName}</span>
                      <span className={`${color} font-medium whitespace-nowrap`}>{stageLabel}</span>
                      {p.startedAt && (
                        <span className="text-slate-500 font-mono w-12 text-right">
                          {String(Math.floor(elapsed / 60)).padStart(2, '0')}:
                          {String(elapsed % 60).padStart(2, '0')}
                        </span>
                      )}
                      {p.message && (
                        <span className="text-red-600 truncate" title={p.message}>
                          {p.message}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <div className="grid grid-cols-2 gap-3 min-h-0">
            <section className="bg-white rounded-lg shadow p-3 flex flex-col min-h-0">
              <h2 className="font-bold text-sm mb-2">②通帳PDF</h2>
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
                className={`flex-1 min-h-0 border-2 border-dashed rounded p-3 text-center flex flex-col items-center justify-center transition ${
                  dragOver ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50'
                }`}
              >
                <p className="text-slate-600 mb-2 text-xs">通帳PDFをドラッグ＆ドロップ</p>
                <label className="inline-block bg-slate-700 text-white px-3 py-1.5 rounded cursor-pointer hover:bg-slate-800 text-xs">
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
                  <p className="mt-2 text-xs text-slate-500">{items.length}件登録済み</p>
                )}
              </div>
            </section>

            <section className="bg-white rounded-lg shadow p-3 flex flex-col min-h-0">
              <h2 className="font-bold text-sm mb-2">④残高証明書PDF</h2>
              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  setCertDragOver(true)
                }}
                onDragLeave={() => setCertDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setCertDragOver(false)
                  addCertFiles(Array.from(e.dataTransfer.files))
                }}
                className={`flex-1 min-h-0 border-2 border-dashed rounded p-3 text-center flex flex-col items-center justify-center transition ${
                  certDragOver ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 bg-slate-50'
                }`}
              >
                <p className="text-slate-600 mb-2 text-xs">残高証明書PDFをドラッグ＆ドロップ</p>
                <label className="inline-block bg-emerald-700 text-white px-3 py-1.5 rounded cursor-pointer hover:bg-emerald-800 text-xs">
                  ファイルを選択
                  <input
                    type="file"
                    accept="application/pdf"
                    multiple
                    className="hidden"
                    onChange={(e) => addCertFiles(Array.from(e.target.files || []))}
                  />
                </label>
                {certItems.length > 0 && (
                  <ul className="mt-2 text-xs text-slate-600 space-y-0.5 max-h-24 overflow-auto w-full">
                    {certItems.map((c) => (
                      <li key={c.id} className="flex items-center gap-1 px-1">
                        <span className="truncate flex-1 text-left">{c.file.name}</span>
                        <button
                          type="button"
                          onClick={() => removeCertItem(c.id)}
                          className="text-red-600 hover:underline"
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>
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
      )}

      {screen === 'results' && (passbooks.length > 0 || depositRows.length > 0 || parsedCerts.length > 0) && (
        <section className="bg-white rounded-lg shadow p-4 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex flex-wrap gap-1 border-b">
              {passbooks.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('movement')}
                  className={`px-3 py-2 text-sm ${
                    activeTab === 'movement' ? 'border-b-2 border-blue-600 font-bold text-blue-700' : 'text-slate-600'
                  }`}
                >
                  金融資産異動一覧表
                </button>
              )}
              <button
                type="button"
                onClick={() => setActiveTab('deposit')}
                className={`px-3 py-2 text-sm ${
                  activeTab === 'deposit' ? 'border-b-2 border-blue-600 font-bold text-blue-700' : 'text-slate-600'
                }`}
              >
                預金一覧表
                {depositRows.length > 0 && (
                  <span className="ml-1 text-xs text-slate-500">({depositRows.length})</span>
                )}
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
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={downloadStateJson}
                className="bg-slate-600 text-white px-3 py-2 rounded hover:bg-slate-700 text-sm"
                title="現在の解析データをJSONファイルとして保存（再開用）"
              >
                💾 JSON保存
              </button>
              <label
                className="bg-slate-600 text-white px-3 py-2 rounded hover:bg-slate-700 text-sm cursor-pointer"
                title="保存しておいたJSONを読み込んで復元"
              >
                📂 JSON読込
                <input
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => {
                    handleLoadStateFiles(e.target.files)
                    e.target.value = ''
                  }}
                />
              </label>
              <button
                type="button"
                onClick={downloadExcel}
                className="bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700 text-sm font-bold"
              >
                Excelダウンロード
              </button>
            </div>
          </div>

          {activeTab === 'movement' && passbooks.length > 0 ? (
            <AssetMovementView
              table={assetTable}
              passbooks={passbooks}
              summaryPatternId={summaryPatternId}
              allPatterns={allPatterns}
              onSummaryPatternChange={setSummaryPatternId}
              onOpenSummaryEditor={() => setSummaryModalOpen(true)}
              onConclusionChange={(rowId, value) =>
                setOverrides((prev) => ({ ...prev, [rowId]: { ...prev[rowId], conclusionAmount: value } }))
              }
              onRemarksChange={(rowId, value) =>
                setOverrides((prev) => ({ ...prev, [rowId]: { ...prev[rowId], remarks: value } }))
              }
              onRemoveRow={handleRemoveRow}
            />
          ) : activeTab === 'deposit' ? (
            <DepositSummaryView
              rows={depositRows}
              referenceDate={referenceDate}
              onReferenceDateChange={setReferenceDate}
              onRowChange={handleDepositRowChange}
              onAddBlankRow={handleAddBlankDepositRow}
              onRemoveRow={handleRemoveDepositRow}
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

      <SummaryPatternsModal
        open={summaryModalOpen}
        customPatterns={customPatterns}
        onChange={setCustomPatterns}
        onClose={() => setSummaryModalOpen(false)}
      />
    </div>
  )
}
