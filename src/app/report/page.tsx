'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { Client } from '@/types/report'

export default function ReportClientListPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/report/clients')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setClients(data)
        else setError(data.error ?? 'エラーが発生しました')
      })
      .catch(() => setError('データの取得に失敗しました'))
      .finally(() => setLoading(false))
  }, [])

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`「${name}」を削除しますか？`)) return
    const res = await fetch(`/api/report/clients/${id}`, { method: 'DELETE' })
    if (res.ok) setClients(prev => prev.filter(c => c.id !== id))
    else alert('削除に失敗しました')
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 'bold', color: '#1a3a6b' }}>月次財務報告書 — 顧問先一覧</h1>
        <Link href="/report/new" style={btnStyle('#1a3a6b')}>＋ 新規登録</Link>
      </div>

      {loading && <p style={{ color: '#666' }}>読み込み中...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {!loading && !error && clients.length === 0 && (
        <div style={{ textAlign: 'center', padding: 48, color: '#888', border: '2px dashed #ddd', borderRadius: 8 }}>
          <p>顧問先が登録されていません</p>
          <Link href="/report/new" style={{ ...btnStyle('#4472C4'), display: 'inline-block', marginTop: 16 }}>
            最初の顧問先を登録する
          </Link>
        </div>
      )}

      {clients.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#1a3a6b', color: 'white' }}>
              <th style={thStyle}>顧問先名</th>
              <th style={thStyle}>決算月</th>
              <th style={thStyle}>当期</th>
              <th style={thStyle}>登録日</th>
              <th style={thStyle}>操作</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c, i) => (
              <tr key={c.id} style={{ background: i % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                <td style={tdStyle}>
                  <Link href={`/report/${c.id}`} style={{ color: '#1a3a6b', fontWeight: 'bold', textDecoration: 'none' }}>
                    {c.name}
                  </Link>
                </td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>{c.fiscalYearEndMonth}月</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>{c.fiscalYearLabel}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>{new Date(c.createdAt).toLocaleDateString('ja-JP')}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>
                  <Link href={`/report/${c.id}`} style={smallBtnStyle('#4472C4')}>詳細</Link>
                  {' '}
                  <button onClick={() => handleDelete(c.id, c.name)} style={smallBtnStyle('#c00')}>削除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

const btnStyle = (bg: string): React.CSSProperties => ({
  background: bg, color: 'white', padding: '8px 16px', borderRadius: 6,
  textDecoration: 'none', fontSize: 13, fontWeight: 'bold', display: 'inline-block',
  border: 'none', cursor: 'pointer',
})
const smallBtnStyle = (bg: string): React.CSSProperties => ({
  background: bg, color: 'white', padding: '3px 10px', borderRadius: 4,
  textDecoration: 'none', fontSize: 11, border: 'none', cursor: 'pointer', display: 'inline-block',
})
const thStyle: React.CSSProperties = { padding: '10px 12px', textAlign: 'left', fontWeight: 'bold', fontSize: 12 }
const tdStyle: React.CSSProperties = { padding: '10px 12px', borderBottom: '1px solid #eee', fontSize: 12 }
