'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  Employee,
  TaxAccountant,
  DailyPayment,
  load,
} from '@/lib/tax/storage'
import {
  calcHostessDailyTax,
  calcKoyoOtsuTax,
  calcZeirishiTax,
} from '@/lib/tax/calc'
import { csvBlob, downloadFile, toCsv } from '@/lib/tax/csv'

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

  // 1) 給与台帳（乙欄）日別
  const koyoCsv = useMemo(() => {
    const rows: (string | number)[][] = [
      ['日付', '氏名', '区分', '支給額', '源泉所得税', '差引支給額'],
    ]
    payments
      .filter(p => {
        const dt = new Date(p.date + 'T00:00:00')
        const emp = empOf(p.employeeId)
        return (
          dt.getFullYear() === year &&
          dt.getMonth() + 1 === month &&
          emp?.kind === 'koyo_otsu'
        )
      })
      .sort((a, b) => a.date.localeCompare(b.date))
      .forEach(p => {
        const tax = calcKoyoOtsuTax(p.amount)
        rows.push([p.date, nameOf(p.employeeId), '乙欄', p.amount, tax, p.amount - tax])
      })
    return toCsv(rows)
  }, [payments, employees, year, month])

  // 2) ホステス日別
  const hostessCsv = useMemo(() => {
    const rows: (string | number)[][] = [
      ['日付', '氏名', '支払額', '源泉所得税', '差引支払額'],
    ]
    payments
      .filter(p => {
        const dt = new Date(p.date + 'T00:00:00')
        const emp = empOf(p.employeeId)
        return (
          dt.getFullYear() === year &&
          dt.getMonth() + 1 === month &&
          emp?.kind === 'hostess'
        )
      })
      .sort((a, b) => a.date.localeCompare(b.date))
      .forEach(p => {
        const tax = calcHostessDailyTax(p.amount)
        rows.push([p.date, nameOf(p.employeeId), p.amount, tax, p.amount - tax])
      })
    return toCsv(rows)
  }, [payments, employees, year, month])

  // 3) ホステス月別集計
  const hostessMonthlyCsv = useMemo(() => {
    const map = new Map<string, { name: string; days: number; gross: number; tax: number }>()
    payments
      .filter(p => {
        const dt = new Date(p.date + 'T00:00:00')
        const emp = empOf(p.employeeId)
        return (
          dt.getFullYear() === year &&
          dt.getMonth() + 1 === month &&
          emp?.kind === 'hostess'
        )
      })
      .forEach(p => {
        const k = p.employeeId
        const cur = map.get(k) || {
          name: nameOf(p.employeeId),
          days: 0,
          gross: 0,
          tax: 0,
        }
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

  // 4) 税理士台帳
  const zeirishiCsv = useMemo(() => {
    const rows: (string | number)[][] = [
      ['年', '月', '氏名', '報酬額', '源泉所得税', '差引支払額'],
    ]
    accountants
      .filter(a => a.paymentMonths.includes(month))
      .forEach(a => {
        const tax = calcZeirishiTax(a.amount)
        rows.push([year, month, a.name, a.amount, tax, a.amount - tax])
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
    <main className="p-4 max-w-md mx-auto">
      <Link href="/tax" className="text-sm text-blue-600">← 戻る</Link>
      <h1 className="text-lg font-bold my-3">CSV書き出し（税理士へ送る）</h1>

      <div className="bg-white rounded-lg shadow p-3 mb-4 grid grid-cols-2 gap-2">
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
      </div>

      <button
        onClick={() => void downloadBundle()}
        disabled={bundling}
        className="w-full bg-blue-600 text-white rounded py-3 font-semibold mb-3 disabled:opacity-50"
      >
        {bundling ? '作成中…' : '税理士提出用ファイル をまとめてダウンロード'}
      </button>
      <p className="text-[10px] text-gray-500 mb-4">
        ※ 4つのCSVを1つのZIPファイルにまとめます。
      </p>

      <h2 className="text-sm font-semibold mb-2">個別にダウンロード</h2>
      <ul className="space-y-2">
        {files.map(f => (
          <li
            key={f.name}
            className="bg-white rounded shadow p-3 flex justify-between items-center"
          >
            <div className="text-sm">{f.name}</div>
            <button onClick={() => dl(f.name, f.csv)} className="text-sm text-blue-600">
              ダウンロード
            </button>
          </li>
        ))}
      </ul>
    </main>
  )
}
