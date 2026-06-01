'use client'

import { useEffect, useMemo, useState } from 'react'
import { Employee, TaxAccountant, DailyPayment, PayerInfo, load } from '@/lib/tax/storage'
import { calcDueDate, formatJpDate } from '@/lib/tax/calc'
import { aggregateHalfYear, aggregateMonth } from '@/lib/tax/aggregate'
import SlipKyuyo from '@/components/tax/SlipKyuyo'
import SlipHoshu from '@/components/tax/SlipHoshu'
import { BackLink, Card, Field, PageContainer, PageTitle, Select, TextInput } from '@/components/tax/ui'

type SlipType = 'kyuyo' | 'hoshu'
type Period = 'monthly' | 'first-half' | 'second-half'

export default function SlipPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [accountants, setAccountants] = useState<TaxAccountant[]>([])
  const [payments, setPayments] = useState<DailyPayment[]>([])
  const [payer, setPayer] = useState<PayerInfo | null>(null)
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [period, setPeriod] = useState<Period>('monthly')
  const [type, setType] = useState<SlipType>('kyuyo')

  useEffect(() => {
    load().then(s => {
      setEmployees(s.employees)
      setAccountants(s.accountants)
      setPayments(s.dailyPayments)
      setPayer(s.payer)
      // 納期特例が有効なら半期モードを初期選択
      if (s.payer.noukiTokurei) {
        const curMonth = new Date().getMonth() + 1
        setPeriod(curMonth <= 6 ? 'first-half' : 'second-half')
      }
    })
  }, [])

  const reiwaYear = year - 2018

  const aggregated = useMemo(() => {
    if (period === 'monthly') {
      return aggregateMonth(year, month, employees, payments, accountants)
    }
    return aggregateHalfYear(
      year,
      period === 'first-half' ? 'first' : 'second',
      employees,
      payments,
      accountants,
    )
  }, [period, year, month, employees, payments, accountants])

  // 期間情報（納付書「自〜至」表示用）
  const periodMonths = useMemo(() => {
    if (period === 'monthly') return { from: month, to: undefined as number | undefined }
    if (period === 'first-half') return { from: 1, to: 6 }
    return { from: 7, to: 12 }
  }, [period, month])

  const dueDateText = useMemo(() => {
    if (!payer) return ''
    if (period === 'monthly') {
      const lastDay = new Date(year, month, 0)
      return formatJpDate(calcDueDate(lastDay, false))
    }
    // 納期特例
    if (period === 'first-half') {
      return formatJpDate(calcDueDate(new Date(year, 5, 15), true))
    }
    return formatJpDate(calcDueDate(new Date(year, 11, 15), true))
  }, [period, year, month, payer])

  if (!payer) return null

  const kyuyoHonzei = aggregated.koyo.tax + aggregated.zeirishi.tax
  const hoshuHonzei = aggregated.hostess.tax

  const noukiMonthStr = String(periodMonths.from).padStart(2, '0')
  const noukiMonthToStr = periodMonths.to != null ? String(periodMonths.to).padStart(2, '0') : undefined

  return (
    <PageContainer wide>
      <BackLink href="/tax" />
      <PageTitle>納付書イメージ</PageTitle>

      <Card className="space-y-3">
        {payer.noukiTokurei && (
          <Field label="納付区分">
            <Select value={period} onChange={e => setPeriod(e.target.value as Period)}>
              <option value="monthly">月次納付（毎月）</option>
              <option value="first-half">納期特例 上半期（1〜6月分）</option>
              <option value="second-half">納期特例 下半期（7〜12月分）</option>
            </Select>
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="年">
            <TextInput
              type="number"
              value={year}
              onChange={e => setYear(parseInt(e.target.value) || year)}
            />
          </Field>
          {period === 'monthly' ? (
            <Field label="月">
              <Select value={month} onChange={e => setMonth(parseInt(e.target.value))}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>
                    {m}月
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <Field label="対象期間">
              <div className="block w-full bg-gray-100 rounded-xl px-3.5 py-2.5 text-[16px] text-gray-700">
                {period === 'first-half' ? '1月〜6月' : '7月〜12月'}
              </div>
            </Field>
          )}
        </div>

        <Field label="納付書種類">
          <Select value={type} onChange={e => setType(e.target.value as SlipType)}>
            <option value="kyuyo">給与所得・退職所得等（30203）</option>
            <option value="hoshu">報酬・料金等（32319）</option>
          </Select>
        </Field>
      </Card>

      <div className="mt-4 rounded-2xl bg-amber-50 ring-1 ring-amber-200/50 p-4">
        <div className="text-[13px] text-amber-700/80">納付期限</div>
        <div className="text-[18px] font-bold text-amber-900">{dueDateText}</div>
        <div className="text-[11px] text-amber-700/70 mt-0.5">
          {period === 'monthly'
            ? '※ 原則（翌月10日）。土日は翌平日に繰下げ'
            : period === 'first-half'
            ? '※ 納期特例 上半期：原則7月10日'
            : '※ 納期特例 下半期：原則翌年1月20日'}
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
              noukiMonth: noukiMonthStr,
              noukiYearTo: String(reiwaYear),
              noukiMonthTo: noukiMonthToStr,
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
              noukiMonth: noukiMonthStr,
              noukiYearTo: String(reiwaYear),
              noukiMonthTo: noukiMonthToStr,
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
