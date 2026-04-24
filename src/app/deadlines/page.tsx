import Link from 'next/link'
import { AppShell } from '@/components/groupware/AppShell'
import { DeadlineTable } from '@/components/groupware/DeadlineTable'
import { listClients, listDeadlines } from '@/lib/groupware/store'
import { classifyUrgency } from '@/lib/groupware/deadlines'

export const dynamic = 'force-dynamic'

type Filter = 'overdue' | 'critical' | 'warning' | 'upcoming' | 'active' | 'all'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'active', label: '進行中' },
  { key: 'overdue', label: '超過' },
  { key: 'critical', label: '7日以内' },
  { key: 'warning', label: '30日以内' },
  { key: 'upcoming', label: '90日以内' },
  { key: 'all', label: 'すべて' },
]

export default async function DeadlinesPage({
  searchParams,
}: {
  searchParams?: { filter?: string; clientId?: string; category?: string }
}) {
  const filter = (searchParams?.filter as Filter) ?? 'active'
  const [clients, deadlines] = await Promise.all([listClients(), listDeadlines()])
  const clientNames = new Map(clients.map((c) => [c.id, c.name]))

  let filtered = deadlines
  if (searchParams?.clientId) {
    filtered = filtered.filter((d) => d.clientId === searchParams.clientId)
  }
  if (searchParams?.category) {
    filtered = filtered.filter((d) => d.category === searchParams.category)
  }

  const isActive = (status: string) => status !== '提出済' && status !== '納付済'

  switch (filter) {
    case 'overdue':
      filtered = filtered.filter((d) => isActive(d.status) && classifyUrgency(d.dueDate) === 'overdue')
      break
    case 'critical':
      filtered = filtered.filter((d) => isActive(d.status) && classifyUrgency(d.dueDate) === 'critical')
      break
    case 'warning':
      filtered = filtered.filter((d) => isActive(d.status) && classifyUrgency(d.dueDate) === 'warning')
      break
    case 'upcoming':
      filtered = filtered.filter((d) => isActive(d.status) && classifyUrgency(d.dueDate) === 'upcoming')
      break
    case 'active':
      filtered = filtered.filter((d) => isActive(d.status))
      break
    case 'all':
    default:
      break
  }

  return (
    <AppShell>
      <div className="flex items-end justify-between mb-6">
        <div>
          <p className="gw-label mb-2">期限管理</p>
          <h1 className="text-[36px] font-semibold tracking-tight">申告・納付期限</h1>
          <p className="text-ink-soft mt-1">
            全顧問先の期限を横断で確認できます。決算月の登録で期限は自動生成されます。
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {FILTERS.map((f) => {
          const active = f.key === filter
          return (
            <Link
              key={f.key}
              href={`/deadlines?filter=${f.key}`}
              className={
                'px-3 py-1.5 rounded-full text-[13px] border transition-colors ' +
                (active
                  ? 'bg-ink text-white border-ink'
                  : 'bg-white text-ink-soft border-black/10 hover:border-black/30')
              }
            >
              {f.label}
            </Link>
          )
        })}
      </div>

      <DeadlineTable deadlines={filtered} clientNames={clientNames} showClient />
    </AppShell>
  )
}
