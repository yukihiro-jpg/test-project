'use client'

import dynamic from 'next/dynamic'

const BankStatementContent = dynamic(
  () => import('@/components/bank-statement/BankStatementContent'),
  {
    ssr: false,
    loading: () => (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    ),
  },
)

export default function BankStatementPage() {
  return <BankStatementContent />
}
