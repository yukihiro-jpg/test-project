import type { MonthOption } from '../lib/types'

interface Props {
  months: MonthOption[]
  selectedMonth: string
  onSelect: (month: string) => void
}

export default function MonthSelector({ months, selectedMonth, onSelect }: Props) {
  return (
    <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-thin">
      {months.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => onSelect(value)}
          className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
            value === selectedMonth
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

/**
 * 会計期間に基づく月リストを生成
 * fiscalYearStart = 決算月。期首はその翌月
 */
export function generateMonthOptions(fiscalYearStart: number): MonthOption[] {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  // 期首月 = 決算月の翌月
  const startMonth = (fiscalYearStart % 12) + 1

  // 現在の会計年度の期首年を計算
  let startYear: number
  if (startMonth <= currentMonth) {
    // 期首月が現在月以前 → 今年から始まる会計年度
    startYear = currentYear
  } else {
    // 期首月が現在月より後 → 去年から始まった会計年度
    startYear = currentYear - 1
  }

  const options: MonthOption[] = []
  for (let i = 0; i < 12; i++) {
    let m = startMonth + i
    let y = startYear
    if (m > 12) {
      m -= 12
      y += 1
    }
    const value = `${y}-${String(m).padStart(2, '0')}`
    const label = `${y}年${m}月`
    options.push({ value, label })
  }

  return options
}

/**
 * 現在月のキーを取得
 */
export function getCurrentMonthKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}
