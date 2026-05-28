'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Employee, EmployeeKind, load, save, uid } from '@/lib/tax/storage'

const blank = {
  name: '',
  furigana: '',
  address: '',
  birthday: '',
  memo: '',
  kind: 'koyo_otsu' as EmployeeKind,
}

export default function EmployeesPage() {
  const [list, setList] = useState<Employee[]>([])
  const [form, setForm] = useState(blank)
  const [editId, setEditId] = useState<string | null>(null)

  useEffect(() => {
    load().then(s => setList(s.employees))
  }, [])

  const reset = () => {
    setForm(blank)
    setEditId(null)
  }

  const submit = async () => {
    if (!form.name.trim()) return
    const s = await load()
    if (editId) {
      const idx = s.employees.findIndex(e => e.id === editId)
      if (idx >= 0) s.employees[idx] = { ...s.employees[idx], ...form, name: form.name.trim() }
    } else {
      s.employees.push({
        id: uid(),
        ...form,
        name: form.name.trim(),
        createdAt: Date.now(),
      })
    }
    await save(s)
    setList(s.employees)
    reset()
  }

  const edit = (e: Employee) => {
    setEditId(e.id)
    setForm({
      name: e.name,
      furigana: e.furigana,
      address: e.address,
      birthday: e.birthday,
      memo: e.memo,
      kind: e.kind,
    })
  }

  const del = async (id: string) => {
    if (!confirm('削除しますか? (支払記録も併せて削除されます)')) return
    const s = await load()
    s.employees = s.employees.filter(e => e.id !== id)
    s.dailyPayments = s.dailyPayments.filter(p => p.employeeId !== id)
    await save(s)
    setList(s.employees)
    if (editId === id) reset()
  }

  const update = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm({ ...form, [k]: v })

  return (
    <main className="p-4 max-w-md mx-auto">
      <Link href="/tax/settings" className="text-sm text-blue-600">← 戻る</Link>
      <h1 className="text-lg font-bold my-3">従業員の登録</h1>

      <div className="bg-white rounded-lg shadow p-3 mb-4 space-y-2">
        <div className="text-xs text-gray-500 font-semibold">
          {editId ? '従業員を編集' : '新規登録'}
        </div>
        <Field label="氏名" v={form.name} on={v => update('name', v)} placeholder="例: 山田 花子" />
        <Field label="フリガナ" v={form.furigana} on={v => update('furigana', v)} placeholder="例: ヤマダ ハナコ" />
        <Field label="住所" v={form.address} on={v => update('address', v)} />
        <label className="block">
          <span className="text-xs text-gray-500">生年月日</span>
          <input
            type="date"
            className="w-full border rounded px-2 py-1.5 text-sm"
            value={form.birthday}
            onChange={e => update('birthday', e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-xs text-gray-500">区分</span>
          <select
            className="w-full border rounded px-2 py-1.5 text-sm"
            value={form.kind}
            onChange={e => update('kind', e.target.value as EmployeeKind)}
          >
            <option value="koyo_otsu">一般従業員(乙欄)</option>
            <option value="hostess">ホステス</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-gray-500">メモ</span>
          <textarea
            className="w-full border rounded px-2 py-1.5 text-sm"
            rows={2}
            value={form.memo}
            onChange={e => update('memo', e.target.value)}
          />
        </label>
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
        {list.map(e => (
          <li key={e.id} className="bg-white rounded-lg shadow p-3">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="font-medium">
                  {e.name}
                  {e.furigana && <span className="text-xs text-gray-500 ml-2">({e.furigana})</span>}
                </div>
                <div className="text-xs text-gray-500">
                  {e.kind === 'koyo_otsu' ? '一般従業員(乙欄)' : 'ホステス'}
                  {e.birthday && ` / ${e.birthday}`}
                </div>
                {e.address && <div className="text-xs text-gray-500 mt-0.5">{e.address}</div>}
                {e.memo && <div className="text-xs text-gray-600 mt-1 whitespace-pre-wrap">📝 {e.memo}</div>}
              </div>
              <div className="flex flex-col gap-1 ml-2">
                <button onClick={() => edit(e)} className="text-blue-600 text-xs">編集</button>
                <button onClick={() => void del(e.id)} className="text-red-600 text-xs">削除</button>
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

function Field({
  label, v, on, placeholder,
}: {
  label: string
  v: string
  on: (v: string) => void
  placeholder?: string
}) {
  return (
    <label className="block">
      <span className="text-xs text-gray-500">{label}</span>
      <input
        className="w-full border rounded px-2 py-1.5 text-sm"
        value={v}
        onChange={e => on(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  )
}
