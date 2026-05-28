'use client'

import { useEffect, useMemo, useState } from 'react'
import { Employee, TaxAccountant, DailyPayment, load } from '@/lib/tax/storage'
import {
  calcHostessDailyTax,
  calcKoyoOtsuTax,
  calcZeirishiGross,
  calcZeirishiNet,
  calcZeirishiTax,
} from '@/lib/tax/calc'
import { csvBlob, downloadFile, toCsv } from '@/lib/tax/csv'
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

export default function ExportPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [accountants, setAccountants] = useState<TaxAccountant[]>([])
  const [payments, setPayments] = useState<DailyPayment[]>([])
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [bundling, setBundling] = useState(false)

  useEffect(() => {
    load().then(s => {
      setEmployees(s.employees)
      setAccountants(s.accountants)
      setPayments(s.dailyPayments)
    })
  }, [])

  const empOf = (id: string) => employees.find(e => e.id === id)
  const nameOf = (id: string) => empOf(id)?.name || ''

  const koyoCsv = useMemo(() => {
    const rows: (string | number)[][] = [
      ['日付', '氏名', '区分', '支給額', '源泉所得税', '差引支給額'],
    ]
    payments
      .filter(p => {
        const dt = new Date(p.date + 'T00:00:00')
        const emp = empOf(p.employeeId)
        return dt.getFullYear() === year && dt.getMonth() + 1 === month && emp?.kind === 'koyo_otsu'
      })
      .sort((a, b) => a.date.localeCompare(b.date))
      .forEach(p => {
        const tax = calcKoyoOtsuTax(p.amount)
        rows.push([p.date, nameOf(p.employeeId), '乙欄', p.amount, tax, p.amount - tax])
      })
    return toCsv(rows)
  }, [payments, employees, year, month])

  const hostessCsv = useMemo(() => {
    const rows: (string | number)[][] = [
      ['日付', '氏名', '支払額', '源泉所得税', '差引支払額'],
    ]
    payments
      .filter(p => {
        const dt = new Date(p.date + 'T00:00:00')
        const emp = empOf(p.employeeId)
        return dt.getFullYear() === year && dt.getMonth() + 1 === month && emp?.kind === 'hostess'
      })
      .sort((a, b) => a.date.localeCompare(b.date))
      .forEach(p => {
        const tax = calcHostessDailyTax(p.amount)
        rows.push([p.date, nameOf(p.employeeId), p.amount, tax, p.amount - tax])
      })
    return toCsv(rows)
  }, [payments, employees, year, month])

  const hostessMonthlyCsv = useMemo(() => {
    const map = new Map<string, { name: string; days: number; gross: number; tax: number }>()
    payments
      .filter(p => {
        const dt = new Date(p.date + 'T00:00:00')
        const emp = empOf(p.employeeId)
        return dt.getFullYear() === year && dt.getMonth() + 1 === month && emp?.kind === 'hostess'
      })
      .forEach(p => {
        const k = p.employeeId
        const cur = map.get(k) || { name: nameOf(p.employeeId), days: 0, gross: 0, tax: 0 }
        cur.days += 1
        cur.gross += p.amount
        cur.tax += calcHostessDailyTax(p.amount)
        map.set(k, cur)
      })
    const rows: (string | number)[][] = [
      ['年', '月', '氏名', '出勤日数', '支払額合計', '源泉所得税合計', '差引支払額合計'],
    ]
    map.forEach(v => rows.push([year, month, v.name, v.days, v.gross, v.tax, v.gross - v.tax]))
    return toCsv(rows)
  }, [payments, employees, year, month])

  const zeirishiCsv = useMemo(() => {
    const rows: (string | number)[][] = [
      ['年', '月', '氏名', '税抜報酬額', '税込支払額', '源泉所得税', '差引支払額'],
    ]
    accountants
      .filter(a => a.paymentMonths.includes(month))
      .forEach(a => {
        rows.push([
          year,
          month,
          a.name,
          a.amount,
          calcZeirishiGross(a.amount),
          calcZeirishiTax(a.amount),
          calcZeirishiNet(a.amount),
        ])
      })
    return toCsv(rows)
  }, [accountants, year, month])

  const ym = `${year}-${String(month).padStart(2, '0')}`
  const files = [
    { name: `給与台帳_乙欄_${ym}.csv`, csv: koyoCsv },
    { name: `ホステス支払台帳_日別_${ym}.csv`, csv: hostessCsv },
    { name: `ホステス支払台帳_月別集計_${ym}.csv`, csv: hostessMonthlyCsv },
    { name: `税理士台帳_${ym}.csv`, csv: zeirishiCsv },
  ]

  const dl = (name: string, csv: string) => downloadFile(csvBlob(csv), name)

  const downloadBundle = async () => {
    setBundling(true)
    try {
      const res = await fetch('/api/tax-export-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zipName: `税理士提出用ファイル_${ym}.zip`,
          files: files.map(f => ({ name: f.name, content: f.csv })),
        }),
      })
      if (!res.ok) {
        alert('ZIP作成に失敗しました')
        return
      }
      const blob = await res.blob()
      downloadFile(blob, `税理士提出用ファイル_${ym}.zip`)
    } finally {
      setBundling(false)
    }
  }

  return (
    <PageContainer>
      <BackLink href="/tax" />
      <PageTitle>CSV書き出し</PageTitle>

      <Card className="grid grid-cols-2 gap-3">
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
      </Card>

      <div className="mt-5">
        <PrimaryButton onClick={() => void downloadBundle()} disabled={bundling}>
          {bundling ? '作成中…' : '税理士提出用ファイルをまとめてダウンロード'}
        </PrimaryButton>
        <p className="text-[12px] text-gray-400 mt-2 px-1">
          4つのCSVを1つのZIPファイルにまとめます。
        </p>
      </div>

      <SectionLabel>個別にダウンロード</SectionLabel>
      <div className="bg-white rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.04] overflow-hidden divide-y divide-gray-100">
        {files.map(f => (
          <div key={f.name} className="flex justify-between items-center px-4 py-3.5">
            <div className="text-[14px] text-gray-900 truncate pr-2">{f.name}</div>
            <button
              onClick={() => dl(f.name, f.csv)}
              className="text-[14px] text-blue-500 font-medium active:text-blue-700 shrink-0"
            >
              ダウンロード
            </button>
          </div>
        ))}
      </div>
    </PageContainer>
  )
}
