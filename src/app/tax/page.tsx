'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { load, save, PayerInfo } from '@/lib/tax/storage'

export default function TaxHome() {
  const [payer, setPayer] = useState<PayerInfo | null>(null)
  const [edit, setEdit] = useState(false)

  useEffect(() => { setPayer(load().payer) }, [])

  if (!payer) return null

  const update = (k: keyof PayerInfo, v: string) => setPayer({ ...payer, [k]: v })
  const saveAll = () => {
    const s = load()
    s.payer = payer
    save(s)
    setEdit(false)
  }

  return (
    <main className="p-4 max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-1">源泉所得税 納付書アシスタント</h1>
      <p className="text-xs text-gray-500 mb-4">
        毎月の源泉所得税を計算し、納付書のイメージを表示します。
      </p>

      <div className="bg-white rounded-lg shadow p-3 mb-4">
        <div className="flex justify-between items-center mb-2">
          <h2 className="font-semibold text-sm">納付者情報</h2>
          <button
            className="text-blue-600 text-sm"
            onClick={() => (edit ? saveAll() : setEdit(true))}
          >
            {edit ? '保存' : '編集'}
          </button>
        </div>
        {edit ? (
          <div className="space-y-2 text-sm">
            <Field label="税務署名" v={payer.taxOffice} on={v => update('taxOffice', v)} />
            <Field label="税務署番号(3桁)" v={payer.taxOfficeNumber} on={v => update('taxOfficeNumber', v)} />
            <Field label="整理番号(8桁)" v={payer.seiriNumber} on={v => update('seiriNumber', v)} />
            <Field label="整理番号(13桁/記入者)" v={payer.payerNumber} on={v => update('payerNumber', v)} />
            <Field label="住所(所在地)" v={payer.address} on={v => update('address', v)} />
            <Field label="氏名(名称)" v={payer.name} on={v => update('name', v)} />
            <Field label="電話番号" v={payer.phone} on={v => update('phone', v)} />
            <label className="flex items-center gap-2 mt-2">
              <input type="checkbox" checked={payer.noukiTokurei}
                onChange={e => setPayer({ ...payer, noukiTokurei: e.target.checked })} />
              <span className="text-sm">納期の特例を適用(半年に1回納付)</span>
            </label>
          </div>
        ) : (
          <div className="text-sm text-gray-700 space-y-0.5">
            <div>税務署: {payer.taxOffice || '—'} ({payer.taxOfficeNumber || '—'})</div>
            <div>整理番号: {payer.seiriNumber || '—'}</div>
            <div>氏名: {payer.name || '—'}</div>
            <div>住所: {payer.address || '—'}</div>
            <div>電話: {payer.phone || '—'}</div>
            <div>納期の特例: {payer.noukiTokurei ? '適用' : '通常(翌月10日)'}</div>
          </div>
        )}
      </div>

      <div className="grid gap-3">
        <Link href="/tax/employees" className="block bg-white rounded-lg shadow p-4">
          <div className="font-semibold">① 従業員の登録</div>
          <div className="text-xs text-gray-500 mt-1">本名と区分(一般従業員/ホステス日雇)を登録します。</div>
        </Link>
        <Link href="/tax/payroll" className="block bg-white rounded-lg shadow p-4">
          <div className="font-semibold">② 月の給与・報酬を入力</div>
          <div className="text-xs text-gray-500 mt-1">月ごとに支払額を入力します。税額は自動計算されます。</div>
        </Link>
        <Link href="/tax/slip" className="block bg-white rounded-lg shadow p-4">
          <div className="font-semibold">③ 納付書イメージを表示</div>
          <div className="text-xs text-gray-500 mt-1">月を選んで給与所得・報酬料金の納付書イメージを表示します。</div>
        </Link>
      </div>

      <p className="text-[10px] text-gray-400 mt-6 leading-relaxed">
        ※ Safari/Chrome の「ホーム画面に追加」でアプリのように使えます。<br/>
        ※ データはこの端末内にのみ保存されます。
      </p>
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
