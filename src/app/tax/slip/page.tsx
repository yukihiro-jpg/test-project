'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Employee, TaxAccountant, DailyPayment, PayerInfo, load } from '@/lib/tax/storage'
import { calcDueDate, formatJpDate } from '@/lib/tax/calc'
import { aggregateMonth } from '@/lib/tax/aggregate'
import SlipKyuyo from '@/components/tax/SlipKyuyo'
import SlipHoshu from '@/components/tax/SlipHoshu'

type SlipType = 'kyuyo' | 'hoshu'

export default function SlipPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [accountants, setAccountants] = useState<TaxAccountant[]>([])
  const [payments, setPayments] = useState<DailyPayment[]>([])
  const [payer, setPayer] = useState<PayerInfo | null>(null)
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [type, setType] = useState<SlipType>('kyuyo')

  useEffect(() => {
    load().then(s => {
      setEmployees(s.employees)
      setAccountants(s.accountants)
      setPayments(s.dailyPayments)
      setPayer(s.payer)
    })
  }, [])

  const reiwaYear = year - 2018

  const aggregated = useMemo(
    () => aggregateMonth(year, month, employees, payments, accountants),
    [year, month, employees, payments, accountants],
  )

  const dueDateText = useMemo(() => {
    if (!payer) return ''
    // 月末日を基準に納付期限を算出（毎日支給のため）
    const lastDay = new Date(year, month, 0)
    return formatJpDate(calcDueDate(lastDay, payer.noukiTokurei))
  }, [year, month, payer])

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
          <input
            type="number"
            className="w-full border rounded px-2 py-1.5"
            value={year}
            onChange={e => setYear(parseInt(e.target.value) || year)}
          />
        </label>
        <label>
          <span className="text-xs text-gray-500">月</span>
          <select
            className="w-full border rounded px-2 py-1.5"
            value={month}
            onChange={e => setMonth(parseInt(e.target.value))}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>{m}月</option>
            ))}
          </select>
        </label>
        <label>
          <span className="text-xs text-gray-500">納付書種類</span>
          <select
            className="w-full border rounded px-2 py-1.5"
            value={type}
            onChange={e => setType(e.target.value as SlipType)}
          >
            <option value="kyuyo">給与所得(30203)</option>
            <option value="hoshu">報酬・料金等(32319)</option>
          </select>
        </label>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded p-3 mb-3 text-sm">
        <div className="font-bold text-amber-800">納付期限: {dueDateText}</div>
        <div className="text-[10px] text-gray-500 mt-0.5">
          {payer.noukiTokurei ? '※ 納期の特例による' : '※ 原則(翌月10日)。土日は翌平日に繰下げ'}
        </div>
      </div>

      <div className="bg-blue-50 rounded p-2 mb-3 text-xs">
        <div>
          給与所得 本税合計: <b>{kyuyoHonzei.toLocaleString()}円</b>
          (乙欄{aggregated.koyo.people}人 + 税理士{aggregated.zeirishi.people}人)
        </div>
        <div>
          報酬・料金 本税合計: <b>{hoshuHonzei.toLocaleString()}円</b>
          (ホステス{aggregated.hostess.people}人)
        </div>
      </div>

      <div className="overflow-x-auto">
        {type === 'kyuyo' ? (
          <SlipKyuyo
            data={{
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
            }}
          />
        ) : (
          <SlipHoshu
            data={{
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
              rows: [
                {
                  code: '08',
                  people: aggregated.hostess.people,
                  amount: aggregated.hostess.amount,
                  tax: aggregated.hostess.tax,
                },
              ],
              honzei: hoshuHonzei,
              entaizei: 0,
              goukei: hoshuHonzei,
              ateSaki: payer.taxOffice ? `${payer.taxOffice}税務署` : '',
              tekiyou: '',
            }}
          />
        )}
      </div>

      <p className="text-[10px] text-gray-500 mt-3 leading-relaxed">
        ※ この画面は紙の納付書に転記するためのイメージです。実際の納付書は税務署交付の用紙を使用してください。
        <br />
        ※ 乙欄の税額は月額表の電算機計算式に基づく概算です。
      </p>
    </main>
  )
}
