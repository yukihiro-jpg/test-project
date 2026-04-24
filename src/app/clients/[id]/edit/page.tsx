import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AppShell } from '@/components/groupware/AppShell'
import { ClientForm } from '@/components/groupware/ClientForm'
import { getClient } from '@/lib/groupware/store'

export const dynamic = 'force-dynamic'

export default async function EditClientPage({ params }: { params: { id: string } }) {
  const client = await getClient(params.id)
  if (!client) notFound()
  return (
    <AppShell>
      <div className="mb-8">
        <Link href={`/clients/${client.id}`} className="text-[13px] text-ink-mute hover:text-ink">
          ← {client.name}
        </Link>
        <h1 className="text-[36px] font-semibold tracking-tight mt-2">顧問先情報の編集</h1>
      </div>
      <ClientForm mode="edit" initial={client} />
    </AppShell>
  )
}
