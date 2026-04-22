'use client'

import { useState, useEffect, useCallback } from 'react'

interface Props {
  clientId: string | null
  clientName: string | null
}

type SyncState = 'idle' | 'uploading' | 'downloading' | 'error'

// 各ストアの実際のlocalStorageキー定義（key名 → クライアントIDを差し込んだ実キーを返す関数）
const STORAGE_KEY_MAP: Record<string, (cid: string) => string> = {
  'patterns': (cid) => `bs-patterns-${cid}`,
  'account-master': (cid) => `bs-accounts-${cid}`,
  'sub-account-master': (cid) => `bs-sub-accounts-${cid}`,
  'account-tax-master': (cid) => `bs-account-tax-${cid}`,
  'temp-entries': (cid) => `bs-temp-csv-${cid}`,
  'fixed-journals': (cid) => `bs-fixed-journals-${cid}`,
  'bank-templates': (cid) => `bs-bank-templates-${cid}`,
  'processing-status': (cid) => `bank-statement-client-${cid}-processing-status`,
}
const STORAGE_KEYS = Object.keys(STORAGE_KEY_MAP)

export default function DriveSyncButton({ clientId, clientName }: Props) {
  const [connected, setConnected] = useState(false)
  const [syncState, setSyncState] = useState<SyncState>('idle')
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetch('/api/drive/status')
      .then((r) => r.json())
      .then((d) => setConnected(d.connected))
      .catch(() => setConnected(false))
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('drive') === 'connected') {
      setConnected(true)
      setMessage('Google Drive に接続しました')
      window.history.replaceState({}, '', window.location.pathname)
      setTimeout(() => setMessage(''), 3000)
    }
  }, [])

  const getClientStorageKey = (key: string, cid?: string) => {
    const mapper = STORAGE_KEY_MAP[key]
    if (mapper && cid) return mapper(cid)
    return `bank-statement-${key}`
  }

  // ↑保存: 現在の顧問先データ + 顧問先一覧を Drive に保存
  const handleUpload = useCallback(async () => {
    if (!clientId) { setMessage('顧問先を選択してください'); return }

    // 顧問先一覧が空の場合は警告
    const clientListRaw = localStorage.getItem('bank-statement-clients')
    const parsedClients = clientListRaw ? JSON.parse(clientListRaw) : []
    if (Array.isArray(parsedClients) && parsedClients.length === 0) {
      if (!window.confirm('顧問先が0件です。Driveの顧問先一覧が上書きされ、他のPCでも空になります。\n本当に保存しますか？')) return
    }

    setSyncState('uploading')
    setMessage('Drive にアップロード中...')
    try {
      const items: { clientId: string; clientName: string | null; key: string; data: unknown }[] = []

      for (const key of STORAGE_KEYS) {
        const storageKey = getClientStorageKey(key, clientId)
        const raw = localStorage.getItem(storageKey)
        if (raw) {
          try { items.push({ clientId, clientName, key, data: JSON.parse(raw) }) } catch { /* skip */ }
        }
      }

      if (clientListRaw) {
        try { items.push({ clientId: '_global', clientName: null, key: 'clients', data: JSON.parse(clientListRaw) }) } catch { /* skip */ }
      }

      const hasClientItem = items.some((i) => i.clientId === clientId)
      if (!hasClientItem && clientId) {
        items.push({ clientId, clientName, key: '_marker', data: { updated: new Date().toISOString() } })
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
  }, [clientId, clientName])

  // ↓読込: 全顧問先のデータ（科目マスタ・パターン等）を一括で Drive から読込
  const handleDownload = useCallback(async () => {
    setSyncState('downloading')
    setMessage('Drive から全データをダウンロード中...')
    try {
      let downloaded = 0

      // 1. 顧問先一覧を取得
      const globalRes = await fetch('/api/drive?clientId=_global&key=clients')
      let clients: { id: string; name: string }[] = []
      if (globalRes.ok) {
        const { data } = await globalRes.json()
        if (data && Array.isArray(data)) {
          localStorage.setItem('bank-statement-clients', JSON.stringify(data))
          clients = data
          downloaded++
        }
      }

      // 2. 全顧問先のデータを一括読込（科目マスタ・パターン・補助科目等すべて）
      for (const client of clients) {
        setMessage(`ダウンロード中... ${client.name}`)
        const nameParam = client.name ? `&clientName=${encodeURIComponent(client.name)}` : ''
        for (const key of STORAGE_KEYS) {
          try {
            const res = await fetch(`/api/drive?clientId=${encodeURIComponent(client.id)}${nameParam}&key=${encodeURIComponent(key)}`)
            if (!res.ok) continue
            const { data } = await res.json()
            if (data != null) {
              const storageKey = getClientStorageKey(key, client.id)
              localStorage.setItem(storageKey, JSON.stringify(data))
              downloaded++
            }
          } catch { /* skip */ }
        }
      }

      setMessage(`${downloaded}件のデータを全顧問先分ダウンロードしました。ページを再読込(F5)してください。`)
      setSyncState('idle')
    } catch (err) {
      setMessage(`エラー: ${err instanceof Error ? err.message : 'ダウンロード失敗'}`)
      setSyncState('error')
    }
  }, [])

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
        title="Driveから全顧問先のデータを一括ダウンロード"
        className="px-2 py-1 text-xs bg-sky-600 hover:bg-sky-700 text-white rounded disabled:opacity-50">
        {syncState === 'downloading' ? '...' : '↓読込'}
      </button>
      <button onClick={handleDisconnect}
        className="px-1 py-1 text-xs text-gray-400 hover:text-red-400" title="Drive連携解除">×</button>
      {message && <span className="text-xs text-amber-300 ml-1">{message}</span>}
    </div>
  )
}
