'use client'

/**
 * CSV アップロード画面
 *
 * 4種類の CSV をドラッグ&ドロップで受け付け、対象年月を指定してアップロードする。
 * アップロード成功後はレポート編集画面へ遷移。
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type FileKey = 'trialBalance' | 'transition' | 'threePeriod' | 'generalLedger'

const FILE_LABELS: Record<FileKey, string> = {
  trialBalance: '月次試算表',
  transition: '推移試算表',
  threePeriod: '3期比較推移表',
  generalLedger: '総勘定元帳',
}

export default function UploadPage({ params }: { params: { clientId: string } }) {
  const router = useRouter()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [files, setFiles] = useState<Record<FileKey, File | null>>({
    trialBalance: null,
    transition: null,
    threePeriod: null,
    generalLedger: null,
  })
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleUpload = async () => {
    if (Object.values(files).some((f) => !f)) {
      setError('全ての CSV を選択してください')
      return
    }
    setError(null)
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('clientId', params.clientId)
      fd.append('year', String(year))
      fd.append('month', String(month))
      for (const [key, file] of Object.entries(files)) {
        if (file) fd.append(key, file)
      }
      const res = await fetch('/api/reports/upload', { method: 'POST', body: fd })
      if (!res.ok) {
        const { error: msg } = await res.json()
        throw new Error(msg || 'アップロードに失敗しました')
      }
      const { report } = await res.json()
      router.push(
        `/clients/${params.clientId}/reports/${report.year}_${String(report.month).padStart(2, '0')}`,
      )
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-bold mb-6">CSV アップロード</h1>

      <div className="bg-white p-6 rounded-lg shadow-sm mb-6 space-y-4">
        <div className="flex gap-4">
          <label className="flex-1">
            <span className="block text-sm font-medium mb-1">対象年</span>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10))}
              className="w-full px-3 py-2 border border-gray-300 rounded"
            />
          </label>
          <label className="flex-1">
            <span className="block text-sm font-medium mb-1">対象月</span>
            <select
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value, 10))}
              className="w-full px-3 py-2 border border-gray-300 rounded"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {m}月
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="space-y-3">
          {(Object.keys(FILE_LABELS) as FileKey[]).map((key) => (
            <div key={key}>
              <label className="block text-sm font-medium mb-1">
                {FILE_LABELS[key]}
                {files[key] && (
                  <span className="ml-2 text-green-600 text-xs">✓ {files[key]!.name}</span>
                )}
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={(e) =>
                  setFiles((f) => ({ ...f, [key]: e.target.files?.[0] ?? null }))
                }
                className="block w-full text-sm"
              />
            </div>
          ))}
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={uploading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium py-3 rounded transition"
        >
          {uploading ? 'アップロード中...' : 'アップロードして資料を生成'}
        </button>
      </div>
    </main>
  )
}
