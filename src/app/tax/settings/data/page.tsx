'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { load, save, Store } from '@/lib/tax/storage'
import {
  BackLink,
  Card,
  PageContainer,
  PageTitle,
  PrimaryButton,
  SecondaryButton,
  SectionLabel,
} from '@/components/tax/ui'
import { downloadFile, shareFiles } from '@/lib/tax/csv'

const EXPORT_VERSION = 1

type ExportEnvelope = {
  app: 'tax-withholding-assistant'
  version: number
  exportedAt: string
  store: Store
}

export default function DataExportPage() {
  const [store, setStore] = useState<Store | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    load().then(setStore)
  }, [])

  const stats = store && {
    employees: store.employees.length,
    accountants: store.accountants.length,
    payments: store.dailyPayments.length,
  }

  const buildEnvelope = (s: Store): ExportEnvelope => ({
    app: 'tax-withholding-assistant',
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    store: s,
  })

  const doExport = async () => {
    if (!store) return
    setBusy(true)
    setMessage(null)
    try {
      const env = buildEnvelope(store)
      const json = JSON.stringify(env, null, 2)
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const filename = `納付書アプリ_バックアップ_${ts}.json`
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
      const file = new File([blob], filename, { type: 'application/json' })
      const shared = await shareFiles([file], '納付書アプリ バックアップ')
      if (!shared) downloadFile(blob, filename)
      setMessage({ tone: 'ok', text: 'エクスポートが完了しました。保存先を選んでください。' })
    } catch (err) {
      console.error(err)
      setMessage({ tone: 'error', text: 'エクスポートに失敗しました。' })
    } finally {
      setBusy(false)
    }
  }

  const doImport = async (file: File) => {
    if (!confirm(
      `現在のデータは上書きされます。よろしいですか？\n\nファイル: ${file.name}`
    )) return
    setBusy(true)
    setMessage(null)
    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as Partial<ExportEnvelope>
      if (parsed.app !== 'tax-withholding-assistant' || !parsed.store) {
        setMessage({ tone: 'error', text: 'このアプリのバックアップファイルではありません。' })
        return
      }
      await save(parsed.store)
      const reloaded = await load()
      setStore(reloaded)
      setMessage({ tone: 'ok', text: 'インポートが完了しました。データが復元されました。' })
    } catch (err) {
      console.error(err)
      setMessage({ tone: 'error', text: 'インポートに失敗しました。ファイルが破損している可能性があります。' })
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <PageContainer>
      <BackLink href="/tax/settings" label="設定" />
      <PageTitle>データのバックアップ／移行</PageTitle>

      <p className="text-[14px] text-gray-600 mb-4 leading-relaxed">
        納付者情報・従業員・税理士・支払記録を含む全データをJSONファイルとして書き出し・取り込みできます。
        新しいアプリへの移行、機種変更時のバックアップにご利用ください。
      </p>

      {stats && (
        <Card className="mb-4">
          <div className="text-[13px] text-gray-500 mb-1">現在のデータ</div>
          <div className="grid grid-cols-3 gap-3 tabular-nums">
            <div>
              <div className="text-[11px] text-gray-500">従業員</div>
              <div className="text-[20px] font-bold">{stats.employees}<span className="text-[12px] font-normal ml-1">名</span></div>
            </div>
            <div>
              <div className="text-[11px] text-gray-500">税理士</div>
              <div className="text-[20px] font-bold">{stats.accountants}<span className="text-[12px] font-normal ml-1">名</span></div>
            </div>
            <div>
              <div className="text-[11px] text-gray-500">支払記録</div>
              <div className="text-[20px] font-bold">{stats.payments}<span className="text-[12px] font-normal ml-1">件</span></div>
            </div>
          </div>
        </Card>
      )}

      <SectionLabel>エクスポート</SectionLabel>
      <Card className="space-y-3">
        <p className="text-[13px] text-gray-700 leading-relaxed">
          現在のすべてのデータをJSONファイルとして書き出します。
          このファイルは新しいアプリ（komon-app）への移行にも使えます。
        </p>
        <PrimaryButton onClick={() => void doExport()} disabled={busy || !store}>
          データをファイルに書き出す
        </PrimaryButton>
      </Card>

      <SectionLabel>インポート</SectionLabel>
      <Card className="space-y-3">
        <p className="text-[13px] text-gray-700 leading-relaxed">
          以前書き出した JSON ファイルからデータを復元します。
          <b className="text-red-600">現在のデータは上書き</b>されます。
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) void doImport(f)
          }}
          className="hidden"
        />
        <SecondaryButton
          onClick={() => fileRef.current?.click()}
          disabled={busy}
        >
          JSONファイルを選んで読み込む
        </SecondaryButton>
      </Card>

      {message && (
        <div
          className={`mt-4 rounded-2xl p-4 text-[14px] leading-relaxed ${
            message.tone === 'ok'
              ? 'bg-green-50 ring-1 ring-green-200 text-green-900'
              : 'bg-red-50 ring-1 ring-red-200 text-red-900'
          }`}
        >
          {message.tone === 'ok' ? '✅ ' : '⚠️ '}
          {message.text}
        </div>
      )}

      <p className="text-[11px] text-gray-400 mt-4 leading-relaxed px-1">
        ※ エクスポートファイルには従業員の個人情報が含まれます。取り扱いにご注意ください。
        <br />
        ※ このファイル形式は「komon-app」との互換仕様です（envelope に app: tax-withholding-assistant, version: 1 を含みます）。
      </p>
    </PageContainer>
  )
}
