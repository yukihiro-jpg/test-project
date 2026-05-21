'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Employee, HostessDailyEntry, PayrollEntry, load } from '@/lib/tax/storage'
import { calcHostessDailyTax, calcKoyoOtsuTax, calcZeirishiTax } from '@/lib/tax/calc'
import { csvBlob, downloadFile, shareFiles, toCsv } from '@/lib/tax/csv'

export default function ExportPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [payroll, setPayroll] = useState<PayrollEntry[]>([])
  const [daily, setDaily] = useState<HostessDailyEntry[]>([])
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  useEffect(() => {
    load().then(s => {
      setEmployees(s.employees)
      setPayroll(s.payroll)
      setDaily(s.hostessDaily)
    })
  }, [])

  const nameOf = (id: string) => employees.find(e => e.id === id)?.name || ''
  const kindOf = (id: string) => employees.find(e => e.id === id)?.kind

  // 1) 給与台帳（一般従業員・乙欄）
  const kyuyoCsv = useMemo(() => {
    const rows: (string | number)[][] = [
      ['年', '月', '氏名', '区分', '支給額', '社会保険料', '源泉所得税', '差引支給額'],
    ]
    payroll
      .filter(p => p.year === year && p.month === month && kindOf(p.employeeId) === 'koyo_otsu')
      .forEach(p => {
        const auto = calcKoyoOtsuTax(Math.max(0, p.amount - (p.socialInsurance || 0)))
        const tax = p.manualTaxOverride != null ? p.manualTaxOverride : auto
        rows.push([year, month, nameOf(p.employeeId), '一般従業員(乙欄)', p.amount, p.socialInsurance || 0, tax, p.amount - (p.socialInsurance || 0) - tax])
      })
    return toCsv(rows)
  }, [payroll, employees, year, month])

  // 2) ホステス支払台帳（日別）
  const hostessCsv = useMemo(() => {
    const rows: (string | number)[][] = [
      ['日付', '氏名', '支払額', '源泉所得税', '差引支払額'],
    ]
    daily
      .filter(d => {
        const dt = new Date(d.date + 'T00:00:00')
        return dt.getFullYear() === year && dt.getMonth() + 1 === month
      })
      .sort((a, b) => a.date.localeCompare(b.date))
      .forEach(d => {
        const tax = calcHostessDailyTax(d.amount)
        rows.push([d.date, nameOf(d.employeeId), d.amount, tax, d.amount - tax])
      })
    return toCsv(rows)
  }, [daily, employees, year, month])

  // 3) ホステス月別集計
  const hostessMonthlyCsv = useMemo(() => {
    const map = new Map<string, { name: string; days: number; gross: number; tax: number }>()
    daily
      .filter(d => {
        const dt = new Date(d.date + 'T00:00:00')
        return dt.getFullYear() === year && dt.getMonth() + 1 === month
      })
      .forEach(d => {
        const k = d.employeeId
        const cur = map.get(k) || { name: nameOf(d.employeeId), days: 0, gross: 0, tax: 0 }
        cur.days += 1
        cur.gross += d.amount
        cur.tax += calcHostessDailyTax(d.amount)
        map.set(k, cur)
      })
    const rows: (string | number)[][] = [['年', '月', '氏名', '出勤日数', '支払額合計', '源泉所得税合計', '差引支払額合計']]
    map.forEach(v => rows.push([year, month, v.name, v.days, v.gross, v.tax, v.gross - v.tax]))
    return toCsv(rows)
  }, [daily, employees, year, month])

  // 4) 税理士台帳
  const zeirishiCsv = useMemo(() => {
    const rows: (string | number)[][] = [
      ['年', '月', '氏名', '月額顧問料', 'スポット報酬', '源泉所得税', '差引支払額'],
    ]
    payroll
      .filter(p => p.year === year && p.month === month && kindOf(p.employeeId) === 'zeirishi')
      .forEach(p => {
        const auto = calcZeirishiTax(p.amount) + calcZeirishiTax(p.spotAmount || 0)
        const tax = p.manualTaxOverride != null ? p.manualTaxOverride : auto
        rows.push([year, month, nameOf(p.employeeId), p.amount, p.spotAmount || 0, tax, p.amount + (p.spotAmount || 0) - tax])
      })
    return toCsv(rows)
  }, [payroll, employees, year, month])

  const ym = `${year}-${String(month).padStart(2, '0')}`
  const files = [
    { name: `給与台帳_${ym}.csv`, csv: kyuyoCsv },
    { name: `ホステス支払台帳_日別_${ym}.csv`, csv: hostessCsv },
    { name: `ホステス支払台帳_月別集計_${ym}.csv`, csv: hostessMonthlyCsv },
    { name: `税理士台帳_${ym}.csv`, csv: zeirishiCsv },
  ]

  const dl = (name: string, csv: string) => downloadFile(csvBlob(csv), name)

  const shareAll = async () => {
    const fs = files.map(f => new File([csvBlob(f.csv)], f.name, { type: 'text/csv' }))
    const ok = await shareFiles(fs, `源泉台帳 ${ym}`)
    if (!ok) {
      // フォールバック：全部ダウンロード
      files.forEach(f => dl(f.name, f.csv))
      alert('共有機能が使えないため、ダウンロードしました。ダウンロードしたファイルを税理士に送ってください。')
    }
  }

  return (
    <main className="p-4 max-w-md mx-auto">
      <Link href="/tax" className="text-sm text-blue-600">← 戻る</Link>
      <h1 className="text-lg font-bold my-3">CSV書き出し（税理士へ送る）</h1>

      <div className="bg-white rounded-lg shadow p-3 mb-4 grid grid-cols-2 gap-2">
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
      </div>

      <button onClick={shareAll}
        className="w-full bg-blue-600 text-white rounded py-3 font-semibold mb-3">
        税理士へまとめて送る
      </button>
      <p className="text-[10px] text-gray-500 mb-4">
        ※ スマホの共有メニューが開きます。LINE・メール等のアプリを選んで送信できます。<br/>
        ※ 共有に対応していない端末ではダウンロードに切り替わります。
      </p>

      <h2 className="text-sm font-semibold mb-2">個別にダウンロード</h2>
      <ul className="space-y-2">
        {files.map(f => (
          <li key={f.name} className="bg-white rounded shadow p-3 flex justify-between items-center">
            <div className="text-sm">{f.name}</div>
            <button onClick={() => dl(f.name, f.csv)} className="text-sm text-blue-600">ダウンロード</button>
          </li>
        ))}
      </ul>
    </main>
  )
}
