'use client'

import { useState, useCallback } from 'react'
import UploadDialog from '@/components/bank-statement/UploadDialog'
import AccountMasterUploader from '@/components/bank-statement/AccountMasterUploader'
import PatternListDialog from '@/components/bank-statement/PatternListDialog'
import FixedJournalDialog from '@/components/bank-statement/FixedJournalDialog'
import StatementViewer from '@/components/bank-statement/StatementViewer'
import JournalEntryTable from '@/components/bank-statement/JournalEntryTable'
import ColumnMappingDialog from '@/components/bank-statement/ColumnMappingDialog'
import CsvExportButton from '@/components/bank-statement/CsvExportButton'
import { appendTempEntries, getTempEntryCount, clearTempEntries, getTempEntries } from '@/lib/bank-statement/temp-store'
import { generateQuestionList, downloadQuestionExcel } from '@/lib/bank-statement/question-list'
import QuestionListDialog from '@/components/bank-statement/QuestionListDialog'
import TempDataDialog from '@/components/bank-statement/TempDataDialog'
import { applyCompoundAutoAmounts, downloadCsv } from '@/lib/bank-statement/csv-generator'
import { learnAllFromEntries } from '@/lib/bank-statement/pattern-store'
import ResizableSplitPanel from '@/components/bank-statement/ResizableSplitPanel'
import type {
  StatementPage,
  JournalEntry,
  AccountItem,
  SubAccountItem,
  UploadConfig,
  ParseResult,
  RawTableRow,
  ColumnMapping,
} from '@/lib/bank-statement/types'
import { parseFile, applyColumnMapping } from '@/lib/bank-statement/transaction-extractor'
import { mapTransactionsToJournalEntries } from '@/lib/bank-statement/journal-mapper'
import { getPatterns } from '@/lib/bank-statement/pattern-store'
import { loadAccountMaster, loadSubAccountMaster, loadAccountTaxMaster, getDefaultTaxCode } from '@/lib/bank-statement/account-master'
import { getDefaultTaxCodeByName, isPL } from '@/lib/bank-statement/tax-codes'
import type { AccountTaxItem } from '@/lib/bank-statement/types'
import ClientSelector from '@/components/bank-statement/ClientSelector'
import type { Client } from '@/lib/bank-statement/client-store'
import { getSelectedClientId, setSelectedClientId } from '@/lib/bank-statement/client-store'

