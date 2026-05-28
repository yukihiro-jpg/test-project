'use client'

import { useEffect, useMemo, useState } from 'react'
import { Employee, TaxAccountant, DailyPayment, PayerInfo, load } from '@/lib/tax/storage'
import { calcDueDate, formatJpDate } from '@/lib/tax/calc'
import { aggregateMonth } from '@/lib/tax/aggregate'
import SlipKyuyo from '@/components/tax/SlipKyuyo'
import SlipHoshu from '@/components/tax/SlipHoshu'
import {
  BackLink,
  Card,
  Field,
  PageContainer,
  PageTitle,
  Select,
  TextInput,
} from '@/components/tax/ui'

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
    const lastDay = new Date(year, month, 0)
    return formatJpDate(calcDueDate(lastDay, payer.noukiTokurei))
  }, [year, month, payer])

  if (!payer) return null

  const kyuyoHonzei = aggregated.koyo.tax + aggregated.zeirishi.tax
  const hoshuHonzei = aggregated.hostess.tax

  return (
    <PageContainer wide>
      <BackLink href="/tax" />
      <PageTitle>納付書イメージ</PageTitle>

      <Card className="grid grid-cols-3 gap-3">
        <Field label="年">
          <TextInput
            type="number"
            value={year}
            onChange={e => setYear(parseInt(e.target.value) || year)}
          />
        </Field>
        <Field label="月">
          <Select value={month} onChange={e => setMonth(parseInt(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>
                {m}月
              </option>
            ))}
          </Select>
        </Field>
        <Field label="納付書種類">
          <Select value={type} onChange={e => setType(e.target.value as SlipType)}>
            <option value="kyuyo">給与所得(30203)</option>
            <option value="hoshu">報酬・料金等(32319)</option>
          </Select>
        </Field>
      </Card>

      <div className="mt-4 rounded-2xl bg-amber-50 ring-1 ring-amber-200/50 p-4">
        <div className="text-[13px] text-amber-700/80">納付期限</div>
        <div className="text-[18px] font-bold text-amber-900">{dueDateText}</div>
        <div className="text-[11px] text-amber-700/70 mt-0.5">
          {payer.noukiTokurei ? '※ 納期の特例による' : '※ 原則（翌月10日）。土日は翌平日に繰下げ'}
        </div>
      </div>

      <div className="mt-3 rounded-2xl bg-blue-50 p-4 text-[13px] space-y-1 tabular-nums">
        <div>
          給与所得 本税合計：<b className="text-[15px]">{kyuyoHonzei.toLocaleString()} 円</b>
          <span className="text-gray-500 ml-2">
            (乙欄{aggregated.koyo.people}人 + 税理士{aggregated.zeirishi.people}人)
          </span>
        </div>
        <div>
          報酬・料金 本税合計：<b className="text-[15px]">{hoshuHonzei.toLocaleString()} 円</b>
          <span className="text-gray-500 ml-2">(ホステス{aggregated.hostess.people}人)</span>
        </div>
      </div>

      <div className="mt-5 overflow-x-auto">
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

      <p className="text-[11px] text-gray-400 mt-4 leading-relaxed px-1">
        ※ この画面は紙の納付書に転記するためのイメージです。実際の納付書は税務署交付の用紙を使用してください。
        <br />
        ※ 乙欄の税額は月額表の電算機計算式に基づく概算です。
      </p>
    </PageContainer>
  )
}
