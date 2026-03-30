'use client'

import { useCallback, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'
import NameInput from '@/components/NameInput'
import DocumentList from '@/components/DocumentList'
import SubmitButton from '@/components/SubmitButton'

function UploadForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const clientId = searchParams.get('client')
  const yearId = searchParams.get('year')

  const [employeeName, setEmployeeName] = useState('')
  const [capturedImages, setCapturedImages] = useState<Record<string, string>>({})
  const [capturedFiles, setCapturedFiles] = useState<Record<string, File>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clientName, setClientName] = useState<string | null>(null)
  const [yearLabel, setYearLabel] = useState<string | null>(null)
  const [clientLoaded, setClientLoaded] = useState(false)

  // 顧問先名と年度を取得
  useState(() => {
    if (!clientId || !yearId) return
    fetch(`/api/clients?id=${encodeURIComponent(clientId)}&year=${encodeURIComponent(yearId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.name) setClientName(data.name)
        if (data.yearLabel) setYearLabel(data.yearLabel)
        setClientLoaded(true)
      })
      .catch(() => setClientLoaded(true))
  })

  const handleCapture = useCallback((docTypeId: string, file: File) => {
    const url = URL.createObjectURL(file)
    setCapturedImages((prev) => ({ ...prev, [docTypeId]: url }))
    setCapturedFiles((prev) => ({ ...prev, [docTypeId]: file }))
  }, [])

  const handleRemove = useCallback((docTypeId: string) => {
    setCapturedImages((prev) => {
      const next = { ...prev }
      if (next[docTypeId]) {
        URL.revokeObjectURL(next[docTypeId])
        delete next[docTypeId]
      }
      return next
    })
    setCapturedFiles((prev) => {
      const next = { ...prev }
      delete next[docTypeId]
      return next
    })
  }, [])

  const handleSubmit = async () => {
    if (!clientId || !yearId || !employeeName.trim() || Object.keys(capturedFiles).length === 0) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('clientId', clientId)
      formData.append('yearId', yearId)
      formData.append('employeeName', employeeName.trim())

      for (const [docTypeId, file] of Object.entries(capturedFiles)) {
        formData.append(docTypeId, file)
      }

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '送信に失敗しました')
      }

      router.push('/complete')
    } catch (err) {
      setError(err instanceof Error ? err.message : '送信に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  if (!clientId || !yearId) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center">
          <p className="text-lg text-red-600 font-bold mb-2">
            {!clientId ? '顧問先が指定されていません' : '年度が指定されていません'}
          </p>
          <p className="text-gray-500 text-sm">
            QRコードまたは専用URLからアクセスしてください。
          </p>
        </div>
      </div>
    )
  }

  const capturedCount = Object.keys(capturedFiles).length
  const canSubmit = employeeName.trim().length > 0 && capturedCount > 0

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-24">
      <header className="mb-6">
        <h1 className="text-xl font-bold text-gray-800">
          年末調整書類アップロード
        </h1>
        <div className="flex items-center gap-2 mt-1">
          {yearLabel && (
            <span className="inline-block px-2 py-0.5 text-xs font-bold bg-blue-100 text-blue-700 rounded">
              {yearLabel}
            </span>
          )}
          {clientName && (
            <span className="text-sm text-blue-600">{clientName}</span>
          )}
        </div>
      </header>

      <NameInput value={employeeName} onChange={setEmployeeName} />

      <DocumentList
        capturedImages={capturedImages}
        onCapture={handleCapture}
        onRemove={handleRemove}
      />

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <SubmitButton
        disabled={!canSubmit}
        loading={loading}
        capturedCount={capturedCount}
        onClick={handleSubmit}
      />
    </div>
  )
}

export default function UploadPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-gray-500">読み込み中...</p>
        </div>
      }
    >
      <UploadForm />
    </Suspense>
  )
}
