'use client'

import Link from 'next/link'

export default function TaxHome() {
  return (
    <main className="p-4 max-w-md mx-auto">
      <div className="flex justify-between items-center mb-1">
        <h1 className="text-xl font-bold">源泉所得税 納付書アシスタント</h1>
        <Link
          href="/tax/settings"
          aria-label="設定"
          className="text-2xl px-2 py-1 hover:bg-gray-100 rounded"
        >
          ⚙
        </Link>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        毎月の源泉所得税を計算し、納付書のイメージを表示します。
      </p>

      <div className="grid gap-3">
        <Link href="/tax/daily" className="block bg-white rounded-lg shadow p-4">
          <div className="font-semibold">① 毎日の給与・報酬の支払</div>
          <div className="text-xs text-gray-500 mt-1">
            日付・対象者・支払額を入力。区分(乙欄/ホステス)に応じて源泉税を自動計算。
          </div>
        </Link>
        <Link href="/tax/slip" className="block bg-white rounded-lg shadow p-4">
          <div className="font-semibold">② 納付書イメージを表示</div>
          <div className="text-xs text-gray-500 mt-1">
            月を選んで給与所得・報酬料金の納付書イメージを表示します。
          </div>
        </Link>
        <Link
          href="/tax/export"
          className="block bg-white rounded-lg shadow p-4 border-l-4 border-emerald-400"
        >
          <div className="font-semibold">③ CSV書き出し（税理士へ送る）</div>
          <div className="text-xs text-gray-500 mt-1">
            個別または「税理士提出用ファイル」として一括ダウンロード。
          </div>
        </Link>
      </div>

      <p className="text-[10px] text-gray-400 mt-6 leading-relaxed">
        ※ 初回利用時は ⚙ 設定 から納付者情報・従業員・税理士の登録を行ってください。
      </p>
    </main>
  )
}
