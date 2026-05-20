'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Employee, PayerInfo, PayrollEntry, load } from '@/lib/tax/storage'
import { calcHostessTax, calcKoyoOtsuTax } from '@/lib/tax/calc'
import SlipKyuyo from '@/components/tax/SlipKyuyo'
import SlipHoshu from '@/components/tax/SlipHoshu'

type SlipType = 'kyuyo' | 'hoshu'

export default function SlipPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [payroll, setPayroll] = useState<PayrollEntry[]>([])
  const [payer, setPayer] = useState<PayerInfo | null>(null)
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [type, setType] = useState<SlipType>('kyuyo')

  useEffect(() => {
    const s = load()
    setEmployees(s.employees)
    setPayroll(s.payroll)
    setPayer(s.payer)
  }, [])

  const reiwaYear = year - 2018 // 令和元年 = 2019

  const aggregated = useMemo(() => {
    const monthly = payroll.filter(p => p.year === year && p.month === month)
    const result = {
      koyo: { people: 0, amount: 0, tax: 0 },
      hostess: { people: 0, amount: 0, tax: 0 },
    }
    monthly.forEach(p => {
      const emp = employees.find(e => e.id === p.employeeId)
      if (!emp) return
      const auto = emp.kind === 'hostess'
        ? calcHostessTax(p.amount, p.days || 0)
        : calcKoyoOtsuTax(Math.max(0, p.amount - (p.socialInsurance || 0)))
      const tax = p.manualTaxOverride != null ? p.manualTaxOverride : auto
      if (emp.kind === 'hostess') {
        result.hostess.people += 1
        result.hostess.amount += p.amount
        result.hostess.tax += tax
      } else {
        result.koyo.people += 1
        result.koyo.amount += p.amount
        result.koyo.tax += tax
      }
    })
    return result
  }, [payroll, employees, year, month])

  if (!payer) return null

  return (
    <main className="p-4 max-w-5xl mx-auto">
      <Link href="/tax" className="text-sm text-blue-600">← 戻る</Link>
      <h1 className="text-lg font-bold my-3">納付書イメージ</h1>

      <div className="bg-white rounded-lg shadow p-3 mb-4 grid grid-cols-3 gap-2">
        <label>
          <span className="text-xs text-gray-500">年</span>
          <input type="number" className="w-full border rounded px-2 py-1.5"
            value={year} onChange={e => setYear(parseInt(e.target.value) || year)} />
        </label>
        <label>
          <span className="text-xs text-gray-500">月</span>
          <select className="w-full border rounded px-2 py-1.5"
            value={month} onChange={e => setMonth(parseInt(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>{m}月</option>
            ))}
          </select>
        </label>
        <label>
          <span className="text-xs text-gray-500">納付書種類</span>
          <select className="w-full border rounded px-2 py-1.5"
            value={type} onChange={e => setType(e.target.value as SlipType)}>
            <option value="kyuyo">給与所得（30203）</option>
            <option value="hoshu">報酬・料金等（32319）</option>
          </select>
        </label>
      </div>

      <div className="bg-blue-50 rounded p-2 mb-3 text-xs">
        <div>給与所得 本税合計: <b>{aggregated.koyo.tax.toLocaleString()}円</b>（{aggregated.koyo.people}人 / 支給額 {aggregated.koyo.amount.toLocaleString()}円）</div>
        <div>報酬・料金 本税合計: <b>{aggregated.hostess.tax.toLocaleString()}円</b>（{aggregated.hostess.people}人 / 支払額 {aggregated.hostess.amount.toLocaleString()}円）</div>
      </div>

      <div className="overflow-x-auto">
        {type === 'kyuyo' ? (
          <SlipKyuyo data={{
            reiwaYear: String(reiwaYear),
            taxOffice: payer.taxOffice,
            taxOfficeNumber: payer.taxOfficeNumber,
            seiriNumber: payer.seiriNumber,
            payerNumber: payer.payerNumber,
            noukiYear: String(reiwaYear),
            noukiMonth: String(month).padStart(2, '0'),
            address: payer.address,
            name: payer.name,
            phone: payer.phone,
            houkyu: aggregated.koyo,
            shoyo: { people: 0, amount: 0, tax: 0 },
            hiyatoi: { people: 0, amount: 0, tax: 0 },
            yakuin: { people: 0, amount: 0, tax: 0 },
            zeirishi: { people: 0, amount: 0, tax: 0 },
            taishokuTax: 0,
            nenchoFusoku: 0,
            nenchoChoka: 0,
            honzei: aggregated.koyo.tax,
            entaizei: 0,
            goukei: aggregated.koyo.tax,
            tekiyou: '',
          }} />
        ) : (
          <SlipHoshu data={{
            reiwaYear: String(reiwaYear),
            taxOffice: payer.taxOffice,
            taxOfficeNumber: payer.taxOfficeNumber,
            seiriNumber: payer.seiriNumber,
            payerNumber: payer.payerNumber,
            noukiYear: String(reiwaYear),
            noukiMonth: String(month).padStart(2, '0'),
            address: payer.address,
            name: payer.name,
            phone: payer.phone,
            rows: [{
              code: '08',
              people: aggregated.hostess.people,
              amount: aggregated.hostess.amount,
              tax: aggregated.hostess.tax,
            }],
            honzei: aggregated.hostess.tax,
            entaizei: 0,
            goukei: aggregated.hostess.tax,
            ateSaki: payer.taxOffice ? `${payer.taxOffice}税務署` : '',
            tekiyou: '',
          }} />
        )}
      </div>

      <p className="text-[10px] text-gray-500 mt-3 leading-relaxed">
        ※ この画面は紙の納付書に転記するためのイメージです。実際の納付書は税務署交付の用紙を使用してください。<br/>
        ※ 乙欄の税額は月額表の電算機計算式に基づく概算です。月額表でのご確認をおすすめします。
      </p>
    </main>
  )
}
