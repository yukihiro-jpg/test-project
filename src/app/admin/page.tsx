'use client'

import { useEffect, useState } from 'react'

interface ClientInfo {
  id: string
  name: string
}

interface FiscalYearInfo {
  id: string
  label: string
}

export default function AdminPage() {
  const [clients, setClients] = useState<ClientInfo[]>([])
  const [fiscalYears, setFiscalYears] = useState<FiscalYearInfo[]>([])
  const [selectedYear, setSelectedYear] = useState<string>('')
  const [qrImages, setQrImages] = useState<Record<string, string>>({})
  const [appUrl, setAppUrl] = useState('')

  useEffect(() => {
    setAppUrl(window.location.origin)

    fetch('/api/clients')
      .then((res) => res.json())
      .then((data) => {
        setClients(data.clients || [])
        const years = data.fiscalYears || []
        setFiscalYears(years)
        if (years.length > 0) {
          setSelectedYear(years[0].id)
        }
      })
      .catch(console.error)
  }, [])

  // 年度変更時にQRコードをリセット
  useEffect(() => {
    setQrImages({})
  }, [selectedYear])

  const getUploadUrl = (clientId: string) => {
    return `${appUrl}/upload?client=${clientId}&year=${selectedYear}`
  }

  const generateQR = async (clientId: string) => {
    const url = getUploadUrl(clientId)
    try {
      const res = await fetch(
        `/api/qrcode?text=${encodeURIComponent(url)}`
      )
      if (res.ok) {
        const blob = await res.blob()
        const imageUrl = URL.createObjectURL(blob)
        setQrImages((prev) => ({ ...prev, [clientId]: imageUrl }))
      }
    } catch (err) {
      console.error('QR code generation failed:', err)
    }
  }

  const selectedYearLabel =
    fiscalYears.find((fy) => fy.id === selectedYear)?.label ?? ''

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">管理画面</h1>
      <p className="text-gray-500 text-sm mb-6">
        年度を選択し、顧問先ごとのアップロードURLとQRコードを発行できます。
      </p>

      {/* 年度選択 */}
      <div className="mb-8 bg-white rounded-lg border border-gray-200 p-4">
        <label
          htmlFor="fiscal-year"
          className="block text-sm font-bold text-gray-700 mb-2"
        >
          対象年度
        </label>
        <select
          id="fiscal-year"
          value={selectedYear}
          onChange={(e) => setSelectedYear(e.target.value)}
          className="w-full px-3 py-2 text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {fiscalYears.map((fy) => (
            <option key={fy.id} value={fy.id}>
              {fy.label}
            </option>
          ))}
        </select>
      </div>

      {clients.length === 0 ? (
        <p className="text-gray-500">顧問先が登録されていません。</p>
      ) : (
        <div className="space-y-6">
          {clients.map((client) => (
            <div
              key={client.id}
              className="bg-white rounded-lg border border-gray-200 p-6"
            >
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-lg font-bold text-gray-800">
                  {client.name}
                </h2>
                <span className="inline-block px-2 py-0.5 text-xs font-bold bg-blue-100 text-blue-700 rounded">
                  {selectedYearLabel}
                </span>
              </div>

              <div className="mb-4">
                <label className="block text-sm text-gray-500 mb-1">
                  アップロードURL
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={getUploadUrl(client.id)}
                    className="flex-1 px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-md"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(getUploadUrl(client.id))
                    }}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md active:bg-blue-700"
                  >
                    コピー
                  </button>
                </div>
              </div>

              <div>
                <button
                  onClick={() => generateQR(client.id)}
                  className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-md active:bg-gray-200 mb-3"
                >
                  QRコードを表示
                </button>

                {qrImages[client.id] && (
                  <div className="mt-3 text-center">
                    <img
                      src={qrImages[client.id]}
                      alt={`${client.name}（${selectedYearLabel}）のQRコード`}
                      className="inline-block w-48 h-48"
                    />
                    <p className="text-xs text-gray-400 mt-2">
                      印刷して従業員に配布してください
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
