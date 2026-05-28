'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { TaxAccountant, load, save, uid } from '@/lib/tax/storage'
import { calcZeirishiTax } from '@/lib/tax/calc'

const allMonths = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

const blank = {
  name: '',
  amount: 0,
  paymentMonths: [...allMonths],
}

export default function AccountantsPage() {
  const [list, setList] = useState<TaxAccountant[]>([])
  const [form, setForm] = useState(blank)
  const [editId, setEditId] = useState<string | null>(null)

  useEffect(() => {
    load().then(s => setList(s.accountants))
  }, [])

  const reset = () => {
    setForm(blank)
    setEditId(null)
  }

  const submit = async () => {
    if (!form.name.trim() || form.amount <= 0 || form.paymentMonths.length === 0) return
    const s = await load()
    if (editId) {
      const idx = s.accountants.findIndex(a => a.id === editId)
      if (idx >= 0) s.accountants[idx] = { ...s.accountants[idx], ...form, name: form.name.trim() }
    } else {
      s.accountants.push({
        id: uid(),
        ...form,
        name: form.name.trim(),
        createdAt: Date.now(),
      })
    }
    await save(s)
    setList(s.accountants)
    reset()
  }

  const edit = (a: TaxAccountant) => {
    setEditId(a.id)
    setForm({
      name: a.name,
      amount: a.amount,
      paymentMonths: [...a.paymentMonths],
    })
  }

  const del = async (id: string) => {
    if (!confirm('削除しますか?')) return
    const s = await load()
    s.accountants = s.accountants.filter(a => a.id !== id)
    await save(s)
    setList(s.accountants)
    if (editId === id) reset()
  }

  const toggleMonth = (m: number) => {
    const cur = form.paymentMonths
    setForm({
      ...form,
      paymentMonths: cur.includes(m) ? cur.filter(x => x !== m) : [...cur, m].sort((a, b) => a - b),
    })
  }

  const setAllMonths = () => setForm({ ...form, paymentMonths: [...allMonths] })
  const clearMonths = () => setForm({ ...form, paymentMonths: [] })

  const previewTax = form.amount > 0 ? calcZeirishiTax(form.amount) : 0

  return (
    <main className="p-4 max-w-md mx-auto">
      <Link href="/tax/settings" className="text-sm text-blue-600">← 戻る</Link>
      <h1 className="text-lg font-bold my-3">税理士報酬の登録</h1>

      <div className="bg-white rounded-lg shadow p-3 mb-4 space-y-2">
        <div className="text-xs text-gray-500 font-semibold">
          {editId ? '税理士情報を編集' : '新規登録'}
        </div>
        <label className="block">
          <span className="text-xs text-gray-500">氏名・名称</span>
          <input
            className="w-full border rounded px-2 py-1.5 text-sm"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="例: 山田税理士事務所"
          />
        </label>
        <label className="block">
          <span className="text-xs text-gray-500">報酬額(円・1回あたり)</span>
          <input
            type="number"
            inputMode="numeric"
            className="w-full border rounded px-2 py-1.5 text-sm"
            value={form.amount || ''}
            onChange={e => setForm({ ...form, amount: parseInt(e.target.value) || 0 })}
          />
        </label>
        {form.amount > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs space-y-0.5">
            <div className="flex justify-between"><span>報酬額</span><b>{form.amount.toLocaleString()}円</b></div>
            <div className="flex justify-between text-red-700"><span>源泉所得税</span><b>−{previewTax.toLocaleString()}円</b></div>
            <div className="flex justify-between text-green-800 border-t border-amber-300 pt-1 mt-1">
              <span>差引支払額</span><b>{(form.amount - previewTax).toLocaleString()}円</b>
            </div>
          </div>
        )}

        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-gray-500">支払月</span>
            <div className="flex gap-2">
              <button onClick={setAllMonths} className="text-[10px] text-blue-600">全選択</button>
              <button onClick={clearMonths} className="text-[10px] text-gray-500">全解除</button>
            </div>
          </div>
          <div className="grid grid-cols-6 gap-1">
            {allMonths.map(m => {
              const on = form.paymentMonths.includes(m)
              return (
                <button
                  key={m}
                  onClick={() => toggleMonth(m)}
                  className={`text-sm py-1.5 rounded border ${
                    on ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'
                  }`}
                >
                  {m}月
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={() => void submit()}
            className="flex-1 bg-blue-600 text-white rounded py-2 text-sm"
          >
            {editId ? '更新' : '追加'}
          </button>
          {editId && (
            <button onClick={reset} className="px-3 border rounded text-sm">
              キャンセル
            </button>
          )}
        </div>
      </div>

      <ul className="space-y-2">
        {list.map(a => (
          <li key={a.id} className="bg-white rounded-lg shadow p-3">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="font-medium">{a.name}</div>
                <div className="text-xs text-gray-500">
                  報酬: {a.amount.toLocaleString()}円 / 税: {calcZeirishiTax(a.amount).toLocaleString()}円
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  支払月: {a.paymentMonths.length === 12 ? '毎月' : a.paymentMonths.map(m => `${m}月`).join('・')}
                </div>
              </div>
              <div className="flex flex-col gap-1 ml-2">
                <button onClick={() => edit(a)} className="text-blue-600 text-xs">編集</button>
                <button onClick={() => void del(a.id)} className="text-red-600 text-xs">削除</button>
              </div>
            </div>
          </li>
        ))}
        {list.length === 0 && (
          <li className="text-sm text-gray-500 text-center py-6">まだ登録がありません</li>
        )}
      </ul>
    </main>
  )
}
