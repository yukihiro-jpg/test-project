'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Employee, PayrollEntry, load, save, uid } from '@/lib/tax/storage'
import { calcHostessTax, calcKoyoOtsuTax } from '@/lib/tax/calc'

export default function PayrollPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [entries, setEntries] = useState<PayrollEntry[]>([])
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  useEffect(() => {
    const s = load()
    setEmployees(s.employees)
    setEntries(s.payroll)
  }, [])

  const monthEntries = useMemo(
    () => entries.filter(e => e.year === year && e.month === month),
    [entries, year, month],
  )

  const upsert = (employeeId: string, patch: Partial<PayrollEntry>) => {
    const s = load()
    const idx = s.payroll.findIndex(p => p.employeeId === employeeId && p.year === year && p.month === month)
    if (idx >= 0) {
      s.payroll[idx] = { ...s.payroll[idx], ...patch }
    } else {
      s.payroll.push({ id: uid(), employeeId, year, month, amount: 0, ...patch })
    }
    save(s)
    setEntries(s.payroll)
  }

  const find = (eid: string) => monthEntries.find(e => e.employeeId === eid)

  return (
    <main className="p-4 max-w-md mx-auto">
      <Link href="/tax" className="text-sm text-blue-600">← 戻る</Link>
      <h1 className="text-lg font-bold my-3">月の給与・報酬を入力</h1>

      <div className="bg-white rounded-lg shadow p-3 mb-4 flex gap-2">
        <label className="flex-1">
          <span className="text-xs text-gray-500">年</span>
          <input type="number" className="w-full border rounded px-2 py-1.5"
            value={year} onChange={e => setYear(parseInt(e.target.value) || year)} />
        </label>
        <label className="flex-1">
          <span className="text-xs text-gray-500">月</span>
          <select className="w-full border rounded px-2 py-1.5"
            value={month} onChange={e => setMonth(parseInt(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>{m}月</option>
            ))}
          </select>
        </label>
      </div>

      <ul className="space-y-3">
        {employees.map(emp => {
          const e = find(emp.id)
          const amount = e?.amount ?? 0
          const days = e?.days ?? 0
          const ins = e?.socialInsurance ?? 0
          const override = e?.manualTaxOverride ?? null
          const auto = emp.kind === 'hostess'
            ? calcHostessTax(amount, days)
            : calcKoyoOtsuTax(Math.max(0, amount - ins))
          const tax = override != null ? override : auto

          return (
            <li key={emp.id} className="bg-white rounded-lg shadow p-3">
              <div className="flex justify-between items-center mb-2">
                <div>
                  <div className="font-medium">{emp.name}</div>
                  <div className="text-xs text-gray-500">
                    {emp.kind === 'koyo_otsu' ? '一般従業員(乙欄)' : 'ホステス日雇・派遣'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500">源泉税</div>
                  <div className="text-lg font-bold">{tax.toLocaleString()}円</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <label>
                  <span className="text-xs text-gray-500">支払額(円)</span>
                  <input type="number" inputMode="numeric"
                    className="w-full border rounded px-2 py-1.5"
                    value={amount || ''}
                    onChange={ev => upsert(emp.id, { amount: parseInt(ev.target.value) || 0 })} />
                </label>
                {emp.kind === 'hostess' ? (
                  <label>
                    <span className="text-xs text-gray-500">出勤日数</span>
                    <input type="number" inputMode="numeric"
                      className="w-full border rounded px-2 py-1.5"
                      value={days || ''}
                      onChange={ev => upsert(emp.id, { days: parseInt(ev.target.value) || 0 })} />
                  </label>
                ) : (
                  <label>
                    <span className="text-xs text-gray-500">社会保険料(円)</span>
                    <input type="number" inputMode="numeric"
                      className="w-full border rounded px-2 py-1.5"
                      value={ins || ''}
                      onChange={ev => upsert(emp.id, { socialInsurance: parseInt(ev.target.value) || 0 })} />
                  </label>
                )}
              </div>
              <details className="mt-2">
                <summary className="text-xs text-gray-500">税額を手動で上書き</summary>
                <input type="number" inputMode="numeric"
                  placeholder={`自動: ${auto.toLocaleString()}円`}
                  className="w-full border rounded px-2 py-1.5 mt-1 text-sm"
                  value={override ?? ''}
                  onChange={ev => upsert(emp.id, {
                    manualTaxOverride: ev.target.value === '' ? null : parseInt(ev.target.value),
                  })} />
                <div className="text-[10px] text-gray-400 mt-1">
                  ※ 乙欄の月額表をご確認のうえ、必要なら上書きしてください。
                </div>
              </details>
            </li>
          )
        })}
        {employees.length === 0 && (
          <li className="text-sm text-gray-500 text-center py-6">
            先に <Link href="/tax/employees" className="text-blue-600 underline">従業員登録</Link> を行ってください
          </li>
        )}
      </ul>
    </main>
  )
}
