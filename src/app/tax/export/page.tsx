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
import { csvBlob, downloadFile, shareFiles, toCsv } from '@/lib/tax/csv'
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

type ExportFile = { name: string; csv: string }

function ym(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`
}

function monthsBetween(
  startY: number,
  startM: number,
  endY: number,
  endM: number,
): Array<{ year: number; month: number }> {
  const result: Array<{ year: number; month: number }> = []
  let y = startY
  let m = startM
  // 最大36ヶ月で打ち切り（誤入力対策）
  for (let i = 0; i < 36; i++) {
    result.push({ year: y, month: m })
    if (y === endY && m === endM) break
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  return result
}

function buildMonthFiles(
  year: number,
  month: number,
  employees: Employee[],
  accountants: TaxAccountant[],
  payments: DailyPayment[],
): ExportFile[] {
  const empOf = (id: string) => employees.find(e => e.id === id)
  const nameOf = (id: string) => empOf(id)?.name || ''
  const stageOf = (id: string) => empOf(id)?.stageName || ''
  const flagOf = (id: string) => (empOf(id)?.reportable === false ? '対象外' : '対象')
  const tag = ym(year, month)

  const isInMonth = (p: DailyPayment) => {
    const dt = new Date(p.date + 'T00:00:00')
    return dt.getFullYear() === year && dt.getMonth() + 1 === month
  }

  // 乙欄 日別
  const koyoRows: (string | number)[][] = [
    ['日付', '氏名', '源氏名（備考）', '区分', '支給額', '源泉所得税', '差引支給額', '税務署報告'],
  ]
  payments
    .filter(p => isInMonth(p) && empOf(p.employeeId)?.kind === 'koyo_otsu')
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach(p => {
      const tax = calcKoyoOtsuTax(p.amount)
      koyoRows.push([
        p.date, nameOf(p.employeeId), stageOf(p.employeeId), '乙欄',
        p.amount, tax, p.amount - tax, flagOf(p.employeeId),
      ])
    })

  // 乙欄 月別集計
  const koyoMap = new Map<string, { name: string; stage: string; flag: string; days: number; gross: number; tax: number }>()
  payments
    .filter(p => isInMonth(p) && empOf(p.employeeId)?.kind === 'koyo_otsu')
    .forEach(p => {
      const k = p.employeeId
      const cur = koyoMap.get(k) || {
        name: nameOf(p.employeeId), stage: stageOf(p.employeeId), flag: flagOf(p.employeeId),
        days: 0, gross: 0, tax: 0,
      }
      cur.days += 1
      cur.gross += p.amount
      cur.tax += calcKoyoOtsuTax(p.amount)
      koyoMap.set(k, cur)
    })
  const koyoMonthlyRows: (string | number)[][] = [
    ['年', '月', '氏名', '源氏名（備考）', '出勤日数', '支給額合計', '源泉所得税合計', '差引支給額合計', '税務署報告'],
  ]
  koyoMap.forEach(v =>
    koyoMonthlyRows.push([year, month, v.name, v.stage, v.days, v.gross, v.tax, v.gross - v.tax, v.flag]),
  )

  // ホステス 日別
  const hostessRows: (string | number)[][] = [
    ['日付', '氏名', '源氏名（備考）', '支払額', '源泉所得税', '差引支払額', '税務署報告'],
  ]
  payments
    .filter(p => isInMonth(p) && empOf(p.employeeId)?.kind === 'hostess')
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach(p => {
      const tax = calcHostessDailyTax(p.amount)
      hostessRows.push([
        p.date, nameOf(p.employeeId), stageOf(p.employeeId),
        p.amount, tax, p.amount - tax, flagOf(p.employeeId),
      ])
    })

  // ホステス 月別集計
  const hostessMap = new Map<string, { name: string; stage: string; flag: string; days: number; gross: number; tax: number }>()
  payments
    .filter(p => isInMonth(p) && empOf(p.employeeId)?.kind === 'hostess')
    .forEach(p => {
      const k = p.employeeId
      const cur = hostessMap.get(k) || {
        name: nameOf(p.employeeId), stage: stageOf(p.employeeId), flag: flagOf(p.employeeId),
        days: 0, gross: 0, tax: 0,
      }
      cur.days += 1
      cur.gross += p.amount
      cur.tax += calcHostessDailyTax(p.amount)
      hostessMap.set(k, cur)
    })
  const hostessMonthlyRows: (string | number)[][] = [
    ['年', '月', '氏名', '源氏名（備考）', '出勤日数', '支払額合計', '源泉所得税合計', '差引支払額合計', '税務署報告'],
  ]
  hostessMap.forEach(v =>
    hostessMonthlyRows.push([year, month, v.name, v.stage, v.days, v.gross, v.tax, v.gross - v.tax, v.flag]),
  )

  // 税理士
  const zeirishiRows: (string | number)[][] = [
    ['年', '月', '氏名', '税抜報酬額', '税込支払額', '源泉所得税', '差引支払額'],
  ]
  accountants
    .filter(a => a.paymentMonths.includes(month))
    .forEach(a => {
      zeirishiRows.push([
        year, month, a.name, a.amount,
        calcZeirishiGross(a.amount), calcZeirishiTax(a.amount), calcZeirishiNet(a.amount),
      ])
    })

  return [
    { name: `給与台帳_乙欄_日別_${tag}.csv`, csv: toCsv(koyoRows) },
    { name: `給与台帳_乙欄_月別集計_${tag}.csv`, csv: toCsv(koyoMonthlyRows) },
    { name: `ホステス支払台帳_日別_${tag}.csv`, csv: toCsv(hostessRows) },
    { name: `ホステス支払台帳_月別集計_${tag}.csv`, csv: toCsv(hostessMonthlyRows) },
    { name: `税理士台帳_${tag}.csv`, csv: toCsv(zeirishiRows) },
  ]
}

function buildEmployeesCsv(employees: Employee[]): string {
  const rows: (string | number)[][] = [
    ['氏名', 'フリガナ', '源氏名', '区分', '生年月日', '住所', 'メモ', '税務署報告'],
  ]
  employees.forEach(e => {
    rows.push([
      e.name, e.furigana, e.stageName,
      e.kind === 'hostess' ? 'ホステス' : '乙欄',
      e.birthday, e.address, e.memo.replace(/\r?\n/g, ' '),
      e.reportable ? '対象' : '対象外',
    ])
  })
  return toCsv(rows)
}

export default function ExportPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [accountants, setAccountants] = useState<TaxAccountant[]>([])
  const [payments, setPayments] = useState<DailyPayment[]>([])
  const now = new Date()
  const [startYear, setStartYear] = useState(now.getFullYear())
  const [startMonth, setStartMonth] = useState(now.getMonth() + 1)
  const [endYear, setEndYear] = useState(now.getFullYear())
  const [endMonth, setEndMonth] = useState(now.getMonth() + 1)
  const [bundling, setBundling] = useState(false)

  useEffect(() => {
    load().then(s => {
      setEmployees(s.employees)
      setAccountants(s.accountants)
      setPayments(s.dailyPayments)
    })
  }, [])

  // 範囲の妥当性チェック
  const startKey = startYear * 12 + startMonth
  const endKey = endYear * 12 + endMonth
  const invalidRange = startKey > endKey

  const months = useMemo(
    () => (invalidRange ? [] : monthsBetween(startYear, startMonth, endYear, endMonth)),
    [startYear, startMonth, endYear, endMonth, invalidRange],
  )

  // 全月分のファイルを生成
  const monthlyFiles: ExportFile[] = useMemo(() => {
    return months.flatMap(({ year, month }) =>
      buildMonthFiles(year, month, employees, accountants, payments),
    )
  }, [months, employees, accountants, payments])

  // 従業員台帳（最も新しい月のタグ）
  const lastMonth = months[months.length - 1]
  const employeesFile: ExportFile | null = useMemo(() => {
    if (!lastMonth) return null
    return {
      name: `従業員台帳_${ym(lastMonth.year, lastMonth.month)}.csv`,
      csv: buildEmployeesCsv(employees),
    }
  }, [lastMonth, employees])

  const allFiles: ExportFile[] = useMemo(
    () => (employeesFile ? [employeesFile, ...monthlyFiles] : monthlyFiles),
    [employeesFile, monthlyFiles],
  )

  const zipTag =
    months.length === 0
      ? ''
      : months.length === 1
      ? ym(months[0].year, months[0].month)
      : `${ym(months[0].year, months[0].month)}〜${ym(lastMonth.year, lastMonth.month)}`

  const dl = (name: string, csv: string) => downloadFile(csvBlob(csv), name)

  const downloadBundle = async () => {
    if (allFiles.length === 0) return
    setBundling(true)
    try {
      const zipName = `税理士提出用ファイル_${zipTag}.zip`
      const res = await fetch('/api/tax-export-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zipName,
          files: allFiles.map(f => ({ name: f.name, content: f.csv })),
        }),
      })
      if (!res.ok) {
        alert('ZIP作成に失敗しました')
        return
      }
      const blob = await res.blob()
      const file = new File([blob], zipName, { type: 'application/zip' })
      const shared = await shareFiles([file], `税理士提出用ファイル ${zipTag}`)
      if (!shared) downloadFile(blob, zipName)
    } catch (err) {
      console.error(err)
      alert('ダウンロードに失敗しました')
    } finally {
      setBundling(false)
    }
  }

  return (
    <PageContainer>
      <BackLink href="/tax" />
      <PageTitle>CSV書き出し</PageTitle>

      <Card className="space-y-3">
        <div className="text-[13px] text-gray-500 leading-snug">
          開始月〜終了月で範囲指定できます。同じ月を指定するとその月だけ出力されます。
        </div>

        <SectionLabel>開始月</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          <Field label="年">
            <TextInput
              type="number"
              value={startYear}
              onChange={e => setStartYear(parseInt(e.target.value) || startYear)}
            />
          </Field>
          <Field label="月">
            <Select value={startMonth} onChange={e => setStartMonth(parseInt(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{m}月</option>
              ))}
            </Select>
          </Field>
        </div>

        <SectionLabel>終了月</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          <Field label="年">
            <TextInput
              type="number"
              value={endYear}
              onChange={e => setEndYear(parseInt(e.target.value) || endYear)}
            />
          </Field>
          <Field label="月">
            <Select value={endMonth} onChange={e => setEndMonth(parseInt(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{m}月</option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      {invalidRange && (
        <div className="mt-4 rounded-2xl bg-red-50 ring-1 ring-red-200/60 p-3 text-[13px] text-red-800">
          ⚠️ 終了月は開始月以降にしてください。
        </div>
      )}

      {!invalidRange && (
        <div className="mt-4 rounded-2xl bg-blue-50 p-4 text-[13px] text-blue-900 leading-snug">
          📦 出力対象: <b>{months.length}ヶ月分</b>（{zipTag}）<br />
          含まれるファイル数: <b>{allFiles.length} 個</b>
          （月次5ファイル × {months.length}ヶ月 + 従業員台帳 1ファイル）
        </div>
      )}

      <div className="mt-5">
        <PrimaryButton
          onClick={() => void downloadBundle()}
          disabled={bundling || invalidRange || allFiles.length === 0}
        >
          {bundling ? '作成中…' : '税理士提出用ファイルをまとめてダウンロード'}
        </PrimaryButton>
        <p className="text-[12px] text-gray-500 mt-2 px-1 leading-relaxed">
          スマホでは共有メニュー（LINE・メール・ファイル App など）が開きます。<br />
          パソコンではそのまま ZIP がダウンロードされます。
        </p>
      </div>

      {!invalidRange && (
        <>
          <SectionLabel>個別にダウンロード（{allFiles.length}ファイル）</SectionLabel>
          <div className="bg-white rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.04] overflow-hidden divide-y divide-gray-100">
            {allFiles.map(f => (
              <div key={f.name} className="flex justify-between items-center px-4 py-3 gap-2">
                <div className="text-[13px] text-gray-900 truncate flex-1">{f.name}</div>
                <button
                  onClick={() => dl(f.name, f.csv)}
                  className="text-[13px] text-blue-500 font-medium active:text-blue-700 shrink-0"
                >
                  DL
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </PageContainer>
  )
}
