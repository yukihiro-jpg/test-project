'use client'

import { useState, useEffect, useCallback } from 'react'

interface Props {
  clientId: string | null
}

type SyncState = 'idle' | 'uploading' | 'downloading' | 'error'

const STORAGE_KEYS = [
  'patterns', 'account-master', 'sub-account-master',
  'account-tax-master', 'temp-entries', 'fixed-journals',
  'bank-templates',
]

export default function DriveSyncButton({ clientId }: Props) {
  const [connected, setConnected] = useState(false)
  const [syncState, setSyncState] = useState<SyncState>('idle')
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetch('/api/drive/status')
      .then((r) => r.json())
      .then((d) => setConnected(d.connected))
      .catch(() => setConnected(false))
  }, [])

  // URL パラメータで接続完了を検知
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('drive') === 'connected') {
      setConnected(true)
      setMessage('Google Drive に接続しました')
      // URLパラメータをクリーン
      window.history.replaceState({}, '', window.location.pathname)
      setTimeout(() => setMessage(''), 3000)
    }
  }, [])

  const getClientStorageKey = (key: string) => {
    if (!clientId) return `bank-statement-${key}`
    return `bank-statement-client-${clientId}-${key}`
  }

  const handleUpload = useCallback(async () => {
    if (!clientId) { setMessage('顧問先を選択してください'); return }
    setSyncState('uploading')
    setMessage('Drive にアップロード中...')
    try {
      const items: { clientId: string; key: string; data: unknown }[] = []

      // 顧問先固有データ
      for (const key of STORAGE_KEYS) {
        const storageKey = getClientStorageKey(key)
        const raw = localStorage.getItem(storageKey)
        if (raw) {
          try { items.push({ clientId, key, data: JSON.parse(raw) }) } catch { /* skip */ }
        }
      }

      // 顧問先一覧（グローバル）
      const clientList = localStorage.getItem('bank-statement-clients')
      if (clientList) {
        try { items.push({ clientId: '_global', key: 'clients', data: JSON.parse(clientList) }) } catch { /* skip */ }
      }

      if (items.length === 0) {
        setMessage('アップロードするデータがありません')
        setSyncState('idle')
        return
      }

      const res = await fetch('/api/drive', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Upload failed')

      const result = await res.json()
      setMessage(`${result.count}件のデータを Drive にアップロードしました`)
      setSyncState('idle')
    } catch (err) {
      setMessage(`エラー: ${err instanceof Error ? err.message : 'アップロード失敗'}`)
      setSyncState('error')
    }
    setTimeout(() => { setMessage(''); setSyncState('idle') }, 4000)
  }, [clientId])

  const handleDownload = useCallback(async () => {
    if (!clientId) { setMessage('顧問先を選択してください'); return }
    setSyncState('downloading')
    setMessage('Drive からダウンロード中...')
    try {
      let downloaded = 0

      // 顧問先固有データ
      for (const key of STORAGE_KEYS) {
        const res = await fetch(`/api/drive?clientId=${encodeURIComponent(clientId)}&key=${encodeURIComponent(key)}`)
        if (!res.ok) continue
        const { data } = await res.json()
        if (data != null) {
          localStorage.setItem(getClientStorageKey(key), JSON.stringify(data))
          downloaded++
        }
      }

      // 顧問先一覧
      const globalRes = await fetch(`/api/drive?clientId=_global&key=clients`)
      if (globalRes.ok) {
        const { data } = await globalRes.json()
        if (data) {
          localStorage.setItem('bank-statement-clients', JSON.stringify(data))
          downloaded++
        }
      }

      setMessage(`${downloaded}件のデータを Drive からダウンロードしました。ページを再読込してください。`)
      setSyncState('idle')
    } catch (err) {
      setMessage(`エラー: ${err instanceof Error ? err.message : 'ダウンロード失敗'}`)
      setSyncState('error')
    }
  }, [clientId])

  const handleDisconnect = async () => {
    await fetch('/api/drive/status', { method: 'DELETE' })
    setConnected(false)
    setMessage('Google Drive との接続を解除しました')
    setTimeout(() => setMessage(''), 3000)
  }

  if (!connected) {
    return (
      <div className="flex items-center gap-2">
        <a href="/api/auth/google"
          className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center gap-1">
          Drive連携
        </a>
        {message && <span className="text-xs text-green-400">{message}</span>}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-green-400 font-medium">Drive</span>
      <button onClick={handleUpload} disabled={syncState !== 'idle'}
        title="現在の顧問先データをDriveにアップロード"
        className="px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded disabled:opacity-50">
        {syncState === 'uploading' ? '...' : '↑保存'}
      </button>
      <button onClick={handleDownload} disabled={syncState !== 'idle'}
        title="Driveから現在の顧問先データをダウンロード"
        className="px-2 py-1 text-xs bg-sky-600 hover:bg-sky-700 text-white rounded disabled:opacity-50">
        {syncState === 'downloading' ? '...' : '↓読込'}
      </button>
      <button onClick={handleDisconnect}
        className="px-1 py-1 text-xs text-gray-400 hover:text-red-400" title="Drive連携解除">×</button>
      {message && <span className="text-xs text-amber-300 ml-1">{message}</span>}
    </div>
  )
}
