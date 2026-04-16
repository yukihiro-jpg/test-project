import { formatBalance } from '../lib/balance'

interface Props {
  carryOver: number
  totalIn: number
  totalOut: number
  closingBalance: number
  inLabel?: string
  outLabel?: string
}

export default function BalanceSummary({
  carryOver,
  totalIn,
  totalOut,
  closingBalance,
  inLabel = '収入合計',
  outLabel = '支出合計',
}: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <SummaryCard label="前月繰越" amount={carryOver} color="gray" />
      <SummaryCard label={inLabel} amount={totalIn} color="blue" />
      <SummaryCard label={outLabel} amount={totalOut} color="red" />
      <SummaryCard label="残高" amount={closingBalance} color="green" large />
    </div>
  )
}

function SummaryCard({
  label,
  amount,
  color,
  large,
}: {
  label: string
  amount: number
  color: 'gray' | 'blue' | 'red' | 'green'
  large?: boolean
}) {
  const colorMap = {
    gray: 'bg-gray-50 text-gray-700',
    blue: 'bg-blue-50 text-blue-700',
    red: 'bg-red-50 text-red-700',
    green: 'bg-green-50 text-green-700',
  }

  return (
    <div className={`rounded-xl p-4 ${colorMap[color]}`}>
      <div className="text-xs font-medium opacity-70 mb-1">{label}</div>
      <div className={`font-bold ${large ? 'text-xl' : 'text-lg'}`}>
        {formatBalance(amount)}
        <span className="text-xs ml-0.5">円</span>
      </div>
    </div>
  )
}
