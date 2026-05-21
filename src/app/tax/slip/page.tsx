'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Employee, HostessDailyEntry, PayerInfo, PayrollEntry, load, ymKey } from '@/lib/tax/storage'
import { calcHostessDailyTax, calcKoyoOtsuTax, calcZeirishiTax, calcDueDate, formatJpDate } from '@/lib/tax/calc'
import SlipKyuyo from '@/components/tax/SlipKyuyo'
import SlipHoshu from '@/components/tax/SlipHoshu'

type SlipType = 'kyuyo' | 'hoshu'

export default function SlipPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [payroll, setPayroll] = useState<PayrollEntry[]>([])
  const [daily, setDaily] = useState<HostessDailyEntry[]>([])
  const [payer, setPayer] = useState<PayerInfo | null>(null)
  const [paymentDate, setPaymentDate] = useState('')
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [type, setType] = useState<SlipType>('kyuyo')

  useEffect(() => {
    const s = load()
    setEmployees(s.employees)
    setPayroll(s.payroll)
    setDaily(s.hostessDaily)
    setPayer(s.payer)
  }, [])

  useEffect(() => {
    const s = load()
    setPaymentDate(s.paymentDates[ymKey(year, month)] || '')
  }, [year, month])

  const reiwaYear = year - 2018

  const aggregated = useMemo(() => {
    const monthly = payroll.filter(p => p.year === year && p.month === month)
    const result = {
      koyo: { people: 0, amount: 0, tax: 0 },
      hostess: { people: 0, amount: 0, tax: 0 },
      zeirishi: { people: 0, amount: 0, tax: 0 },
    }
    monthly.forEach(p => {
      const emp = employees.find(e => e.id === p.employeeId)
      if (!emp) return
      let auto = 0
      if (emp.kind === 'zeirishi') auto = calcZeirishiTax(p.amount) + calcZeirishiTax(p.spotAmount || 0)
      else if (emp.kind === 'koyo_otsu') auto = calcKoyoOtsuTax(Math.max(0, p.amount - (p.socialInsurance || 0)))
      const tax = p.manualTaxOverride != null ? p.manualTaxOverride : auto
      if (emp.kind === 'zeirishi') {
        result.zeirishi.people += 1
        result.zeirishi.amount += p.amount + (p.spotAmount || 0)
        result.zeirishi.tax += tax
      } else if (emp.kind === 'koyo_otsu') {
        result.koyo.people += 1
        result.koyo.amount += p.amount
        result.koyo.tax += tax
      }
    })
    // ホステスは日別データから集計（人員は当月に支払のあった人の延べ人数ではなく実人数）
    const hostessIds = new Set<string>()
    daily.forEach(d => {
      const dt = new Date(d.date + 'T00:00:00')
      if (dt.getFullYear() !== year || dt.getMonth() + 1 !== month) return
      hostessIds.add(d.employeeId)
      result.hostess.amount += d.amount
      result.hostess.tax += calcHostessDailyTax(d.amount)
    })
    result.hostess.people = hostessIds.size
    return result
  }, [payroll, daily, employees, year, month])

  const dueDateText = useMemo(() => {
    if (!paymentDate || !payer) return ''
    const d = new Date(paymentDate + 'T00:00:00')
    if (isNaN(d.getTime())) return ''
    return formatJpDate(calcDueDate(d, payer.noukiTokurei))
  }, [paymentDate, payer])

  if (!payer) return null

  const kyuyoHonzei = aggregated.koyo.tax + aggregated.zeirishi.tax
  const hoshuHonzei = aggregated.hostess.tax

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
            <option value="kyuyo">給与所得(30203)</option>
            <option value="hoshu">報酬・料金等(32319)</option>
          </select>
        </label>
      </div>

      {paymentDate && (
        <div className="bg-amber-50 border border-amber-200 rounded p-3 mb-3 text-sm">
          <div className="text-xs text-gray-600">給与支給日: {paymentDate}</div>
          <div className="font-bold text-amber-800">納付期限: {dueDateText}</div>
          <div className="text-[10px] text-gray-500 mt-0.5">
            {payer.noukiTokurei ? '※ 納期の特例による' : '※ 原則(翌月10日)。土日は翌平日に繰下げ'}
          </div>
        </div>
      )}
      {!paymentDate && (
        <div className="bg-gray-50 border border-gray-200 rounded p-2 mb-3 text-xs text-gray-600">
          給与支給日が未入力です。
          <Link href="/tax/payroll" className="text-blue-600 underline ml-1">給与入力画面</Link>で登録してください。
        </div>
      )}

      <div className="bg-blue-50 rounded p-2 mb-3 text-xs">
        <div>給与所得 本税合計: <b>{kyuyoHonzei.toLocaleString()}円</b>(乙欄{aggregated.koyo.people}人 + 税理士{aggregated.zeirishi.people}人)</div>
        <div>報酬・料金 本税合計: <b>{hoshuHonzei.toLocaleString()}円</b>(ホステス{aggregated.hostess.people}人)</div>
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
            zeirishi: aggregated.zeirishi,
            taishokuTax: 0,
            nenchoFusoku: 0,
            nenchoChoka: 0,
            honzei: kyuyoHonzei,
            entaizei: 0,
            goukei: kyuyoHonzei,
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
            honzei: hoshuHonzei,
            entaizei: 0,
            goukei: hoshuHonzei,
            ateSaki: payer.taxOffice ? `${payer.taxOffice}税務署` : '',
            tekiyou: '',
          }} />
        )}
      </div>

      <p className="text-[10px] text-gray-500 mt-3 leading-relaxed">
        ※ この画面は紙の納付書に転記するためのイメージです。実際の納付書は税務署交付の用紙を使用してください。<br/>
        ※ 乙欄の税額は月額表の電算機計算式に基づく概算です。
      </p>
    </main>
  )
}
