import { AppShell } from '@/components/groupware/AppShell'
import { ClientForm } from '@/components/groupware/ClientForm'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default function NewClientPage() {
  return (
    <AppShell>
      <div className="mb-8">
        <Link href="/clients" className="text-[13px] text-ink-mute hover:text-ink">← 顧問先一覧</Link>
        <h1 className="text-[36px] font-semibold tracking-tight mt-2">顧問先の新規登録</h1>
        <p className="text-ink-soft mt-1">
          法人・個人の基本情報と税務区分を登録します。決算月を入力すると申告期限が自動生成されます。
        </p>
      </div>
      <ClientForm mode="create" />
    </AppShell>
  )
}
