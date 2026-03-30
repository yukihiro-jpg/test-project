'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'
import DocumentList from '@/components/DocumentList'
import SubmitButton from '@/components/SubmitButton'

const NEW_HIRE_CODE = '__NEW_HIRE__'

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
  const [newHireName, setNewHireName] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(false)
  const [verifiedEmployee, setVerifiedEmployee] = useState<VerifiedEmployee | null>(null)
  const [isNewHire, setIsNewHire] = useState(false)

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

  const handleSelectChange = (value: string) => {
    setSelectedCode(value)
    setAuthError(null)
    setIsNewHire(value === NEW_HIRE_CODE)
    if (value !== NEW_HIRE_CODE) {
      setNewHireName('')
    }
  }

  // 生年月日で本人認証
  const handleVerify = async () => {
    if (!selectedCode || (!isNewHire && !birthday)) return

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

  // 本年入社の場合は認証不要で直接進む
  const handleNewHireConfirm = () => {
    if (!newHireName.trim()) return
    setVerifiedEmployee({
      code: '',
      name: newHireName.trim(),
      birthday: '',
      address: '',
      disability: '',
      widowSingleParent: '',
      dependents: [],
    })
    setIsNewHire(true)
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
      if (isNewHire) {
        formData.append('isNewHire', 'true')
      }

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

  const handleReset = () => {
    setVerifiedEmployee(null)
    setSelectedCode('')
    setBirthday('')
    setNewHireName('')
    setIsNewHire(false)
    setCapturedImages({})
    setCapturedFiles({})
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
      <header className="mb-4">
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

      {/* 提出期限バナー */}
      <div className="mb-6 p-3 bg-red-600 rounded-lg text-center">
        <p className="text-white font-bold text-lg">
          提出期限：11月30日（厳守）
        </p>
        <p className="text-red-100 text-xs mt-1">
          期限を過ぎると年末調整に間に合わない場合があります
        </p>
      </div>

      {/* ===== 認証前：氏名選択 + 生年月日入力 ===== */}
      {!verifiedEmployee && (
        <div className="space-y-4">
          <div>
            <label htmlFor="employee-select" className="block text-lg font-bold text-gray-800 mb-2">
              氏名を選択
            </label>
            <select
              id="employee-select"
              value={selectedCode}
              onChange={(e) => handleSelectChange(e.target.value)}
              className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- 選択してください --</option>
              {employees.map((emp) => (
                <option key={emp.code} value={emp.code}>
                  {emp.name}
                </option>
              ))}
              <option value={NEW_HIRE_CODE}>
                ---- 本年入社（上記に名前がない方） ----
              </option>
            </select>
          </div>

          {/* 既存従業員の場合：生年月日認証 */}
          {selectedCode && !isNewHire && (
            <>
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

              {authError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{authError}</p>
                </div>
              )}

              {birthday && (
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
            </>
          )}

          {/* 本年入社の場合：氏名入力のみ */}
          {isNewHire && (
            <>
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800 font-bold">本年入社の方</p>
                <p className="text-xs text-yellow-700 mt-1">
                  前年の登録データがないため、氏名を手入力してください。生年月日の照合は不要です。
                </p>
              </div>

              <div>
                <label htmlFor="new-hire-name" className="block text-lg font-bold text-gray-800 mb-2">
                  氏名を入力
                </label>
                <input
                  id="new-hire-name"
                  type="text"
                  value={newHireName}
                  onChange={(e) => setNewHireName(e.target.value)}
                  placeholder="例：山田 太郎"
                  className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoComplete="name"
                />
              </div>

              {newHireName.trim() && (
                <button
                  type="button"
                  onClick={handleNewHireConfirm}
                  className="w-full py-3 rounded-lg text-lg font-bold bg-blue-600 text-white active:bg-blue-700"
                >
                  書類撮影へ進む
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* ===== 認証後 / 本年入社確認後：個人情報表示 + 書類アップロード ===== */}
      {verifiedEmployee && (
        <>
          {/* 個人情報カード */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-800">
                  {verifiedEmployee.name} さん
                </h2>
                {isNewHire && (
                  <span className="inline-block px-2 py-0.5 text-xs font-bold bg-yellow-100 text-yellow-700 rounded">
                    本年入社
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="text-sm text-gray-500 underline"
              >
                別の方はこちら
              </button>
            </div>

            {/* 既存従業員の場合のみ前年情報を表示 */}
            {!isNewHire && (
              <>
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
              </>
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
