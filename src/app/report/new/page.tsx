'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function NewClientPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    name: '',
    fiscalYearEndMonth: '',
    fiscalYearLabel: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!form.name || !form.fiscalYearEndMonth || !form.fiscalYearLabel) {
      setError('すべての項目を入力してください')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/report/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          fiscalYearEndMonth: Number(form.fiscalYearEndMonth),
          fiscalYearLabel: form.fiscalYearLabel,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '登録に失敗しました')
      router.push(`/report/${data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '登録に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '24px 16px', fontFamily: 'sans-serif' }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/report" style={{ color: '#4472C4', textDecoration: 'none', fontSize: 13 }}>← 一覧に戻る</Link>
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 'bold', color: '#1a3a6b', marginBottom: 24 }}>顧問先 新規登録</h1>

      {error && (
        <div style={{ background: '#fdd', border: '1px solid #f99', borderRadius: 6, padding: '10px 14px', marginBottom: 16, color: '#c00', fontSize: 13 }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={fieldStyle}>
          <label style={labelStyle}>顧問先名 <span style={{ color: 'red' }}>*</span></label>
          <input
            style={inputStyle}
            type="text"
            placeholder="例: 株式会社○○商店"
            value={form.name}
            onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
          />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>決算月 <span style={{ color: 'red' }}>*</span></label>
          <select
            style={inputStyle}
            value={form.fiscalYearEndMonth}
            onChange={e => setForm(prev => ({ ...prev, fiscalYearEndMonth: e.target.value }))}
          >
            <option value="">選択してください</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>{m}月</option>
            ))}
          </select>
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>当期ラベル <span style={{ color: 'red' }}>*</span></label>
          <input
            style={inputStyle}
            type="text"
            placeholder="例: R7.8期"
            value={form.fiscalYearLabel}
            onChange={e => setForm(prev => ({ ...prev, fiscalYearLabel: e.target.value }))}
          />
          <p style={{ fontSize: 11, color: '#888', marginTop: 4 }}>報告書の表紙に表示される期の名称</p>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <button
            type="submit"
            disabled={saving}
            style={{ background: '#1a3a6b', color: 'white', padding: '10px 24px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: 13, opacity: saving ? 0.7 : 1 }}
          >
            {saving ? '登録中...' : '登録する'}
          </button>
          <Link href="/report" style={{ padding: '10px 20px', borderRadius: 6, border: '1px solid #ccc', color: '#444', textDecoration: 'none', fontSize: 13 }}>
            キャンセル
          </Link>
        </div>
      </form>
    </div>
  )
}

const fieldStyle: React.CSSProperties = { marginBottom: 18 }
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 'bold', marginBottom: 6, color: '#333' }
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid #ccc', borderRadius: 6, fontSize: 13 }
