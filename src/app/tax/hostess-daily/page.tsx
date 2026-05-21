'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Employee, HostessDailyEntry, load, save, uid } from '@/lib/tax/storage'
import { calcHostessDailyTax } from '@/lib/tax/calc'

export default function HostessDailyPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [daily, setDaily] = useState<HostessDailyEntry[]>([])
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const [employeeId, setEmployeeId] = useState('')
  const [amount, setAmount] = useState('')

  useEffect(() => {
    const s = load()
    setEmployees(s.employees.filter(e => e.kind === 'hostess'))
    setDaily(s.hostessDaily)
  }, [])

  const tax = amount ? calcHostessDailyTax(parseInt(amount) || 0) : 0
  const net = amount ? (parseInt(amount) || 0) - tax : 0

  const add = () => {
    const a = parseInt(amount) || 0
    if (!employeeId || a <= 0 || !date) return
    const s = load()
    s.hostessDaily.push({ id: uid(), employeeId, date, amount: a })
    save(s)
    setDaily(s.hostessDaily)
    setAmount('')
  }

  const del = (id: string) => {
    if (!confirm('削除しますか?')) return
    const s = load()
    s.hostessDaily = s.hostessDaily.filter(d => d.id !== id)
    save(s)
    setDaily(s.hostessDaily)
  }

  const dayEntries = useMemo(
    () => daily.filter(d => d.date === date).sort((a, b) => a.id.localeCompare(b.id)),
    [daily, date],
  )

  const recent = useMemo(
    () => [...daily].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).slice(0, 30),
    [daily],
  )

  const nameOf = (eid: string) => employees.find(e => e.id === eid)?.name || '(削除済)'

  const dayTotal = dayEntries.reduce(
    (acc, d) => {
      const t = calcHostessDailyTax(d.amount)
      acc.gross += d.amount
      acc.tax += t
      acc.net += d.amount - t
      return acc
    },
    { gross: 0, tax: 0, net: 0 },
  )

  return (
    <main className="p-4 max-w-md mx-auto">
      <Link href="/tax" className="text-sm text-blue-600">← 戻る</Link>
      <h1 className="text-lg font-bold my-3">ホステス 日々の支払</h1>

      <div className="bg-white rounded-lg shadow p-3 mb-3 space-y-2">
        <label className="block">
          <span className="text-xs text-gray-500">日付</span>
          <input type="date" className="w-full border rounded px-2 py-1.5"
            value={date} onChange={e => setDate(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-xs text-gray-500">ホステス</span>
          <select className="w-full border rounded px-2 py-1.5"
            value={employeeId} onChange={e => setEmployeeId(e.target.value)}>
            <option value="">選択してください</option>
            {employees.map(e => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-gray-500">本日の支払額(円)</span>
          <input type="number" inputMode="numeric"
            className="w-full border rounded px-2 py-1.5"
            value={amount} onChange={e => setAmount(e.target.value)} />
        </label>

        {amount && parseInt(amount) > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded p-2 text-sm space-y-0.5">
            <div className="flex justify-between"><span>支払額(総額)</span><b>{parseInt(amount).toLocaleString()}円</b></div>
            <div className="flex justify-between text-red-700"><span>源泉徴収税(10.21%)</span><b>−{tax.toLocaleString()}円</b></div>
            <div className="flex justify-between text-green-800 border-t border-amber-300 pt-1 mt-1">
              <span>本人へ支払う金額</span><b className="text-base">{net.toLocaleString()}円</b>
            </div>
          </div>
        )}

        <button onClick={add} className="w-full bg-blue-600 text-white rounded py-2 disabled:opacity-40"
          disabled={!employeeId || !amount}>
          記録する
        </button>
      </div>

      {employees.length === 0 && (
        <div className="bg-white rounded p-3 text-sm text-gray-500 text-center">
          ホステスの登録がありません。
          <Link href="/tax/employees" className="text-blue-600 underline ml-1">登録画面へ</Link>
        </div>
      )}

      <h2 className="text-sm font-semibold mt-4 mb-2">{date} の記録</h2>
      <ul className="space-y-2">
        {dayEntries.length === 0 && (
          <li className="text-xs text-gray-500 text-center py-3">この日の記録はありません</li>
        )}
        {dayEntries.map(d => {
          const t = calcHostessDailyTax(d.amount)
          return (
            <li key={d.id} className="bg-white rounded shadow p-2 flex justify-between items-center text-sm">
              <div>
                <div className="font-medium">{nameOf(d.employeeId)}</div>
                <div className="text-xs text-gray-500">
                  総額 {d.amount.toLocaleString()} / 税 {t.toLocaleString()} / 手取 {(d.amount - t).toLocaleString()}
                </div>
              </div>
              <button onClick={() => del(d.id)} className="text-red-600 text-xs">削除</button>
            </li>
          )
        })}
        {dayEntries.length > 0 && (
          <li className="bg-blue-50 rounded p-2 text-xs flex justify-between">
            <span>当日合計</span>
            <span>総額 {dayTotal.gross.toLocaleString()} / 税 {dayTotal.tax.toLocaleString()} / 手取 {dayTotal.net.toLocaleString()}</span>
          </li>
        )}
      </ul>

      <h2 className="text-sm font-semibold mt-6 mb-2">最近の記録(直近30件)</h2>
      <ul className="space-y-1">
        {recent.map(d => (
          <li key={d.id} className="bg-white rounded p-2 text-xs flex justify-between">
            <span>{d.date} {nameOf(d.employeeId)}</span>
            <span>{d.amount.toLocaleString()}円</span>
          </li>
        ))}
      </ul>
    </main>
  )
}
