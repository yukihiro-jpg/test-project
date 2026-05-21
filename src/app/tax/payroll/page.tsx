'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Employee, PayrollEntry, load, save, uid, ymKey } from '@/lib/tax/storage'
import { calcKoyoOtsuTax, calcZeirishiTax, calcDueDate, formatJpDate } from '@/lib/tax/calc'

export default function PayrollPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [entries, setEntries] = useState<PayrollEntry[]>([])
  const [paymentDate, setPaymentDate] = useState('')
  const [tokurei, setTokurei] = useState(false)
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  useEffect(() => {
    load().then(s => {
      setEmployees(s.employees)
      setEntries(s.payroll)
      setTokurei(s.payer.noukiTokurei)
    })
  }, [])

  useEffect(() => {
    load().then(s => setPaymentDate(s.paymentDates[ymKey(year, month)] || ''))
  }, [year, month])

  const monthEntries = useMemo(
    () => entries.filter(e => e.year === year && e.month === month),
    [entries, year, month],
  )

  const upsert = async (employeeId: string, patch: Partial<PayrollEntry>) => {
    const s = await load()
    const idx = s.payroll.findIndex(p => p.employeeId === employeeId && p.year === year && p.month === month)
    if (idx >= 0) {
      s.payroll[idx] = { ...s.payroll[idx], ...patch }
    } else {
      s.payroll.push({ id: uid(), employeeId, year, month, amount: 0, ...patch })
    }
    await save(s)
    setEntries(s.payroll)
  }

  const updatePaymentDate = async (v: string) => {
    setPaymentDate(v)
    const s = await load()
    if (v) s.paymentDates[ymKey(year, month)] = v
    else delete s.paymentDates[ymKey(year, month)]
    await save(s)
  }

  const find = (eid: string) => monthEntries.find(e => e.employeeId === eid)

  const dueDateText = useMemo(() => {
    if (!paymentDate) return ''
    const d = new Date(paymentDate + 'T00:00:00')
    if (isNaN(d.getTime())) return ''
    return formatJpDate(calcDueDate(d, tokurei))
  }, [paymentDate, tokurei])

  return (
    <main className="p-4 max-w-md mx-auto">
      <Link href="/tax" className="text-sm text-blue-600">← 戻る</Link>
      <h1 className="text-lg font-bold my-3">月の給与・報酬を入力</h1>

      <div className="bg-white rounded-lg shadow p-3 mb-4 space-y-2">
        <div className="flex gap-2">
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
        <label className="block">
          <span className="text-xs text-gray-500">給与支給日</span>
          <input type="date" className="w-full border rounded px-2 py-1.5"
            value={paymentDate} onChange={e => updatePaymentDate(e.target.value)} />
        </label>
        {dueDateText && (
          <div className="bg-amber-50 border border-amber-200 rounded p-2 text-sm">
            <div className="text-xs text-gray-600">この月の納付期限</div>
            <div className="font-bold text-amber-800">{dueDateText}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">
              {tokurei ? '※ 納期の特例による' : '※ 原則(翌月10日)。土日は翌平日に繰下げ'}
            </div>
          </div>
        )}
      </div>

      <ul className="space-y-3">
        {employees.filter(e => e.kind !== 'hostess').map(emp => {
          const e = find(emp.id)
          const amount = e?.amount ?? 0
          const spot = e?.spotAmount ?? 0
          const ins = e?.socialInsurance ?? 0
          const override = e?.manualTaxOverride ?? null
          let auto = 0
          if (emp.kind === 'zeirishi') auto = calcZeirishiTax(amount) + calcZeirishiTax(spot)
          else auto = calcKoyoOtsuTax(Math.max(0, amount - ins))
          const tax = override != null ? override : auto

          return (
            <li key={emp.id} className="bg-white rounded-lg shadow p-3">
              <div className="flex justify-between items-center mb-2">
                <div>
                  <div className="font-medium">{emp.name}</div>
                  <div className="text-xs text-gray-500">
                    {emp.kind === 'koyo_otsu' ? '一般従業員(乙欄)' : '税理士等(報酬)'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500">源泉税</div>
                  <div className="text-lg font-bold">{tax.toLocaleString()}円</div>
                </div>
              </div>

              {emp.kind === 'zeirishi' ? (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <label>
                    <span className="text-xs text-gray-500">月額顧問料(円)</span>
                    <input type="number" inputMode="numeric"
                      className="w-full border rounded px-2 py-1.5"
                      value={amount || ''}
                      onChange={ev => upsert(emp.id, { amount: parseInt(ev.target.value) || 0 })} />
                  </label>
                  <label>
                    <span className="text-xs text-gray-500">スポット報酬(円)</span>
                    <input type="number" inputMode="numeric"
                      className="w-full border rounded px-2 py-1.5"
                      value={spot || ''}
                      onChange={ev => upsert(emp.id, { spotAmount: parseInt(ev.target.value) || 0 })} />
                  </label>
                  <div className="col-span-2 text-[10px] text-gray-500">
                    ※ それぞれ10.21%(100万円超部分は20.42%)で計算
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <label>
                    <span className="text-xs text-gray-500">支給額(円)</span>
                    <input type="number" inputMode="numeric"
                      className="w-full border rounded px-2 py-1.5"
                      value={amount || ''}
                      onChange={ev => upsert(emp.id, { amount: parseInt(ev.target.value) || 0 })} />
                  </label>
                  <label>
                    <span className="text-xs text-gray-500">社会保険料(円)</span>
                    <input type="number" inputMode="numeric"
                      className="w-full border rounded px-2 py-1.5"
                      value={ins || ''}
                      onChange={ev => upsert(emp.id, { socialInsurance: parseInt(ev.target.value) || 0 })} />
                  </label>
                </div>
              )}

              <details className="mt-2">
                <summary className="text-xs text-gray-500">税額を手動で上書き</summary>
                <input type="number" inputMode="numeric"
                  placeholder={`自動: ${auto.toLocaleString()}円`}
                  className="w-full border rounded px-2 py-1.5 mt-1 text-sm"
                  value={override ?? ''}
                  onChange={ev => upsert(emp.id, {
                    manualTaxOverride: ev.target.value === '' ? null : parseInt(ev.target.value),
                  })} />
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

      {employees.some(e => e.kind === 'hostess') && (
        <div className="mt-4 bg-pink-50 border border-pink-200 rounded p-3 text-sm">
          ホステスの支払は <Link href="/tax/hostess-daily" className="text-blue-600 underline">日々の支払画面</Link> から入力してください。
        </div>
      )}
    </main>
  )
}
