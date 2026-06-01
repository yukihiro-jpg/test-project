'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { DailyPayment, Employee, load, save, uid } from '@/lib/tax/storage'
import { calcHostessDailyTax, calcKoyoOtsuTax } from '@/lib/tax/calc'
import {
  BackLink,
  Card,
  Field,
  PageContainer,
  PageTitle,
  PrimaryButton,
  SectionLabel,
  Select,
  TextInput,
} from '@/components/tax/ui'

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
    if (!confirm('削除しますか？')) return
    const s = await load()
    s.dailyPayments = s.dailyPayments.filter(p => p.id !== id)
    await save(s)
    setPayments(s.dailyPayments)
  }

  const dayEntries = useMemo(
    () => payments.filter(p => p.date === date).sort((a, b) => a.id.localeCompare(b.id)),
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
    <PageContainer>
      <BackLink href="/tax" />
      <PageTitle>毎日の給与・報酬の支払</PageTitle>

      <Card className="space-y-4">
        <Field label="日付">
          <TextInput type="date" value={date} onChange={e => setDate(e.target.value)} />
        </Field>
        <Field label="対象者">
          <Select value={employeeId} onChange={e => setEmployeeId(e.target.value)}>
            <option value="">選択してください</option>
            {employees.map(e => (
              <option key={e.id} value={e.id}>
                {e.name}
                {e.stageName ? `（${e.stageName}）` : ''} ／{e.kind === 'hostess' ? 'ホステス' : '乙欄'}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="本日の支払額（円）">
          <TextInput
            type="number"
            inputMode="numeric"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0"
          />
        </Field>

        {selected && amountNum > 0 && (
          <div className="rounded-2xl bg-blue-50 p-4 space-y-1.5 text-[14px]">
            <div className="flex justify-between">
              <span className="text-gray-700">支払額（総額）</span>
              <span className="font-semibold tabular-nums">{amountNum.toLocaleString()} 円</span>
            </div>
            <div className="flex justify-between text-red-600">
              <span>
                源泉徴収税
                <span className="text-[12px] text-red-500/80 ml-1">
                  {selected.kind === 'hostess' ? '(ホステス10.21%)' : '(乙欄 月額表)'}
                </span>
              </span>
              <span className="font-semibold tabular-nums">−{tax.toLocaleString()} 円</span>
            </div>
            <div className="flex justify-between pt-1.5 border-t border-blue-200">
              <span className="text-gray-900 font-semibold">本人へ支払う金額</span>
              <span className="font-bold text-[17px] tabular-nums text-green-700">
                {net.toLocaleString()} 円
              </span>
            </div>
          </div>
        )}

        <PrimaryButton onClick={() => void add()} disabled={!employeeId || !amount}>
          記録する
        </PrimaryButton>
      </Card>

      {employees.length === 0 && (
        <Card className="mt-4">
          <p className="text-[14px] text-gray-500 text-center">
            従業員の登録がありません。
            <Link href="/tax/settings/employees" className="text-blue-500 ml-1">
              登録画面へ
            </Link>
          </p>
        </Card>
      )}

      <SectionLabel>{date} の記録</SectionLabel>
      {dayEntries.length === 0 ? (
        <Card>
          <p className="text-[14px] text-gray-500 text-center py-2">この日の記録はありません</p>
        </Card>
      ) : (
        <>
          <div className="space-y-2">
            {dayEntries.map(p => {
              const emp = empOf(p.employeeId)
              const t = calcTaxFor(emp, p.amount)
              return (
                <Card key={p.id}>
                  <div className="flex justify-between items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-[15px] font-semibold text-gray-900">
                        {nameOf(p.employeeId)}
                        {emp?.stageName && (
                          <span className="text-[13px] text-pink-600 ml-1.5 font-medium">
                            （{emp.stageName}）
                          </span>
                        )}
                        <span className="text-[12px] text-gray-500 ml-1.5 font-normal">
                          {emp?.kind === 'hostess' ? 'ホステス' : '乙欄'}
                        </span>
                      </div>
                      <div className="text-[12px] text-gray-500 mt-0.5 tabular-nums">
                        総額 {p.amount.toLocaleString()} ／ 税 {t.toLocaleString()} ／ 手取{' '}
                        {(p.amount - t).toLocaleString()}
                      </div>
                    </div>
                    <button
                      onClick={() => void del(p.id)}
                      className="text-[13px] text-red-500 active:text-red-700 px-2 py-1 shrink-0"
                    >
                      削除
                    </button>
                  </div>
                </Card>
              )
            })}
          </div>
          <div className="mt-3 rounded-2xl bg-blue-50 px-4 py-3 text-[13px] flex justify-between">
            <span className="text-gray-700">当日合計</span>
            <span className="tabular-nums">
              総額 <b>{dayTotal.gross.toLocaleString()}</b> ／ 税{' '}
              <b>{dayTotal.tax.toLocaleString()}</b> ／ 手取{' '}
              <b>{dayTotal.net.toLocaleString()}</b>
            </span>
          </div>
        </>
      )}

      <SectionLabel>最近の記録（直近30件）</SectionLabel>
      {recent.length === 0 ? (
        <Card>
          <p className="text-[14px] text-gray-500 text-center py-2">まだ記録がありません</p>
        </Card>
      ) : (
        <div className="bg-white rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.04] overflow-hidden divide-y divide-gray-100">
          {recent.map(p => {
            const emp = empOf(p.employeeId)
            return (
              <div key={p.id} className="flex justify-between items-center px-4 py-2.5 text-[14px]">
                <span className="text-gray-700">
                  {p.date}　{nameOf(p.employeeId)}
                  {emp?.stageName && (
                    <span className="text-pink-600 ml-1">（{emp.stageName}）</span>
                  )}
                </span>
                <span className="tabular-nums font-medium">{p.amount.toLocaleString()} 円</span>
              </div>
            )
          })}
        </div>
      )}
    </PageContainer>
  )
}
