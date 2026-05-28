'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { DailyPayment, Employee, load, save, uid } from '@/lib/tax/storage'
import { calcHostessDailyTax, calcKoyoOtsuTax } from '@/lib/tax/calc'

function calcTaxFor(emp: Employee | undefined, amount: number): number {
  if (!emp || amount <= 0) return 0
  if (emp.kind === 'hostess') return calcHostessDailyTax(amount)
  return calcKoyoOtsuTax(amount)
}

export default function DailyPaymentPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [payments, setPayments] = useState<DailyPayment[]>([])
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const [employeeId, setEmployeeId] = useState('')
  const [amount, setAmount] = useState('')

  useEffect(() => {
    load().then(s => {
      setEmployees(s.employees)
      setPayments(s.dailyPayments)
    })
  }, [])

  const selected = employees.find(e => e.id === employeeId)
  const amountNum = parseInt(amount) || 0
  const tax = calcTaxFor(selected, amountNum)
  const net = amountNum - tax

  const add = async () => {
    if (!employeeId || amountNum <= 0 || !date) return
    const s = await load()
    s.dailyPayments.push({ id: uid(), employeeId, date, amount: amountNum })
    await save(s)
    setPayments(s.dailyPayments)
    setAmount('')
  }

  const del = async (id: string) => {
    if (!confirm('削除しますか?')) return
    const s = await load()
    s.dailyPayments = s.dailyPayments.filter(p => p.id !== id)
    await save(s)
    setPayments(s.dailyPayments)
  }

  const dayEntries = useMemo(
    () =>
      payments
        .filter(p => p.date === date)
        .sort((a, b) => a.id.localeCompare(b.id)),
    [payments, date],
  )

  const recent = useMemo(
    () =>
      [...payments]
        .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
        .slice(0, 30),
    [payments],
  )

  const empOf = (eid: string) => employees.find(e => e.id === eid)
  const nameOf = (eid: string) => empOf(eid)?.name || '(削除済)'

  const dayTotal = dayEntries.reduce(
    (acc, p) => {
      const t = calcTaxFor(empOf(p.employeeId), p.amount)
      acc.gross += p.amount
      acc.tax += t
      acc.net += p.amount - t
      return acc
    },
    { gross: 0, tax: 0, net: 0 },
  )

  return (
    <main className="p-4 max-w-md mx-auto">
      <Link href="/tax" className="text-sm text-blue-600">← 戻る</Link>
      <h1 className="text-lg font-bold my-3">毎日の給与・報酬の支払</h1>

      <div className="bg-white rounded-lg shadow p-3 mb-3 space-y-2">
        <label className="block">
          <span className="text-xs text-gray-500">日付</span>
          <input
            type="date"
            className="w-full border rounded px-2 py-1.5"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-xs text-gray-500">対象者</span>
          <select
            className="w-full border rounded px-2 py-1.5"
            value={employeeId}
            onChange={e => setEmployeeId(e.target.value)}
          >
            <option value="">選択してください</option>
            {employees.map(e => (
              <option key={e.id} value={e.id}>
                {e.name}（{e.kind === 'hostess' ? 'ホステス' : '乙欄'}）
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-gray-500">本日の支払額(円)</span>
          <input
            type="number"
            inputMode="numeric"
            className="w-full border rounded px-2 py-1.5"
            value={amount}
            onChange={e => setAmount(e.target.value)}
          />
        </label>

        {selected && amountNum > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded p-2 text-sm space-y-0.5">
            <div className="flex justify-between">
              <span>支払額(総額)</span>
              <b>{amountNum.toLocaleString()}円</b>
            </div>
            <div className="flex justify-between text-red-700">
              <span>
                源泉徴収税
                {selected.kind === 'hostess' ? '(ホステス10.21%)' : '(乙欄 月額表)'}
              </span>
              <b>−{tax.toLocaleString()}円</b>
            </div>
            <div className="flex justify-between text-green-800 border-t border-amber-300 pt-1 mt-1">
              <span>本人へ支払う金額</span>
              <b className="text-base">{net.toLocaleString()}円</b>
            </div>
          </div>
        )}

        <button
          onClick={() => void add()}
          className="w-full bg-blue-600 text-white rounded py-2 disabled:opacity-40"
          disabled={!employeeId || !amount}
        >
          記録する
        </button>
      </div>

      {employees.length === 0 && (
        <div className="bg-white rounded p-3 text-sm text-gray-500 text-center">
          従業員の登録がありません。
          <Link href="/tax/settings/employees" className="text-blue-600 underline ml-1">
            登録画面へ
          </Link>
        </div>
      )}

      <h2 className="text-sm font-semibold mt-4 mb-2">{date} の記録</h2>
      <ul className="space-y-2">
        {dayEntries.length === 0 && (
          <li className="text-xs text-gray-500 text-center py-3">この日の記録はありません</li>
        )}
        {dayEntries.map(p => {
          const emp = empOf(p.employeeId)
          const t = calcTaxFor(emp, p.amount)
          return (
            <li
              key={p.id}
              className="bg-white rounded shadow p-2 flex justify-between items-center text-sm"
            >
              <div>
                <div className="font-medium">
                  {nameOf(p.employeeId)}
                  <span className="text-xs text-gray-500 ml-1">
                    ({emp?.kind === 'hostess' ? 'ホステス' : '乙欄'})
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  総額 {p.amount.toLocaleString()} / 税 {t.toLocaleString()} / 手取{' '}
                  {(p.amount - t).toLocaleString()}
                </div>
              </div>
              <button onClick={() => void del(p.id)} className="text-red-600 text-xs">
                削除
              </button>
            </li>
          )
        })}
        {dayEntries.length > 0 && (
          <li className="bg-blue-50 rounded p-2 text-xs flex justify-between">
            <span>当日合計</span>
            <span>
              総額 {dayTotal.gross.toLocaleString()} / 税 {dayTotal.tax.toLocaleString()} / 手取{' '}
              {dayTotal.net.toLocaleString()}
            </span>
          </li>
        )}
      </ul>

      <h2 className="text-sm font-semibold mt-6 mb-2">最近の記録(直近30件)</h2>
      <ul className="space-y-1">
        {recent.map(p => (
          <li key={p.id} className="bg-white rounded p-2 text-xs flex justify-between">
            <span>
              {p.date} {nameOf(p.employeeId)}
            </span>
            <span>{p.amount.toLocaleString()}円</span>
          </li>
        ))}
      </ul>
    </main>
  )
}
