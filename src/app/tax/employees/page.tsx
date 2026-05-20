'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Employee, EmployeeKind, load, save, uid } from '@/lib/tax/storage'

export default function EmployeesPage() {
  const [list, setList] = useState<Employee[]>([])
  const [name, setName] = useState('')
  const [kind, setKind] = useState<EmployeeKind>('koyo_otsu')

  useEffect(() => { setList(load().employees) }, [])

  const add = () => {
    if (!name.trim()) return
    const s = load()
    s.employees.push({ id: uid(), name: name.trim(), kind, createdAt: Date.now() })
    save(s)
    setList(s.employees)
    setName('')
  }

  const del = (id: string) => {
    if (!confirm('削除しますか?')) return
    const s = load()
    s.employees = s.employees.filter(e => e.id !== id)
    s.payroll = s.payroll.filter(p => p.employeeId !== id)
    save(s)
    setList(s.employees)
  }

  return (
    <main className="p-4 max-w-md mx-auto">
      <Link href="/tax" className="text-sm text-blue-600">← 戻る</Link>
      <h1 className="text-lg font-bold my-3">従業員の登録</h1>

      <div className="bg-white rounded-lg shadow p-3 mb-4 space-y-2">
        <label className="block">
          <span className="text-xs text-gray-500">本名</span>
          <input
            className="w-full border rounded px-2 py-1.5"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="例: 山田 花子"
          />
        </label>
        <label className="block">
          <span className="text-xs text-gray-500">区分</span>
          <select
            className="w-full border rounded px-2 py-1.5"
            value={kind}
            onChange={e => setKind(e.target.value as EmployeeKind)}
          >
            <option value="koyo_otsu">一般従業員(乙欄)</option>
            <option value="hostess">ホステス日雇・派遣</option>
          </select>
        </label>
        <button onClick={add} className="w-full bg-blue-600 text-white rounded py-2">追加</button>
      </div>

      <ul className="space-y-2">
        {list.map(e => (
          <li key={e.id} className="bg-white rounded-lg shadow p-3 flex justify-between items-center">
            <div>
              <div className="font-medium">{e.name}</div>
              <div className="text-xs text-gray-500">
                {e.kind === 'koyo_otsu' ? '一般従業員(乙欄)' : 'ホステス日雇・派遣'}
              </div>
            </div>
            <button onClick={() => del(e.id)} className="text-red-600 text-sm">削除</button>
          </li>
        ))}
        {list.length === 0 && (
          <li className="text-sm text-gray-500 text-center py-6">まだ登録がありません</li>
        )}
      </ul>
    </main>
  )
}
