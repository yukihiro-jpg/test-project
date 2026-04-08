'use client'

import { useEffect, useState, useRef } from 'react'

interface ClientInfo {
  code: string
  name: string
}

interface FiscalYearInfo {
  id: string
  label: string
}

export default function AdminPage() {
  // 年度・会社一覧
  const [fiscalYears, setFiscalYears] = useState<FiscalYearInfo[]>([])
  const [selectedYear, setSelectedYear] = useState('')
  const [registeredClients, setRegisteredClients] = useState<ClientInfo[]>([])

  // 登録フォーム
  const [companyCode, setCompanyCode] = useState('')
  const [companyName, setCompanyName] = useState('')
  const csvFileRef = useRef<HTMLInputElement>(null)
  const [registering, setRegistering] = useState(false)
  const [registerMessage, setRegisterMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // QRコード・URL
  const [qrImages, setQrImages] = useState<Record<string, string>>({})
  const [appUrl, setAppUrl] = useState('')

  // 検索・折りたたみ
  const [searchText, setSearchText] = useState('')
  const [expandedCode, setExpandedCode] = useState<string | null>(null)

  // ロック一覧
  interface LockInfo {
    clientCode: string
    clientName: string
    employeeCode: string
    employeeName: string
    entry: { fails: number; lastFailAt: string; lockedUntil: string | null }
  }
  const [locks, setLocks] = useState<LockInfo[]>([])
  const [locksLoaded, setLocksLoaded] = useState(false)

  // マイナンバー表示モーダル
  interface MyNumberData {
    employeeName: string
    personal: { name: string; myNumber: string }
    spouse: { name: string; myNumber: string } | null
    dependents: Array<{ name: string; relationship: string; myNumber: string }>
  }
  const [myNumberModal, setMyNumberModal] = useState<MyNumberData | null>(null)
  const [myNumberLoading, setMyNumberLoading] = useState(false)
  const [myNumberEmployee, setMyNumberEmployee] = useState<Record<string, string>>({})

  useEffect(() => {
    setAppUrl(window.location.origin)

    // 年度一覧を取得
    fetch('/api/clients')
      .then((res) => res.json())
      .then((data) => {
        const years = data.fiscalYears || []
        setFiscalYears(years)
        if (years.length > 0) setSelectedYear(years[0].id)
      })
      .catch(console.error)
  }, [])

  // 年度変更時に登録済み会社を読み込み
  useEffect(() => {
    if (!selectedYear) return
    setQrImages({})
    setLocksLoaded(false)
    fetch(`/api/clients?year=${selectedYear}`)
      .then((res) => res.json())
      .then((data) => setRegisteredClients(data.clients || []))
      .catch(() => setRegisteredClients([]))

    // ロック一覧も取得
    fetch(`/api/admin-locks?year=${selectedYear}`)
      .then((res) => res.json())
      .then((data) => {
        setLocks(data.locks || [])
        setLocksLoaded(true)
      })
      .catch(() => setLocksLoaded(true))
  }, [selectedYear])

  const showMyNumber = async (clientCode: string, employeeName: string) => {
    setMyNumberLoading(true)
    try {
      const res = await fetch(
        `/api/admin-mynumber?client=${clientCode}&year=${selectedYear}&employeeName=${encodeURIComponent(employeeName)}`,
      )
      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'マイナンバーの取得に失敗しました')
        return
      }
      const data = await res.json()
      setMyNumberModal(data)
    } catch {
      alert('通信エラーが発生しました')
    } finally {
      setMyNumberLoading(false)
    }
  }

  const unlockEmployee = async (clientCode: string, employeeCode: string) => {
    if (!confirm('このロックを解除しますか？')) return
    try {
      const res = await fetch('/api/admin-unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yearId: selectedYear, clientCode, employeeCode }),
      })
      if (res.ok) {
        // 再取得
        const locksRes = await fetch(`/api/admin-locks?year=${selectedYear}`)
        const data = await locksRes.json()
        setLocks(data.locks || [])
      }
    } catch {
      alert('ロック解除に失敗しました')
    }
  }

  const handleRegister = async () => {
    const csvFile = csvFileRef.current?.files?.[0]
    if (!selectedYear || !companyCode.trim() || !companyName.trim() || !csvFile) {
      setRegisterMessage({ type: 'error', text: '全項目を入力してください' })
      return
    }

    setRegistering(true)
    setRegisterMessage(null)

    try {
      const formData = new FormData()
      formData.append('yearId', selectedYear)
      formData.append('companyCode', companyCode.trim())
      formData.append('companyName', companyName.trim())
      formData.append('csvFile', csvFile)

      const res = await fetch('/api/register-company', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (res.ok) {
        setRegisterMessage({ type: 'success', text: data.message })
        setCompanyCode('')
        setCompanyName('')
        if (csvFileRef.current) csvFileRef.current.value = ''

        // 会社一覧を更新
        const listRes = await fetch(`/api/clients?year=${selectedYear}`)
        const listData = await listRes.json()
        setRegisteredClients(listData.clients || [])
      } else {
        setRegisterMessage({ type: 'error', text: data.error || '登録に失敗しました' })
      }
    } catch {
      setRegisterMessage({ type: 'error', text: '登録中にエラーが発生しました' })
    } finally {
      setRegistering(false)
    }
  }

  const getUploadUrl = (code: string) => {
    return `${appUrl}/upload?client=${code}&year=${selectedYear}`
  }

  const generateQR = async (code: string) => {
    const url = getUploadUrl(code)
    try {
      const res = await fetch(`/api/qrcode?text=${encodeURIComponent(url)}`)
      if (res.ok) {
        const blob = await res.blob()
        setQrImages((prev) => ({ ...prev, [code]: URL.createObjectURL(blob) }))
      }
    } catch (err) {
      console.error('QR code generation failed:', err)
    }
  }

  const selectedYearLabel = fiscalYears.find((fy) => fy.id === selectedYear)?.label ?? ''

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">管理画面</h1>
      <p className="text-gray-500 text-sm mb-8">
        顧問先を登録し、従業員向けのアップロードURLとQRコードを発行します。
      </p>

      {/* ===== 会社登録フォーム ===== */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
        <h2 className="text-lg font-bold text-gray-800 mb-4">顧問先登録</h2>

        <div className="space-y-4">
          <div>
            <label htmlFor="fiscal-year" className="block text-sm font-medium text-gray-700 mb-1">
              対象年度
            </label>
            <select
              id="fiscal-year"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {fiscalYears.map((fy) => (
                <option key={fy.id} value={fy.id}>{fy.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="company-code" className="block text-sm font-medium text-gray-700 mb-1">
                法人コード
              </label>
              <input
                id="company-code"
                type="text"
                value={companyCode}
                onChange={(e) => setCompanyCode(e.target.value)}
                placeholder="例: 712"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="company-name" className="block text-sm font-medium text-gray-700 mb-1">
                会社名
              </label>
              <input
                id="company-name"
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="例: 株式会社松坂屋"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="csv-file" className="block text-sm font-medium text-gray-700 mb-1">
              JDL年末調整CSV
            </label>
            <input
              id="csv-file"
              ref={csvFileRef}
              type="file"
              accept=".csv"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700 file:font-medium"
            />
          </div>

          <button
            onClick={handleRegister}
            disabled={registering}
            className={`w-full py-3 rounded-lg font-bold transition-colors ${
              registering
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white active:bg-blue-700'
            }`}
          >
            {registering ? '登録中...' : '登録する'}
          </button>

          {registerMessage && (
            <p className={`text-sm ${registerMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
              {registerMessage.text}
            </p>
          )}
        </div>
      </div>

      {/* ===== 登録済み会社一覧 ===== */}
      <div>
        <h2 className="text-lg font-bold text-gray-800 mb-3">
          登録済み顧問先
          {selectedYearLabel && (
            <span className="ml-2 inline-block px-2 py-0.5 text-xs font-bold bg-blue-100 text-blue-700 rounded">
              {selectedYearLabel}
            </span>
          )}
          {registeredClients.length > 0 && (
            <span className="ml-2 text-sm font-normal text-gray-500">
              （{registeredClients.length}件）
            </span>
          )}
        </h2>

        {/* 検索ボックス */}
        {registeredClients.length > 0 && (
          <div className="mb-4">
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="法人コードまたは会社名で検索..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {registeredClients.length === 0 ? (
          <p className="text-gray-500 text-sm">この年度にはまだ顧問先が登録されていません。</p>
        ) : (
          <div className="space-y-2">
            {registeredClients
              .filter((c) => {
                if (!searchText.trim()) return true
                const q = searchText.toLowerCase()
                return (
                  c.code.toLowerCase().includes(q) ||
                  c.name.toLowerCase().includes(q)
                )
              })
              .map((client) => {
                const isExpanded = expandedCode === client.code
                return (
                  <div
                    key={client.code}
                    className="bg-white rounded-lg border border-gray-200 overflow-hidden"
                  >
                    {/* 折りたたみヘッダー */}
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedCode(isExpanded ? null : client.code)
                      }
                      className="w-full flex items-center justify-between p-4 text-left active:bg-gray-50"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs text-gray-400 shrink-0">
                          #{client.code}
                        </span>
                        <h3 className="text-base font-bold text-gray-800 truncate">
                          {client.name}
                        </h3>
                      </div>
                      <span
                        className={`text-gray-400 transition-transform shrink-0 ml-2 ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                      >
                        ▼
                      </span>
                    </button>

                    {/* 展開時の内容 */}
                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                        <div className="mb-3">
                          <label className="block text-xs text-gray-500 mb-1">
                            アップロードURL
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              readOnly
                              value={getUploadUrl(client.code)}
                              className="flex-1 px-2 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-md"
                            />
                            <button
                              onClick={() =>
                                navigator.clipboard.writeText(
                                  getUploadUrl(client.code)
                                )
                              }
                              className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md active:bg-blue-700"
                            >
                              コピー
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => generateQR(client.code)}
                            className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded-md active:bg-gray-200"
                          >
                            QRコードを表示
                          </button>
                          <a
                            href={`/api/qrcode-pdf?client=${client.code}&year=${selectedYear}`}
                            download
                            className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-md active:bg-green-700"
                          >
                            📄 QRコードPDF
                          </a>
                          <a
                            href={`/api/download-zip?client=${client.code}&year=${selectedYear}`}
                            download
                            className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded-md active:bg-purple-700"
                          >
                            📦 全PDF一括ダウンロード
                          </a>
                        </div>

                        {/* マイナンバー個別確認 */}
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <label className="block text-xs text-gray-500 mb-1">
                            🔐 マイナンバー個別確認（本年入社者）
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={myNumberEmployee[client.code] || ''}
                              onChange={(e) =>
                                setMyNumberEmployee((prev) => ({
                                  ...prev,
                                  [client.code]: e.target.value,
                                }))
                              }
                              placeholder="従業員氏名（例: 山田　太郎）"
                              className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded-md"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                showMyNumber(client.code, myNumberEmployee[client.code] || '')
                              }
                              disabled={
                                myNumberLoading || !myNumberEmployee[client.code]?.trim()
                              }
                              className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-md active:bg-red-700 disabled:bg-gray-300"
                            >
                              表示
                            </button>
                          </div>
                        </div>

                        {qrImages[client.code] && (
                          <div className="mt-3 text-center">
                            <img
                              src={qrImages[client.code]}
                              alt={`${client.name}のQRコード`}
                              className="inline-block w-48 h-48"
                            />
                            <p className="text-xs text-gray-400 mt-1">
                              印刷して従業員に配布してください
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
          </div>
        )}
      </div>

      {/* ===== ロック中の従業員一覧 ===== */}
      {locksLoaded && locks.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-bold text-gray-800 mb-3">
            🔒 現在ロック中の従業員 ({locks.length}名)
          </h2>
          <p className="text-xs text-gray-500 mb-3">
            本人確認に連続失敗してロックされた従業員です。正当な本人の場合は手動で解除できます。
          </p>
          <div className="space-y-2">
            {locks.map((lock) => (
              <div
                key={`${lock.clientCode}:${lock.employeeCode}`}
                className="bg-white border border-red-200 rounded-lg p-3 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-bold text-gray-800">
                    {lock.employeeName}
                    <span className="ml-2 text-xs text-gray-500">
                      {lock.clientName}
                    </span>
                  </p>
                  <p className="text-xs text-gray-500">
                    {lock.entry.fails}回失敗 / 解除予定:{' '}
                    {lock.entry.lockedUntil
                      ? new Date(lock.entry.lockedUntil).toLocaleString('ja-JP')
                      : '—'}
                  </p>
                </div>
                <button
                  onClick={() => unlockEmployee(lock.clientCode, lock.employeeCode)}
                  className="px-3 py-1.5 text-xs bg-orange-500 text-white rounded-md active:bg-orange-600"
                >
                  ロック解除
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== マイナンバー表示モーダル ===== */}
      {myNumberModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-800">
                🔐 マイナンバー情報
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                この画面を閉じるとマイナンバーは見えなくなります
              </p>
            </div>
            <div className="p-5 overflow-y-auto flex-1 space-y-4 text-sm">
              <div>
                <p className="text-xs text-gray-500">本人</p>
                <p className="font-bold">{myNumberModal.personal.name}</p>
                <p className="font-mono text-base bg-yellow-50 px-2 py-1 rounded mt-1">
                  {myNumberModal.personal.myNumber}
                </p>
              </div>
              {myNumberModal.spouse && (
                <div>
                  <p className="text-xs text-gray-500">配偶者</p>
                  <p className="font-bold">{myNumberModal.spouse.name}</p>
                  <p className="font-mono text-base bg-yellow-50 px-2 py-1 rounded mt-1">
                    {myNumberModal.spouse.myNumber}
                  </p>
                </div>
              )}
              {myNumberModal.dependents.map((dep, i) => (
                <div key={i}>
                  <p className="text-xs text-gray-500">
                    扶養親族（{dep.relationship}）
                  </p>
                  <p className="font-bold">{dep.name}</p>
                  <p className="font-mono text-base bg-yellow-50 px-2 py-1 rounded mt-1">
                    {dep.myNumber}
                  </p>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setMyNumberModal(null)}
                className="w-full py-3 bg-gray-600 text-white text-sm font-bold rounded-lg active:bg-gray-700"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
