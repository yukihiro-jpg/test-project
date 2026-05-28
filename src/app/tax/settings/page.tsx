'use client'

import Link from 'next/link'

export default function SettingsHome() {
  return (
    <main className="p-4 max-w-md mx-auto">
      <Link href="/tax" className="text-sm text-blue-600">← 戻る</Link>
      <h1 className="text-lg font-bold my-3">設定</h1>

      <div className="grid gap-3">
        <Link href="/tax/settings/payer" className="block bg-white rounded-lg shadow p-4">
          <div className="font-semibold">納付者情報</div>
          <div className="text-xs text-gray-500 mt-1">
            住所・氏名・税務署・整理番号など、納付書に記載する情報。
          </div>
        </Link>
        <Link href="/tax/settings/employees" className="block bg-white rounded-lg shadow p-4">
          <div className="font-semibold">従業員の登録</div>
          <div className="text-xs text-gray-500 mt-1">
            氏名・フリガナ・住所・生年月日・メモ・区分(乙欄/ホステス)。
          </div>
        </Link>
        <Link href="/tax/settings/accountants" className="block bg-white rounded-lg shadow p-4">
          <div className="font-semibold">税理士報酬の登録</div>
          <div className="text-xs text-gray-500 mt-1">
            氏名・報酬額・支払月。月別の納付書に自動反映されます。
          </div>
        </Link>
      </div>
    </main>
  )
}
