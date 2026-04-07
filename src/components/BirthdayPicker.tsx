'use client'

interface Props {
  year: string
  month: string
  day: string
  onChange: (year: string, month: string, day: string) => void
}

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 100 }, (_, i) => CURRENT_YEAR - i) // 直近100年
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1)

export default function BirthdayPicker({ year, month, day, onChange }: Props) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <div>
        <label className="block text-xs text-gray-500 mb-1">年</label>
        <select
          value={year}
          onChange={(e) => onChange(e.target.value, month, day)}
          className="w-full px-3 py-3 text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">--</option>
          {YEARS.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">月</label>
        <select
          value={month}
          onChange={(e) => onChange(year, e.target.value, day)}
          className="w-full px-3 py-3 text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">--</option>
          {MONTHS.map((m) => (
            <option key={m} value={String(m)}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">日</label>
        <select
          value={day}
          onChange={(e) => onChange(year, month, e.target.value)}
          className="w-full px-3 py-3 text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">--</option>
          {DAYS.map((d) => (
            <option key={d} value={String(d)}>
              {d}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
