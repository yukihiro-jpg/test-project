'use client'

import { useState, useCallback } from 'react'
import UploadDialog from '@/components/bank-statement/UploadDialog'
import AccountMasterUploader from '@/components/bank-statement/AccountMasterUploader'
import PatternListDialog from '@/components/bank-statement/PatternListDialog'
import StatementViewer from '@/components/bank-statement/StatementViewer'
import JournalEntryTable from '@/components/bank-statement/JournalEntryTable'
import ColumnMappingDialog from '@/components/bank-statement/ColumnMappingDialog'
import CsvExportButton from '@/components/bank-statement/CsvExportButton'
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
import { loadAccountMaster, loadSubAccountMaster } from '@/lib/bank-statement/account-master'

export default function BankStatementContent() {
  const [pages, setPages] = useState<StatementPage[]>([])
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([])
  const [accountMaster, setAccountMaster] = useState<AccountItem[]>(() => loadAccountMaster())
  const [subAccountMaster, setSubAccountMaster] = useState<SubAccountItem[]>(() => loadSubAccountMaster())
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [uploadConfig, setUploadConfig] = useState<UploadConfig | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showPatternList, setShowPatternList] = useState(false)

  // 列マッピング用state
  const [showColumnMapping, setShowColumnMapping] = useState(false)
  const [rawPages, setRawPages] = useState<RawTableRow[][] | null>(null)
  const [pendingSourceType, setPendingSourceType] = useState<ParseResult['sourceType'] | null>(null)
  const [pendingImageUrls, setPendingImageUrls] = useState<string[] | null>(null)

  const applyParseResultFn = useCallback(
    (result: ParseResult, config: UploadConfig) => {
      setPages(result.pages)
      setCurrentPageIndex(0)

      const patterns = getPatterns()
      const entries = mapTransactionsToJournalEntries(
        result.pages,
        config.accountCode,
        config.accountName,
        patterns,
        accountMaster,
      )
      setJournalEntries(entries)
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
        // 自然な進捗: 最初は速く、後半はゆっくり（99%まで到達して待つ感じにしない）
        const startTime = Date.now()
        const progressTimer = setInterval(() => {
          const elapsed = (Date.now() - startTime) / 1000
          // 指数関数で徐々に遅くなる: 0→60%は速い、60→95%はゆっくり
          const progress = Math.min(15 + 80 * (1 - Math.exp(-elapsed / 8)), 95)
          setLoadingProgress(Math.round(progress))
        }, 200)

        const result = await parseFile(config.file)
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

  const selectedTransactionId = (() => {
    if (!selectedEntryId) return null
    const entry = journalEntries.find((e) => e.id === selectedEntryId)
    return entry?.transactionId ?? null
  })()

  return (
    <div className="h-screen flex flex-col bg-gray-100 bank-statement-app">
      {/* ヘッダー */}
      <header className="bg-gray-800 px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-base font-bold text-white">通帳CSV変換</h1>
          <a href="/" className="text-xs text-gray-400 hover:text-white hover:underline">
            トップ
          </a>
        </div>
        <div className="flex items-center gap-2">
          <AccountMasterUploader
            accountMaster={accountMaster}
            subAccountMaster={subAccountMaster}
            onAccountUpdate={handleAccountMasterUpdate}
            onSubAccountUpdate={handleSubAccountMasterUpdate}
          />
          <button onClick={() => setShowPatternList(true)}
            className="px-3 py-1.5 text-xs font-medium bg-white/10 hover:bg-white/20 text-white rounded border border-white/20">
            パターン一覧
          </button>
          <UploadDialog
            accountMaster={accountMaster}
            onUpload={handleUpload}
            isLoading={isLoading}
          />
          {journalEntries.length > 0 && (
            <CsvExportButton entries={journalEntries}
              dateFrom={dateFrom} dateTo={dateTo}
              onDateFromChange={setDateFrom} onDateToChange={setDateTo} />
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
    </div>
  )
}
