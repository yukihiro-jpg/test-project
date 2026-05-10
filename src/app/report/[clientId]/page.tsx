'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import type { ClientDetail } from '@/types/report'

const YEAR_LABELS = ['R5', 'R6', 'R7', 'R8', 'R9']

export default function ClientDetailPage() {
  const { clientId } = useParams<{ clientId: string }>()
  const router = useRouter()
  const [detail, setDetail] = useState<ClientDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // アップロード状態
  const [uploadYearLabel, setUploadYearLabel] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // レポート生成
  const [reportMonth, setReportMonth] = useState<string>('')
  const [reportYear, setReportYear] = useState<string>('R7')
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)

  const loadDetail = () => {
    setLoading(true)
    fetch(`/api/report/clients/${clientId}`)
      .then(r => r.json())
      .then(data => {
        if (data.id) setDetail(data)
        else setError(data.error ?? 'エラー')
      })
      .catch(() => setError('データの取得に失敗しました'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadDetail() }, [clientId])

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uploadFile || !uploadYearLabel) {
      setUploadError('ファイルと期ラベルを選択してください')
      return
    }
    setUploading(true)
    setUploadError(null)
    const formData = new FormData()
    formData.append('file', uploadFile)
    formData.append('yearLabel', uploadYearLabel)
    try {
      const res = await fetch(`/api/report/clients/${clientId}/upload`, { method: 'POST', body: formData })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'アップロード失敗')
      }
      setUploadFile(null)
      setUploadYearLabel('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      loadDetail()
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'アップロード失敗')
    } finally {
      setUploading(false)
    }
  }

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reportMonth || !reportYear) {
      setGenError('報告月と年度を入力してください')
      return
    }
    setGenerating(true)
    setGenError(null)
    try {
      const res = await fetch(`/api/report/clients/${clientId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportMonth: Number(reportMonth), reportYear }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'レポート生成失敗')
      }
      const html = await res.text()
      const blob = new Blob([html], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'レポート生成失敗')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) return <div style={{ padding: 32, fontFamily: 'sans-serif', color: '#666' }}>読み込み中...</div>
  if (error) return <div style={{ padding: 32, fontFamily: 'sans-serif', color: 'red' }}>{error}</div>
  if (!detail) return null

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px', fontFamily: 'sans-serif' }}>
      <div style={{ marginBottom: 16 }}>
        <Link href="/report" style={{ color: '#4472C4', textDecoration: 'none', fontSize: 13 }}>← 顧問先一覧</Link>
      </div>

      <div style={{ background: '#1a3a6b', color: 'white', borderRadius: 8, padding: '16px 20px', marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 6 }}>{detail.name}</h1>
        <div style={{ fontSize: 12, opacity: 0.85 }}>決算月: {detail.fiscalYearEndMonth}月　当期: {detail.fiscalYearLabel}</div>
      </div>

      {/* ファイルアップロード */}
      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>財務データのアップロード</h2>
        <p style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
          月次推移財務報告書（Excel/CSV）を期ごとにアップロードしてください。最大3期分まで保存できます。
        </p>

        <form onSubmit={handleUpload} style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={labelStyle}>期ラベル</label>
            <select
              style={{ ...inputStyle, width: 100 }}
              value={uploadYearLabel}
              onChange={e => setUploadYearLabel(e.target.value)}
            >
              <option value="">選択</option>
              {YEAR_LABELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Excelファイル / CSVファイル</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              style={{ fontSize: 12 }}
              onChange={e => setUploadFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <button
            type="submit"
            disabled={uploading}
            style={{ background: '#4472C4', color: 'white', padding: '8px 18px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 'bold', opacity: uploading ? 0.7 : 1 }}
          >
            {uploading ? 'アップロード中...' : 'アップロード'}
          </button>
        </form>

        {uploadError && <p style={{ color: 'red', fontSize: 12, marginTop: 8 }}>{uploadError}</p>}

        {/* アップロード済みファイル一覧 */}
        {detail.files.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <h3 style={{ fontSize: 13, fontWeight: 'bold', marginBottom: 8, color: '#333' }}>アップロード済みファイル</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f0f4ff' }}>
                  <th style={smThStyle}>期</th>
                  <th style={smThStyle}>ファイル名</th>
                  <th style={smThStyle}>アップロード日</th>
                </tr>
              </thead>
              <tbody>
                {detail.files
                  .slice()
                  .sort((a, b) => a.yearLabel.localeCompare(b.yearLabel))
                  .map(f => (
                    <tr key={f.fileId} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ ...smTdStyle, fontWeight: 'bold', color: '#1a3a6b' }}>{f.yearLabel}</td>
                      <td style={smTdStyle}>{f.fileName}</td>
                      <td style={smTdStyle}>{new Date(f.uploadedAt).toLocaleDateString('ja-JP')}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {detail.files.length === 0 && (
          <p style={{ fontSize: 12, color: '#999', marginTop: 12 }}>まだファイルがアップロードされていません</p>
        )}
      </section>

      {/* レポート生成 */}
      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>月次報告書の生成</h2>
        <p style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
          アップロード済みの財務データを使って月次報告書を生成します。新しいタブでHTMLレポートが開きます。
        </p>

        <form onSubmit={handleGenerate} style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={labelStyle}>報告月</label>
            <select style={{ ...inputStyle, width: 90 }} value={reportMonth} onChange={e => setReportMonth(e.target.value)}>
              <option value="">月選択</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{m}月</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>年度（レポートタイトル用）</label>
            <input
              type="text"
              style={{ ...inputStyle, width: 100 }}
              placeholder="例: R7"
              value={reportYear}
              onChange={e => setReportYear(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={generating || detail.files.length === 0}
            style={{ background: '#1a7340', color: 'white', padding: '8px 18px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 'bold', opacity: (generating || detail.files.length === 0) ? 0.6 : 1 }}
          >
            {generating ? '生成中...' : '📊 報告書を生成'}
          </button>
        </form>

        {genError && <p style={{ color: 'red', fontSize: 12, marginTop: 8 }}>{genError}</p>}
        {detail.files.length === 0 && (
          <p style={{ fontSize: 12, color: '#e67e00', marginTop: 8 }}>⚠ ファイルをアップロードしてから報告書を生成してください</p>
        )}
      </section>
    </div>
  )
}

const sectionStyle: React.CSSProperties = {
  border: '1px solid #ddd', borderRadius: 8, padding: '20px', marginBottom: 20, background: '#fff',
}
const sectionTitleStyle: React.CSSProperties = {
  fontSize: 15, fontWeight: 'bold', color: '#1a3a6b', borderLeft: '4px solid #4472C4', paddingLeft: 10, marginBottom: 12,
}
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11, color: '#555', marginBottom: 4, fontWeight: 'bold' }
const inputStyle: React.CSSProperties = { padding: '7px 10px', border: '1px solid #ccc', borderRadius: 6, fontSize: 12 }
const smThStyle: React.CSSProperties = { padding: '6px 10px', textAlign: 'left', fontWeight: 'bold', color: '#444', border: '1px solid #ddd' }
const smTdStyle: React.CSSProperties = { padding: '6px 10px', border: '1px solid #eee' }
