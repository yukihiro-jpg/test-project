'use client'

import { BackLink, GroupedList, ListLink, PageContainer, PageTitle } from '@/components/tax/ui'

export default function SettingsHome() {
  return (
    <PageContainer>
      <BackLink href="/tax" />
      <PageTitle>設定</PageTitle>

      <GroupedList>
        <ListLink
          href="/tax/settings/payer"
          icon={<span>🏢</span>}
          title="納付者情報"
          description="住所・氏名・税務署・整理番号など、納付書に記載する情報。"
        />
        <ListLink
          href="/tax/settings/employees"
          icon={<span>👥</span>}
          title="従業員の登録"
          description="氏名・フリガナ・住所・生年月日・メモ・区分(乙欄/ホステス)。"
        />
        <ListLink
          href="/tax/settings/accountants"
          icon={<span>👔</span>}
          title="税理士報酬の登録"
          description="氏名・報酬額・支払月。月別の納付書に自動反映されます。"
        />
        <ListLink
          href="/tax/settings/data"
          icon={<span>💾</span>}
          title="データのバックアップ／移行"
          description="全データをJSONで書き出し・読み込み。新アプリへの移行にも。"
        />
      </GroupedList>
    </PageContainer>
  )
}
