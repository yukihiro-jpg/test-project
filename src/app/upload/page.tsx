'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'
import DocumentList from '@/components/DocumentList'
import SubmitButton from '@/components/SubmitButton'

interface EmployeeListItem {
  code: string
  name: string
}

interface Dependent {
  name: string
  birthday: string
  address: string
  relationship: string
  disability: string
}

interface VerifiedEmployee {
  code: string
  name: string
  birthday: string
  address: string
  disability: string
  widowSingleParent: string
  dependents: Dependent[]
}

function UploadForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const clientId = searchParams.get('client')
  const yearId = searchParams.get('year')

  // 顧問先・年度情報
  const [clientName, setClientName] = useState<string | null>(null)
  const [yearLabel, setYearLabel] = useState<string | null>(null)

  // 認証ステップ
  const [employees, setEmployees] = useState<EmployeeListItem[]>([])
  const [selectedCode, setSelectedCode] = useState('')
  const [birthday, setBirthday] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(false)
  const [verifiedEmployee, setVerifiedEmployee] = useState<VerifiedEmployee | null>(null)

  // 書類アップロード
  const [capturedImages, setCapturedImages] = useState<Record<string, string>>({})
  const [capturedFiles, setCapturedFiles] = useState<Record<string, File>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 顧問先名・年度・従業員リストを取得
  useEffect(() => {
    if (!clientId || !yearId) return

    fetch(`/api/clients?id=${encodeURIComponent(clientId)}&year=${encodeURIComponent(yearId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.name) setClientName(data.name)
        if (data.yearLabel) setYearLabel(data.yearLabel)
      })
      .catch(() => {})

    fetch(`/api/employees?client=${encodeURIComponent(clientId)}&year=${encodeURIComponent(yearId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.employees) setEmployees(data.employees)
      })
      .catch(() => {})
  }, [clientId, yearId])

  // 生年月日で本人認証
  const handleVerify = async () => {
    if (!selectedCode || !birthday) return

    setAuthLoading(true)
    setAuthError(null)

    try {
      const res = await fetch('/api/verify-employee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          yearId,
          employeeCode: selectedCode,
          birthday,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setAuthError(data.error || '認証に失敗しました')
        return
      }

      setVerifiedEmployee(data.employee)
    } catch {
      setAuthError('認証中にエラーが発生しました')
    } finally {
      setAuthLoading(false)
    }
  }

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
    if (!clientId || !yearId || !verifiedEmployee || Object.keys(capturedFiles).length === 0) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('clientId', clientId)
      formData.append('yearId', yearId)
      formData.append('employeeName', verifiedEmployee.name)

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

  // パラメータ不足
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
  const canSubmit = verifiedEmployee !== null && capturedCount > 0

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

      {/* ===== 認証前：氏名選択 + 生年月日入力 ===== */}
      {!verifiedEmployee && (
        <div className="space-y-4">
          <div>
            <label htmlFor="employee-select" className="block text-lg font-bold text-gray-800 mb-2">
              氏名を選択
            </label>
            {employees.length > 0 ? (
              <select
                id="employee-select"
                value={selectedCode}
                onChange={(e) => {
                  setSelectedCode(e.target.value)
                  setAuthError(null)
                }}
                className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- 選択してください --</option>
                {employees.map((emp) => (
                  <option key={emp.code} value={emp.code}>
                    {emp.name}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-gray-500 text-sm">従業員データが登録されていません。管理者にお問い合わせください。</p>
            )}
          </div>

          {selectedCode && (
            <div>
              <label htmlFor="birthday-input" className="block text-lg font-bold text-gray-800 mb-2">
                生年月日を入力（本人確認）
              </label>
              <input
                id="birthday-input"
                type="date"
                value={birthday}
                onChange={(e) => {
                  setBirthday(e.target.value)
                  setAuthError(null)
                }}
                className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {authError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{authError}</p>
            </div>
          )}

          {selectedCode && birthday && (
            <button
              type="button"
              onClick={handleVerify}
              disabled={authLoading}
              className={`w-full py-3 rounded-lg text-lg font-bold transition-colors ${
                authLoading
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white active:bg-blue-700'
              }`}
            >
              {authLoading ? '確認中...' : '本人確認'}
            </button>
          )}
        </div>
      )}

      {/* ===== 認証後：個人情報表示 + 書類アップロード ===== */}
      {verifiedEmployee && (
        <>
          {/* 個人情報カード */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-800">
                {verifiedEmployee.name} さん
              </h2>
              <button
                type="button"
                onClick={() => {
                  setVerifiedEmployee(null)
                  setSelectedCode('')
                  setBirthday('')
                  setCapturedImages({})
                  setCapturedFiles({})
                }}
                className="text-sm text-gray-500 underline"
              >
                別の方はこちら
              </button>
            </div>
            <dl className="space-y-2 text-sm">
              <div className="flex">
                <dt className="text-gray-500 w-24 shrink-0">生年月日</dt>
                <dd className="text-gray-800">{verifiedEmployee.birthday}</dd>
              </div>
              <div className="flex">
                <dt className="text-gray-500 w-24 shrink-0">住所</dt>
                <dd className="text-gray-800">{verifiedEmployee.address || '—'}</dd>
              </div>
              {verifiedEmployee.disability && (
                <div className="flex">
                  <dt className="text-gray-500 w-24 shrink-0">障碍者区分</dt>
                  <dd className="text-gray-800">{verifiedEmployee.disability}</dd>
                </div>
              )}
              {verifiedEmployee.widowSingleParent && (
                <div className="flex">
                  <dt className="text-gray-500 w-24 shrink-0">寡婦/ひとり親</dt>
                  <dd className="text-gray-800">{verifiedEmployee.widowSingleParent}</dd>
                </div>
              )}
            </dl>

            {/* 扶養親族 */}
            {verifiedEmployee.dependents.length > 0 && (
              <div className="mt-4 pt-3 border-t border-gray-100">
                <h3 className="text-sm font-bold text-gray-700 mb-2">扶養親族</h3>
                <div className="space-y-2">
                  {verifiedEmployee.dependents.map((dep, i) => (
                    <div key={i} className="bg-gray-50 rounded p-2 text-sm">
                      <p className="font-medium text-gray-800">
                        {dep.name}
                        {dep.relationship && (
                          <span className="text-gray-500 ml-1">（{dep.relationship}）</span>
                        )}
                      </p>
                      <p className="text-gray-500 text-xs">
                        {dep.birthday && `${dep.birthday}`}
                        {dep.address && ` / ${dep.address}`}
                        {dep.disability && ` / 障碍者区分: ${dep.disability}`}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 書類撮影 */}
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
        </>
      )}
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
