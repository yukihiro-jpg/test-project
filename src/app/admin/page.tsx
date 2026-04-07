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
    fetch(`/api/clients?year=${selectedYear}`)
      .then((res) => res.json())
      .then((data) => setRegisteredClients(data.clients || []))
      .catch(() => setRegisteredClients([]))
  }, [selectedYear])

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
        <h2 className="text-lg font-bold text-gray-800 mb-4">
          登録済み顧問先
          {selectedYearLabel && (
            <span className="ml-2 inline-block px-2 py-0.5 text-xs font-bold bg-blue-100 text-blue-700 rounded">
              {selectedYearLabel}
            </span>
          )}
        </h2>

        {registeredClients.length === 0 ? (
          <p className="text-gray-500 text-sm">この年度にはまだ顧問先が登録されていません。</p>
        ) : (
          <div className="space-y-4">
            {registeredClients.map((client) => (
              <div key={client.code} className="bg-white rounded-lg border border-gray-200 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs text-gray-400">#{client.code}</span>
                  <h3 className="text-base font-bold text-gray-800">{client.name}</h3>
                </div>

                <div className="mb-3">
                  <label className="block text-xs text-gray-500 mb-1">アップロードURL</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={getUploadUrl(client.code)}
                      className="flex-1 px-2 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-md"
                    />
                    <button
                      onClick={() => navigator.clipboard.writeText(getUploadUrl(client.code))}
                      className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md active:bg-blue-700"
                    >
                      コピー
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => generateQR(client.code)}
                  className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded-md active:bg-gray-200"
                >
                  QRコードを表示
                </button>

                <a
                  href={`/api/download-zip?client=${client.code}&year=${selectedYear}`}
                  download
                  className="ml-2 inline-block px-3 py-1.5 text-xs bg-purple-600 text-white rounded-md active:bg-purple-700"
                >
                  📦 全PDF一括ダウンロード
                </a>

                {qrImages[client.code] && (
                  <div className="mt-3 text-center">
                    <img
                      src={qrImages[client.code]}
                      alt={`${client.name}のQRコード`}
                      className="inline-block w-48 h-48"
                    />
                    <p className="text-xs text-gray-400 mt-1">印刷して従業員に配布してください</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
