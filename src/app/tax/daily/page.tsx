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
  SecondaryButton,
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
  const [editId, setEditId] = useState<string | null>(null)

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

  const reset = () => {
    setDate(today)
    setEmployeeId('')
    setAmount('')
    setEditId(null)
  }

  const submit = async () => {
    if (!employeeId || amountNum <= 0 || !date) return
    const s = await load()
    if (editId) {
      const idx = s.dailyPayments.findIndex(p => p.id === editId)
      if (idx >= 0) {
        s.dailyPayments[idx] = { ...s.dailyPayments[idx], employeeId, date, amount: amountNum }
      }
    } else {
      s.dailyPayments.push({ id: uid(), employeeId, date, amount: amountNum })
    }
    await save(s)
    setPayments(s.dailyPayments)
    reset()
  }

  const startEdit = (p: DailyPayment) => {
    setEditId(p.id)
    setDate(p.date)
    setEmployeeId(p.employeeId)
    setAmount(String(p.amount))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const del = async (id: string) => {
    if (!confirm('削除しますか？')) return
    const s = await load()
    s.dailyPayments = s.dailyPayments.filter(p => p.id !== id)
    await save(s)
    setPayments(s.dailyPayments)
    if (editId === id) reset()
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
        {editId && (
          <div className="rounded-xl bg-amber-50 ring-1 ring-amber-200/60 px-3 py-2 text-[13px] text-amber-900">
            ✏️ 既存の記録を編集中です
          </div>
        )}

        <Field label="日付">
          <TextInput type="date" value={date} onChange={e => setDate(e.target.value)} />
        </Field>
        <Field label="対象者">
          <Select value={employeeId} onChange={e => setEmployeeId(e.target.value)}>
            <option value="">選択してください</option>
            {employees.map(e => {
              const label = e.stageName
                ? `${e.name}（源氏名：${e.stageName}）／${e.kind === 'hostess' ? 'ホステス' : '乙欄'}`
                : `${e.name}／${e.kind === 'hostess' ? 'ホステス' : '乙欄'}`
              return (
                <option key={e.id} value={e.id}>
                  {label}
                </option>
              )
            })}
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

        <div className="flex gap-2">
          <PrimaryButton onClick={() => void submit()} disabled={!employeeId || !amount}>
            {editId ? '更新する' : '記録する'}
          </PrimaryButton>
          {editId && (
            <SecondaryButton onClick={reset} className="shrink-0">
              キャンセル
            </SecondaryButton>
          )}
        </div>
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
              const isEditing = editId === p.id
              return (
                <Card key={p.id} className={isEditing ? 'ring-2 ring-blue-400' : ''}>
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
                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        onClick={() => startEdit(p)}
                        className="text-[13px] text-blue-500 active:text-blue-700 px-2 py-0.5"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => void del(p.id)}
                        className="text-[13px] text-red-500 active:text-red-700 px-2 py-0.5"
                      >
                        削除
                      </button>
                    </div>
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

      <SectionLabel>最近の記録（直近30件・タップで編集）</SectionLabel>
      {recent.length === 0 ? (
        <Card>
          <p className="text-[14px] text-gray-500 text-center py-2">まだ記録がありません</p>
        </Card>
      ) : (
        <div className="bg-white rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.04] overflow-hidden divide-y divide-gray-100">
          {recent.map(p => {
            const emp = empOf(p.employeeId)
            const isEditing = editId === p.id
            return (
              <button
                key={p.id}
                onClick={() => startEdit(p)}
                className={`w-full flex justify-between items-center px-4 py-2.5 text-[14px] text-left active:bg-gray-50 ${
                  isEditing ? 'bg-blue-50' : ''
                }`}
              >
                <span className="text-gray-700">
                  {p.date}　{nameOf(p.employeeId)}
                  {emp?.stageName && (
                    <span className="text-pink-600 ml-1">（{emp.stageName}）</span>
                  )}
                </span>
                <span className="tabular-nums font-medium">{p.amount.toLocaleString()} 円</span>
              </button>
            )
          })}
        </div>
      )}
    </PageContainer>
  )
}
