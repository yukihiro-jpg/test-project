'use client'

import Link from 'next/link'
import { GroupedList, ListLink, PageContainer, PageTitle } from '@/components/tax/ui'

export default function TaxHome() {
  return (
    <PageContainer>
      <PageTitle
        action={
          <Link
            href="/tax/settings"
            aria-label="設定"
            className="w-10 h-10 -mr-1 flex items-center justify-center rounded-full text-gray-500 active:bg-gray-200/70 active:text-gray-700"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <path
                d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        }
      >
        源泉所得税
        <br />
        <span className="text-gray-500 font-semibold">納付書アシスタント</span>
      </PageTitle>

      <p className="text-[15px] text-gray-500 mb-6 leading-relaxed">
        毎月の源泉所得税を計算し、納付書のイメージを表示します。
      </p>

      <GroupedList>
        <ListLink
          href="/tax/daily"
          icon={<span>📝</span>}
          title="毎日の給与・報酬の支払"
          description="日付・対象者・支払額を入力。区分に応じて源泉税を自動計算。"
        />
        <ListLink
          href="/tax/slip"
          icon={<span>📄</span>}
          title="納付書イメージを表示"
          description="月を選んで給与所得・報酬料金の納付書イメージを確認。"
        />
        <ListLink
          href="/tax/export"
          icon={<span>📤</span>}
          title="CSV書き出し"
          description="個別または「税理士提出用ファイル」として一括ダウンロード。"
        />
      </GroupedList>

      <p className="text-[12px] text-gray-400 mt-6 leading-relaxed px-2">
        初回利用時は右上の設定から、納付者情報・従業員・税理士の登録を行ってください。
      </p>
    </PageContainer>
  )
}
