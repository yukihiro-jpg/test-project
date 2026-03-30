'use client'

interface Props {
  value: string
  onChange: (name: string) => void
}

export default function NameInput({ value, onChange }: Props) {
  return (
    <div className="mb-6">
      <label
        htmlFor="employee-name"
        className="block text-lg font-bold text-gray-800 mb-2"
      >
        氏名を入力
      </label>
      <input
        id="employee-name"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="例：山田 太郎"
        className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        autoComplete="name"
      />
    </div>
  )
}
