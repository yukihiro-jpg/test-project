'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'
import DocumentList from '@/components/DocumentList'
import SubmitButton from '@/components/SubmitButton'
import EmployeeInfoForm from '@/components/EmployeeInfoForm'
import BirthdayPicker from '@/components/BirthdayPicker'
import ConfirmModal from '@/components/ConfirmModal'
import NoPullRefresh from '@/components/NoPullRefresh'
import { DOCUMENT_TYPES, getDocumentLabel } from '@/lib/document-types'
import { compressImage } from '@/lib/image-compress'

const NEW_HIRE_CODE = '__NEW_HIRE__'

interface EmployeeListItem {
  code: string
  name: string
}

interface DependentInfo {
  name: string
  furigana: string
  birthday: string
  relationship: string
  dependentType: string
  disability: string
  nonResident: string
  annualIncome: string
}

interface VerifiedEmployee {
  code: string
  name: string
  furigana: string
  birthday: string
  gender: string
  postalCode: string
  address: string
  disability: string
  widowSingleParent: string
  dependents: DependentInfo[]
}

interface ConfirmedInfo {
  employeeCode: string
  employeeName: string
  isNewHire: boolean
  infoChanged: boolean
  confirmedAt: string
  employee: { address: string; disability: string; widowSingleParent: string }
  dependents: DependentInfo[]
}

function UploadForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const clientId = searchParams.get('client')
  const yearId = searchParams.get('year')

  const [clientName, setClientName] = useState<string | null>(null)
  const [yearLabel, setYearLabel] = useState<string | null>(null)

  // 認証
  const [employees, setEmployees] = useState<EmployeeListItem[]>([])
  const [selectedCode, setSelectedCode] = useState('')
  const [bdYear, setBdYear] = useState('')
  const [bdMonth, setBdMonth] = useState('')
  const [bdDay, setBdDay] = useState('')
  const [newHireName, setNewHireName] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(false)
  const [verifiedEmployee, setVerifiedEmployee] = useState<VerifiedEmployee | null>(null)
  const [isNewHire, setIsNewHire] = useState(false)

  // 情報確認
  const [confirmedInfo, setConfirmedInfo] = useState<ConfirmedInfo | null>(null)

  // 書類アップロード（複数枚対応）
  const [capturedImages, setCapturedImages] = useState<Record<string, string[]>>({})
  const [capturedFiles, setCapturedFiles] = useState<Record<string, File[]>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 送信前確認モーダル
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [confirmModalMessage, setConfirmModalMessage] = useState('')

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
    if (value !== NEW_HIRE_CODE) setNewHireName('')
  }

  const birthdayString = (() => {
    if (!bdYear || !bdMonth || !bdDay) return ''
    return `${bdYear}-${bdMonth.padStart(2, '0')}-${bdDay.padStart(2, '0')}`
  })()

  const handleVerify = async () => {
    if (!selectedCode || !birthdayString) return
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
          birthday: birthdayString,
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

  const handleNewHireConfirm = () => {
    if (!newHireName.trim()) return
    setVerifiedEmployee({
      code: '', name: newHireName.trim(), furigana: '', birthday: '', gender: '',
      postalCode: '', address: '', disability: '', widowSingleParent: '', dependents: [],
    })
    setIsNewHire(true)
    setConfirmedInfo({
      employeeCode: '', employeeName: newHireName.trim(), isNewHire: true,
      infoChanged: false, confirmedAt: new Date().toISOString(),
      employee: { address: '', disability: '', widowSingleParent: '' }, dependents: [],
    })
  }

  const handleInfoConfirm = (result: ConfirmedInfo) => {
    setConfirmedInfo(result)
  }

  const handleCapture = useCallback((docTypeId: string, file: File) => {
    const url = URL.createObjectURL(file)
    setCapturedImages((prev) => ({
      ...prev,
      [docTypeId]: [...(prev[docTypeId] || []), url],
    }))
    setCapturedFiles((prev) => ({
      ...prev,
      [docTypeId]: [...(prev[docTypeId] || []), file],
    }))
  }, [])

  const handleRemoveAt = useCallback((docTypeId: string, index: number) => {
    setCapturedImages((prev) => {
      const arr = [...(prev[docTypeId] || [])]
      const removed = arr.splice(index, 1)
      if (removed[0]) URL.revokeObjectURL(removed[0])
      const next = { ...prev }
      if (arr.length === 0) delete next[docTypeId]
      else next[docTypeId] = arr
      return next
    })
    setCapturedFiles((prev) => {
      const arr = [...(prev[docTypeId] || [])]
      arr.splice(index, 1)
      const next = { ...prev }
      if (arr.length === 0) delete next[docTypeId]
      else next[docTypeId] = arr
      return next
    })
  }, [])

  const openSubmitConfirm = () => {
    if (!verifiedEmployee) return

    const docCount = Object.values(capturedFiles).reduce((sum, arr) => sum + arr.length, 0)
    const docList = DOCUMENT_TYPES
      .filter((d) => (capturedFiles[d.id] || []).length > 0)
      .map((d) => `・${getDocumentLabel(d.id)}（${capturedFiles[d.id].length}枚）`)
      .join('\n')

    const message = docCount === 0
      ? `${verifiedEmployee.name} さん\n\n提出する書類が一切ありません。\n本当にこのまま送信してもよろしいですか？`
      : `${verifiedEmployee.name} さん\n\n以下の内容で送信します。よろしいですか？\n\n撮影済み書類:\n${docList}`

    setConfirmModalMessage(message)
    setConfirmModalOpen(true)
  }

  const handleSubmit = async () => {
    setConfirmModalOpen(false)
    if (!clientId || !yearId || !verifiedEmployee) return

    setLoading(true)
    setError(null)

    let phase = '初期化'
    try {
      phase = 'FormData作成'
      const formData = new FormData()
      formData.append('clientId', String(clientId))
      formData.append('yearId', String(yearId))
      formData.append('employeeName', String(verifiedEmployee.name))
      if (isNewHire) formData.append('isNewHire', 'true')
      if (confirmedInfo) {
        formData.append('confirmedInfo', JSON.stringify(confirmedInfo))
      }

      // ファイルを圧縮して append（iPhone写真の大容量対策＋iOS Safari不具合対策）
      phase = '画像圧縮'
      for (const [docTypeId, files] of Object.entries(capturedFiles)) {
        for (let i = 0; i < files.length; i++) {
          const file = files[i]
          try {
            const blob = await compressImage(file)
            const safeName = `${docTypeId}_${i + 1}.jpg`
            formData.append(docTypeId, blob, safeName)
          } catch (fileErr) {
            console.error(`ファイル ${docTypeId}[${i}] の圧縮に失敗:`, fileErr)
            throw new Error(`画像ファイルの読み込みに失敗しました。撮り直してください。`)
          }
        }
      }

      phase = '送信'
      const res = await fetch('/api/upload', { method: 'POST', body: formData })

      phase = 'レスポンス処理'
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `送信に失敗しました（HTTP ${res.status}）`)
      }

      phase = '完了画面遷移'
      router.push('/complete')
    } catch (err) {
      const message = err instanceof Error ? err.message : '送信に失敗しました'
      setError(`[${phase}] ${message}`)
      console.error('Submit error at phase:', phase, err)
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setVerifiedEmployee(null)
    setConfirmedInfo(null)
    setSelectedCode('')
    setBdYear('')
    setBdMonth('')
    setBdDay('')
    setNewHireName('')
    setIsNewHire(false)
    setCapturedImages({})
    setCapturedFiles({})
  }

  if (!clientId || !yearId) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center">
          <p className="text-lg text-red-600 font-bold mb-2">
            {!clientId ? '顧問先が指定されていません' : '年度が指定されていません'}
          </p>
          <p className="text-gray-500 text-sm">QRコードまたは専用URLからアクセスしてください。</p>
        </div>
      </div>
    )
  }

  const totalImages = Object.values(capturedFiles).reduce((sum, arr) => sum + arr.length, 0)
  const canSubmit = verifiedEmployee !== null && confirmedInfo !== null

  return (
    <>
      <NoPullRefresh />
      <div className="max-w-lg mx-auto px-4 py-6 pb-32">
        <header className="mb-4">
          <h1 className="text-xl font-bold text-gray-800">年末調整書類アップロード</h1>
          <div className="flex items-center gap-2 mt-1">
            {yearLabel && <span className="inline-block px-2 py-0.5 text-xs font-bold bg-blue-100 text-blue-700 rounded">{yearLabel}</span>}
            {clientName && <span className="text-sm text-blue-600">{clientName}</span>}
          </div>
        </header>

        {/* 提出期限 */}
        <div className="mb-6 p-3 bg-red-600 rounded-lg text-center">
          <p className="text-white font-bold text-lg">提出期限：11月30日（厳守）</p>
          <p className="text-red-100 text-xs mt-1">期限を過ぎると年末調整に間に合わない場合があります</p>
        </div>

        {/* ===== 認証前 ===== */}
        {!verifiedEmployee && (
          <div className="space-y-4">
            <div>
              <label htmlFor="employee-select" className="block text-lg font-bold text-gray-800 mb-2">氏名を選択</label>
              <select
                id="employee-select"
                value={selectedCode}
                onChange={(e) => handleSelectChange(e.target.value)}
                className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- 選択してください --</option>
                {employees.map((emp) => (
                  <option key={emp.code} value={emp.code}>{emp.name}</option>
                ))}
                <option value={NEW_HIRE_CODE}>---- 本年入社（上記に名前がない方） ----</option>
              </select>
            </div>

            {selectedCode && !isNewHire && (
              <>
                <div>
                  <label className="block text-lg font-bold text-gray-800 mb-2">生年月日を入力（本人確認）</label>
                  <BirthdayPicker
                    year={bdYear}
                    month={bdMonth}
                    day={bdDay}
                    onChange={(y, m, d) => {
                      setBdYear(y)
                      setBdMonth(m)
                      setBdDay(d)
                      setAuthError(null)
                    }}
                  />
                </div>
                {authError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700">{authError}</p>
                  </div>
                )}
                {birthdayString && (
                  <button type="button" onClick={handleVerify} disabled={authLoading}
                    className={`w-full py-3 rounded-lg text-lg font-bold transition-colors ${authLoading ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-600 text-white active:bg-blue-700'}`}>
                    {authLoading ? '確認中...' : '本人確認'}
                  </button>
                )}
              </>
            )}

            {isNewHire && (
              <>
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800 font-bold">本年入社の方</p>
                  <p className="text-xs text-yellow-700 mt-1">前年の登録データがないため、氏名を手入力してください。</p>
                </div>
                <div>
                  <label htmlFor="new-hire-name" className="block text-lg font-bold text-gray-800 mb-2">氏名を入力</label>
                  <input id="new-hire-name" type="text" value={newHireName}
                    onChange={(e) => setNewHireName(e.target.value)} placeholder="例：山田 太郎"
                    className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" autoComplete="name" />
                </div>
                {newHireName.trim() && (
                  <button type="button" onClick={handleNewHireConfirm}
                    className="w-full py-3 rounded-lg text-lg font-bold bg-blue-600 text-white active:bg-blue-700">
                    書類撮影へ進む
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* ===== 認証後 ===== */}
        {verifiedEmployee && (
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-800">{verifiedEmployee.name} さん</h2>
                {isNewHire && <span className="px-2 py-0.5 text-xs font-bold bg-yellow-100 text-yellow-700 rounded">本年入社</span>}
                {confirmedInfo && !isNewHire && (
                  <span className={`px-2 py-0.5 text-xs font-bold rounded ${confirmedInfo.infoChanged ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                    {confirmedInfo.infoChanged ? '相違あり' : '相違なし'}
                  </span>
                )}
              </div>
              <button type="button" onClick={handleReset} className="text-sm text-gray-500 underline">別の方はこちら</button>
            </div>

            {!isNewHire && !confirmedInfo && (
              <EmployeeInfoForm employee={verifiedEmployee} onConfirm={handleInfoConfirm} />
            )}

            {confirmedInfo && (
              <>
                <div className="mt-6">
                  <DocumentList capturedImages={capturedImages} onCapture={handleCapture} onRemoveAt={handleRemoveAt} />
                </div>

                {error && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                <SubmitButton disabled={!canSubmit} loading={loading} capturedCount={totalImages} onClick={openSubmitConfirm} />
              </>
            )}
          </>
        )}

        <ConfirmModal
          open={confirmModalOpen}
          title="送信内容の確認"
          message={confirmModalMessage}
          confirmLabel="送信する"
          cancelLabel="戻る"
          onConfirm={handleSubmit}
          onCancel={() => setConfirmModalOpen(false)}
        />
      </div>
    </>
  )
}

export default function UploadPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><p className="text-gray-500">読み込み中...</p></div>}>
      <UploadForm />
    </Suspense>
  )
}