export default function BankStatementContent() {
  // 顧問先選択
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [showClientSelector, setShowClientSelector] = useState(true)

  const [pages, setPages] = useState<StatementPage[]>([])
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([])
  const [accountMaster, setAccountMaster] = useState<AccountItem[]>([])
  const [subAccountMaster, setSubAccountMaster] = useState<SubAccountItem[]>([])
  const [accountTaxMaster, setAccountTaxMaster] = useState<AccountTaxItem[]>([])
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [uploadConfig, setUploadConfig] = useState<UploadConfig | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [lastPeriodFrom, setLastPeriodFrom] = useState('')
  const [lastPeriodTo, setLastPeriodTo] = useState('')
  const [showPatternList, setShowPatternList] = useState(false)
  const [showFixedJournal, setShowFixedJournal] = useState(false)
  const [showQuestionList, setShowQuestionList] = useState(false)
  const [showTempData, setShowTempData] = useState(false)
  const [tempCount, setTempCount] = useState(() => getTempEntryCount())

  // 顧問先選択ハンドラ
  const handleClientSelect = useCallback((client: Client) => {
    setSelectedClient(client)
    setShowClientSelector(false)
    // 顧問先別データを読み込み
    setAccountMaster(loadAccountMaster())
    setSubAccountMaster(loadSubAccountMaster())
    setAccountTaxMaster(loadAccountTaxMaster())
    // 仕訳データをリセット
    setPages([])
    setJournalEntries([])
  }, [])

  const handleBackToClientList = useCallback(() => {
    setSelectedClientId(null)
    setSelectedClient(null)
    setShowClientSelector(true)
    setPages([])
    setJournalEntries([])
  }, [])

  // 列マッピング用state（hooksは条件分岐の前に定義する必要がある）
  const [showColumnMapping, setShowColumnMapping] = useState(false)
  const [rawPages, setRawPages] = useState<RawTableRow[][] | null>(null)
  const [pendingSourceType, setPendingSourceType] = useState<ParseResult['sourceType'] | null>(null)
  const [pendingImageUrls, setPendingImageUrls] = useState<string[] | null>(null)

  // 以下は顧問先選択後の処理

  const applyParseResultFn = useCallback(
    (result: ParseResult, config: UploadConfig) => {
      setPages(result.pages)
      setCurrentPageIndex(0)

      // 期間を保存（次回の「前回の期間をセット」用）
      if (config.periodFrom) setLastPeriodFrom(config.periodFrom)
      if (config.periodTo) setLastPeriodTo(config.periodTo)

      const patterns = getPatterns()
      const entries = mapTransactionsToJournalEntries(
        result.pages,
        config.accountCode,
        config.accountName,
        patterns,
        accountMaster,
      )
      // 科目別消費税CDを自動設定（パターン学習で設定済みでないもの）
      const taxMaster = loadAccountTaxMaster()
      const entriesWithTax = entries.map((e) => {
        const updated = { ...e }
        // 科目名が空の場合、科目チェックリストから補完
        if (updated.debitCode && !updated.debitName) {
          const acc = accountMaster.find((a) => a.code === updated.debitCode)
          if (acc) updated.debitName = acc.shortName || acc.name
        }
        if (updated.creditCode && !updated.creditName) {
          const acc = accountMaster.find((a) => a.code === updated.creditCode)
          if (acc) updated.creditName = acc.shortName || acc.name
        }
        // 事業者取引区分: パターン学習で未設定なら0（インボイス登録事業者）をデフォルト
        if (!updated.debitBusinessType) {
          updated.debitBusinessType = '0'
        }
        // 消費税CD
        if (!updated.debitTaxCode || updated.debitTaxCode === '0') {
          // 1. 科目別消費税マスタから検索
          const debitTax = getDefaultTaxCode(taxMaster, updated.debitCode)
          const creditTax = getDefaultTaxCode(taxMaster, updated.creditCode)
          const tax = debitTax || creditTax
          if (tax) {
            updated.debitTaxCode = tax.taxCode
            updated.debitTaxType = tax.taxName
          } else {
            // 2. 科目名ベースのデフォルト判定（パターン学習未済・マスタ未登録の場合）
            const debitAcc = accountMaster.find((a) => a.code === updated.debitCode)
            const creditAcc = accountMaster.find((a) => a.code === updated.creditCode)
            // PL売上/仕入の判定
            let category: 'sales' | 'purchase' | null = null
            if (creditAcc && isPL(creditAcc.bsPl) && creditAcc.normalBalance === '貸方') {
              category = 'sales'
            } else if (debitAcc && isPL(debitAcc.bsPl) && debitAcc.normalBalance === '借方') {
              category = 'purchase'
            }
            const nameTax = getDefaultTaxCodeByName(
              category === 'sales' ? (creditAcc?.name || creditAcc?.shortName || '') : (debitAcc?.name || debitAcc?.shortName || ''),
              category,
            )
            if (nameTax) {
              updated.debitTaxCode = nameTax.taxCode
              updated.debitTaxType = nameTax.taxName
            }
          }
        }
        // 消費税率: 標準税率10%→4、軽減税率8%→5
        if (!updated.debitTaxRate && updated.debitTaxCode && updated.debitTaxCode !== '0') {
          updated.debitTaxRate = '4' // デフォルトは標準税率10%（=4）
        }
        return updated
      })
      // 処理対象期間でフィルタ
      const from = config.periodFrom?.replace(/-/g, '') || ''
      const to = config.periodTo?.replace(/-/g, '') || ''
      const filtered = entriesWithTax.filter((e) => {
        if (!e.date) return true
        if (from && e.date < from) return false
        if (to && e.date > to) return false
        return true
      })
      setJournalEntries(filtered)
    },
    [accountMaster],
  )

  const handleUpload = useCallback(
    async (config: UploadConfig) => {
      setIsLoading(true)
      setLoadingProgress(10)
      setError(null)
      setUploadConfig(config)

      try {
        setLoadingProgress(15)
        const startTime = Date.now()
        const progressTimer = setInterval(() => {
          const elapsed = (Date.now() - startTime) / 1000
          const progress = Math.min(15 + 80 * (1 - Math.exp(-elapsed / 8)), 95)
          setLoadingProgress(Math.round(progress))
        }, 200)

        if (config.documentType === 'receipt') {
          // レシート・領収書処理
          const { renderPdfPageToImage, getPdfPageCount } = await import('@/lib/bank-statement/pdf-text-parser')
          const pageCount = await getPdfPageCount(config.file)
          const imageDataUrls: string[] = []
          for (let i = 0; i < pageCount; i++) {
            imageDataUrls.push(await renderPdfPageToImage(config.file, i + 1, 2))
          }

          const response = await fetch('/api/bank-statement/receipt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ images: imageDataUrls }),
          })
          clearInterval(progressTimer)
          setLoadingProgress(100)

          if (!response.ok) {
            const data = await response.json().catch(() => ({}))
            throw new Error(data.error || 'レシート解析に失敗しました')
          }

          const data = await response.json()
          const receipts = data.receipts || []
          if (receipts.length === 0) throw new Error('レシートデータを抽出できませんでした')

          const statementPages = imageDataUrls.map((url, i) => ({
            pageIndex: i, transactions: [],
            openingBalance: 0, closingBalance: 0, isBalanceValid: true, balanceDifference: 0,
            imageDataUrl: url,
          }))
          setPages(statementPages)
          setCurrentPageIndex(0)

          const { receiptToEntries } = await import('@/lib/bank-statement/receipt-mapper')
          const entries = receiptToEntries(receipts, config.creditCode!, config.creditName!)
          setJournalEntries(entries)
          setInfo(`${receipts.length}件のレシートから${entries.length}件の仕訳を生成しました`)
          setIsLoading(false)
          setLoadingProgress(0)
          return
        }

        if (config.documentType === 'cash-book') {
          // 現金出納帳処理（通帳と同じロジック）
          const result = await parseFile(config.file, config.accountCode)
          clearInterval(progressTimer)
          setLoadingProgress(100)

          if (result.ocrFailed) {
            setPages(result.pages)
            setCurrentPageIndex(0)
            setJournalEntries([])
            const detail = result.ocrErrorMessage ? `\n原因: ${result.ocrErrorMessage}` : ''
            setError(`現金出納帳のテキスト抽出に失敗しました。${detail}`)
            setIsLoading(false)
            setLoadingProgress(0)
            return
          }

          applyParseResultFn(result, config)
          if (result.corrections && result.corrections.length > 0) {
            setInfo(`入出金の自動補正を行いました:\n${result.corrections.join('\n')}`)
          }
          setIsLoading(false)
          setLoadingProgress(0)
          return
        }

        if (config.documentType === 'sales-invoice' || config.documentType === 'purchase-invoice') {
          // 請求書処理
          const { renderPdfPageToImage, getPdfPageCount } = await import('@/lib/bank-statement/pdf-text-parser')
          const pageCount = await getPdfPageCount(config.file)
          const imageDataUrls: string[] = []
          for (let i = 0; i < pageCount; i++) {
            imageDataUrls.push(await renderPdfPageToImage(config.file, i + 1, 2))
          }

          const invoiceType = config.documentType === 'purchase-invoice' ? 'purchase' : 'sales'
          const response = await fetch('/api/bank-statement/invoice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ images: imageDataUrls, type: invoiceType }),
          })
          clearInterval(progressTimer)
          setLoadingProgress(100)

          if (!response.ok) {
            const data = await response.json().catch(() => ({}))
            throw new Error(data.error || '請求書解析に失敗しました')
          }

          const data = await response.json()
          const invoices = data.invoices || []
          if (invoices.length === 0) throw new Error('請求書データを抽出できませんでした')

          // ページ画像を表示用に設定
          const statementPages = imageDataUrls.map((url, i) => ({
            pageIndex: i, transactions: [],
            openingBalance: 0, closingBalance: 0, isBalanceValid: true, balanceDifference: 0,
            imageDataUrl: url,
          }))
          setPages(statementPages)
          setCurrentPageIndex(0)

          // 仕訳生成
          const { salesInvoiceToEntries, purchaseInvoiceToEntries } = await import('@/lib/bank-statement/invoice-mapper')
          const entries = config.documentType === 'sales-invoice'
            ? salesInvoiceToEntries(invoices, config.debitCode!, config.debitName!, config.creditCode!, config.creditName!)
            : purchaseInvoiceToEntries(invoices, config.debitCode!, config.debitName!, config.creditCode!, config.creditName!)
          setJournalEntries(entries)
          setInfo(`${invoices.length}件の請求書から${entries.length}件の仕訳を生成しました`)
          setIsLoading(false)
          setLoadingProgress(0)
          return
        }

        // 通帳処理（従来通り）
        const result = await parseFile(config.file, config.accountCode)
        clearInterval(progressTimer)
        setLoadingProgress(100)

        if (result.needsColumnMapping && result.rawPages) {
          setRawPages(result.rawPages)
          setPendingSourceType(result.sourceType)
          setPendingImageUrls(result.pageImageUrls || null)
          setShowColumnMapping(true)
          setIsLoading(false)
          return
        }

        if (result.ocrFailed) {
          // OCR失敗: 画像のみ表示して手動入力モード
          setPages(result.pages)
          setCurrentPageIndex(0)
          setJournalEntries([])
          const detail = result.ocrErrorMessage ? `\n原因: ${result.ocrErrorMessage}` : ''
          setError(`Gemini OCRによるテキスト抽出に失敗しました。${detail}\n左側のPDF画像を参照しながら、右側の「+ 空白行追加」ボタンから手動で仕訳を入力してください。`)
          setIsLoading(false)
          return
        }

        applyParseResultFn(result, config)

        // 入出金自動補正があった場合に通知
        if (result.corrections && result.corrections.length > 0) {
          setInfo(`入出金の自動補正を行いました（残高検算により修正）:\n${result.corrections.join('\n')}`)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'ファイルの解析に失敗しました')
      } finally {
        setIsLoading(false)
        setLoadingProgress(0)
      }
    },
    [applyParseResultFn],
  )

  const handleColumnMappingConfirm = useCallback(
    (mapping: ColumnMapping) => {
      if (!rawPages || !pendingSourceType || !uploadConfig) return

      setShowColumnMapping(false)
      setIsLoading(true)

      try {
        const result: ParseResult = applyColumnMapping(rawPages, mapping, pendingSourceType)
        // 列マッピング結果のページに画像URLを付与
        if (pendingImageUrls) {
          result.pages = result.pages.map((page, i) => ({
            ...page,
            imageDataUrl: pendingImageUrls[i] || page.imageDataUrl,
          }))
        }
        applyParseResultFn(result, uploadConfig)
      } catch (err) {
        setError(err instanceof Error ? err.message : '列マッピングの適用に失敗しました')
      } finally {
        setIsLoading(false)
        setRawPages(null)
        setPendingSourceType(null)
        setPendingImageUrls(null)
      }
    },
    [rawPages, pendingSourceType, uploadConfig, applyParseResultFn, pendingImageUrls],
  )

  const handleEntrySelect = useCallback(
    (entryId: string | null) => {
      setSelectedEntryId(entryId)
      if (entryId) {
        const entry = journalEntries.find((e) => e.id === entryId)
        if (entry && entry.transactionId) {
          const page = pages.find((p) =>
            p.transactions.some((t) => t.id === entry.transactionId),
          )
          if (page && page.pageIndex !== currentPageIndex) {
            setCurrentPageIndex(page.pageIndex)
          }
        }
      }
    },
    [journalEntries, pages, currentPageIndex],
  )

  const handleAccountMasterUpdate = useCallback((items: AccountItem[]) => {
    setAccountMaster(items)
  }, [])

  const handleSubAccountMasterUpdate = useCallback((items: SubAccountItem[]) => {
    setSubAccountMaster(items)
  }, [])

  const handleBalanceOverride = useCallback(
    (pageIndex: number, field: 'openingBalance' | 'closingBalance', value: number) => {
      setPages((prev) =>
        prev.map((p) => p.pageIndex === pageIndex ? { ...p, [field]: value } : p),
      )
    },
    [],
  )

  // CSV一時保存
  const handleTempSave = useCallback(() => {
    if (journalEntries.length === 0) {
      alert('保存する仕訳データがありません')
      return
    }
    // 科目名が空の場合、科目チェックリストから補完
    const completed = journalEntries.map((e) => {
      const u = { ...e }
      if (u.debitCode && !u.debitName) {
        const acc = accountMaster.find((a) => a.code === u.debitCode)
        if (acc) u.debitName = acc.shortName || acc.name
      }
      if (u.creditCode && !u.creditName) {
        const acc = accountMaster.find((a) => a.code === u.creditCode)
        if (acc) u.creditName = acc.shortName || acc.name
      }
      return u
    })
    // パターン学習
    const applied = applyCompoundAutoAmounts(completed)
    learnAllFromEntries(applied)
    // 一時保存に追記
    const totalCount = appendTempEntries(completed)
    setTempCount(totalCount)
    // 仕訳データをクリアして次の通帳を処理可能に
    setPages([])
    setJournalEntries([])
    setUploadConfig(null)
    setError(null)
    setInfo(`${journalEntries.length}件を一時保存しました（合計${totalCount}件）`)
  }, [journalEntries])

  // 一時保存データをまとめてCSV出力
  const handleTempExport = useCallback(() => {
    const tempEntries = getTempEntries()
    if (tempEntries.length === 0) {
      alert('一時保存されたデータがありません')
      return
    }
    // 科目名補完（仮払金一括登録等で名前が空の場合）
    const completed = tempEntries.map((e) => {
      const u = { ...e }
      if (u.debitCode && !u.debitName) {
        const acc = accountMaster.find((a) => a.code === u.debitCode)
        if (acc) u.debitName = acc.shortName || acc.name
      }
      if (u.creditCode && !u.creditName) {
        const acc = accountMaster.find((a) => a.code === u.creditCode)
        if (acc) u.creditName = acc.shortName || acc.name
      }
      return u
    })
    downloadCsv(completed, undefined, selectedClient?.taxType)
    clearTempEntries()
    setTempCount(0)
    setInfo('一時保存データをCSV出力しました。一時保存はクリアされました。')
  }, [accountMaster, selectedClient])

  const handleTempClear = useCallback(() => {
    if (!confirm('一時保存データをすべて削除しますか？')) return
    clearTempEntries()
    setTempCount(0)
  }, [])

  const handleQuestionList = useCallback(() => {
    setShowQuestionList(true)
  }, [])

  const selectedTransactionId = (() => {
    if (!selectedEntryId) return null
    const entry = journalEntries.find((e) => e.id === selectedEntryId)
    return entry?.transactionId ?? null
  })()

  return (
    showClientSelector ? (
      <ClientSelector onSelect={handleClientSelect} />
    ) : (
    <div className="h-screen flex flex-col bg-gray-100 bank-statement-app">
      {/* ヘッダー */}
      <header className="bg-gray-800 px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-base font-bold text-white">会計大将インポートデータ変換</h1>
          {selectedClient && (
            <span className="text-sm text-blue-300 font-medium">{selectedClient.name}</span>
          )}
          <button onClick={handleBackToClientList}
            className="text-xs text-gray-400 hover:text-white hover:underline">
            顧問先一覧
          </button>
        </div>
        <div className="flex items-center gap-2">
          <AccountMasterUploader
            accountMaster={accountMaster}
            subAccountMaster={subAccountMaster}
            accountTaxMaster={accountTaxMaster}
            onAccountUpdate={handleAccountMasterUpdate}
            onSubAccountUpdate={handleSubAccountMasterUpdate}
            onAccountTaxUpdate={setAccountTaxMaster}
          />
          <button onClick={() => setShowPatternList(true)}
            className="px-3 py-1.5 text-xs font-medium bg-white/10 hover:bg-white/20 text-white rounded border border-white/20">
            パターン一覧
          </button>
          <button onClick={() => setShowFixedJournal(true)}
            className="px-3 py-1.5 text-xs font-medium bg-white/10 hover:bg-white/20 text-white rounded border border-white/20">
            定型仕訳
          </button>
          <UploadDialog
            accountMaster={accountMaster}
            onUpload={handleUpload}
            isLoading={isLoading}
            lastPeriodFrom={lastPeriodFrom}
            lastPeriodTo={lastPeriodTo}
          />
          {journalEntries.length > 0 && (
            <>
              <button onClick={handleTempSave}
                className="px-3 py-1.5 text-xs font-medium bg-amber-500 hover:bg-amber-600 text-white rounded">
                一時保存
              </button>
              <CsvExportButton entries={journalEntries}
                dateFrom={dateFrom} dateTo={dateTo}
                onDateFromChange={setDateFrom} onDateToChange={setDateTo} />
            </>
          )}
          {tempCount > 0 && (
            <div className="flex items-center gap-1">
              <button onClick={() => setShowTempData(true)}
                className="px-3 py-1.5 text-xs font-medium bg-gray-500 hover:bg-gray-600 text-white rounded">
                一時保存確認 ({tempCount}件)
              </button>
              <button onClick={handleTempExport}
                className="px-3 py-1.5 text-xs font-medium bg-green-600 hover:bg-green-700 text-white rounded">
                一括CSV出力
              </button>
              <button onClick={handleQuestionList}
                className="px-3 py-1.5 text-xs font-medium bg-purple-600 hover:bg-purple-700 text-white rounded">
                仮払金質問リスト
              </button>
              <button onClick={handleTempClear}
                className="px-2 py-1.5 text-xs text-gray-400 hover:text-red-400" title="一時保存をクリア">
                &times;
              </button>
            </div>
          )}
        </div>
      </header>

      {/* エラー表示 */}
      {error && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
          <span className="whitespace-pre-wrap flex-1">{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-700 shrink-0 text-lg leading-none"
          >
            &times;
          </button>
        </div>
      )}

      {/* 自動補正通知 */}
      {info && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
          <span className="whitespace-pre-wrap flex-1">{info}</span>
          <button
            onClick={() => setInfo(null)}
            className="text-amber-400 hover:text-amber-700 shrink-0 text-lg leading-none"
          >
            &times;
          </button>
        </div>
      )}

      {/* ローディング */}
      {isLoading && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-sm text-blue-700 shrink-0">ファイルを解析中...</span>
            <div className="flex-1 h-2 bg-blue-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-300"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>
            <span className="text-xs text-blue-500 w-8 text-right">{loadingProgress}%</span>
          </div>
        </div>
      )}

      {/* メインコンテンツ */}
      {pages.length > 0 ? (
        <ResizableSplitPanel
          defaultLeftPercent={35}
          minLeftPercent={20}
          maxLeftPercent={60}
          left={
            <StatementViewer
              pages={pages}
              currentPageIndex={currentPageIndex}
              onPageChange={setCurrentPageIndex}
              entries={journalEntries}
              bankAccountCode={uploadConfig?.accountCode || ''}
              onBalanceOverride={handleBalanceOverride}
            />
          }
          right={
            <JournalEntryTable
              entries={journalEntries}
              accountMaster={accountMaster}
              subAccountMaster={subAccountMaster}
              selectedEntryId={selectedEntryId}
              onSelect={handleEntrySelect}
              onEntriesChange={setJournalEntries}
              onSubAccountUpdate={handleSubAccountMasterUpdate}
              pages={pages}
              bankAccountCode={uploadConfig?.accountCode || ''}
              clientTaxType={selectedClient?.taxType || 'standard'}
            />
          }
        />
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <p className="text-lg mb-2">通帳PDFまたはExcelファイルをアップロードしてください</p>
            <p className="text-sm">
              ヘッダーの「アップロード」ボタンからファイルを選択できます
            </p>
          </div>
        </div>
      )}

      {/* 列マッピングダイアログ */}
      {showColumnMapping && rawPages && (
        <ColumnMappingDialog
          rawPages={rawPages}
          onConfirm={handleColumnMappingConfirm}
          onCancel={() => {
            setShowColumnMapping(false)
            setRawPages(null)
            setPendingSourceType(null)
          }}
        />
      )}

      {/* パターン一覧ダイアログ */}
      <PatternListDialog open={showPatternList} onClose={() => setShowPatternList(false)} />

      {/* 定型仕訳ダイアログ */}
      <FixedJournalDialog
        open={showFixedJournal}
        onClose={() => setShowFixedJournal(false)}
        accountMaster={accountMaster}
        onTempCountChange={setTempCount}
      />

      <TempDataDialog
        open={showTempData}
        onClose={() => setShowTempData(false)}
        onCountChange={setTempCount}
      />

      <QuestionListDialog
        open={showQuestionList}
        onClose={() => setShowQuestionList(false)}
        accountMaster={accountMaster}
        client={selectedClient}
      />
    </div>
    )
  )
}
