'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { load, save, PayerInfo } from '@/lib/tax/storage'

export default function PayerSettingsPage() {
  const [payer, setPayer] = useState<PayerInfo | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    load().then(s => setPayer(s.payer))
  }, [])

  if (!payer) return null

  const update = (k: keyof PayerInfo, v: string | boolean) =>
    setPayer({ ...payer, [k]: v })

  const saveAll = async () => {
    setSaving(true)
    const s = await load()
    s.payer = payer
    await save(s)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <main className="p-4 max-w-md mx-auto">
      <Link href="/tax/settings" className="text-sm text-blue-600">← 戻る</Link>
      <h1 className="text-lg font-bold my-3">納付者情報</h1>

      <div className="bg-white rounded-lg shadow p-3 space-y-2">
        <Field label="税務署名" v={payer.taxOffice} on={v => update('taxOffice', v)} />
        <Field label="税務署番号(3桁)" v={payer.taxOfficeNumber} on={v => update('taxOfficeNumber', v)} />
        <Field label="整理番号(8桁)" v={payer.seiriNumber} on={v => update('seiriNumber', v)} />
        <Field label="整理番号(13桁/記入者)" v={payer.payerNumber} on={v => update('payerNumber', v)} />
        <Field label="住所(所在地)" v={payer.address} on={v => update('address', v)} />
        <Field label="氏名(名称)" v={payer.name} on={v => update('name', v)} />
        <Field label="電話番号" v={payer.phone} on={v => update('phone', v)} />
        <label className="flex items-center gap-2 mt-2">
          <input
            type="checkbox"
            checked={payer.noukiTokurei}
            onChange={e => update('noukiTokurei', e.target.checked)}
          />
          <span className="text-sm">納期の特例を適用(半年に1回納付)</span>
        </label>
      </div>

      <button
        onClick={() => void saveAll()}
        disabled={saving}
        className="w-full mt-4 bg-blue-600 text-white rounded py-2 disabled:opacity-50"
      >
        {saving ? '保存中…' : saved ? '保存しました ✓' : '保存'}
      </button>
    </main>
  )
}

function Field({ label, v, on }: { label: string; v: string; on: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs text-gray-500">{label}</span>
      <input
        className="w-full border rounded px-2 py-1.5 text-sm"
        value={v}
        onChange={e => on(e.target.value)}
      />
    </label>
  )
}
