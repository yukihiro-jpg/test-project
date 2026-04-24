import Link from 'next/link'
import { AppShell } from '@/components/groupware/AppShell'
import { DeadlineStatusBadge } from '@/components/groupware/StatusBadge'
import { listClients, listDeadlines, listLauncherApps } from '@/lib/groupware/store'
import { classifyUrgency, daysUntil } from '@/lib/groupware/deadlines'
import { formatDateJP } from '@/lib/groupware/format'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const [clients, deadlines, apps] = await Promise.all([
    listClients(),
    listDeadlines(),
    listLauncherApps(),
  ])

  const clientById = new Map(clients.map((c) => [c.id, c]))

  const activeDeadlines = deadlines.filter(
    (d) => d.status !== '提出済' && d.status !== '納付済',
  )

  const overdue = activeDeadlines.filter((d) => classifyUrgency(d.dueDate) === 'overdue')
  const critical = activeDeadlines.filter((d) => classifyUrgency(d.dueDate) === 'critical')
  const warning = activeDeadlines.filter((d) => classifyUrgency(d.dueDate) === 'warning')
  const upcoming = activeDeadlines.filter((d) => classifyUrgency(d.dueDate) === 'upcoming')

  const corporations = clients.filter((c) => c.entityType === 'corporation').length
  const individuals = clients.filter((c) => c.entityType === 'individual').length

  const topUrgent = [...overdue, ...critical, ...warning].slice(0, 8)

  return (
    <AppShell>
      <section className="mb-14">
        <p className="gw-label mb-3">ダッシュボード</p>
        <h1 className="text-[44px] leading-tight font-semibold tracking-tight text-ink">
          ようこそ。今日の事務所をひと目で。
        </h1>
        <p className="mt-3 text-ink-soft text-[17px]">
          顧問先 {clients.length} 件（法人 {corporations} / 個人 {individuals}）、
          進行中の期限 {activeDeadlines.length} 件を管理しています。
        </p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-12">
        <SummaryCard label="期限超過" value={overdue.length} tone="danger" href="/deadlines?filter=overdue" />
        <SummaryCard label="7日以内" value={critical.length} tone="warning" href="/deadlines?filter=critical" />
        <SummaryCard label="30日以内" value={warning.length} tone="info" href="/deadlines?filter=warning" />
        <SummaryCard label="90日以内" value={upcoming.length} tone="neutral" href="/deadlines?filter=upcoming" />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
        <div className="lg:col-span-2 gw-card p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[22px] font-semibold tracking-tight">直近の期限</h2>
            <Link href="/deadlines" className="gw-btn-ghost">すべて見る →</Link>
          </div>
          {topUrgent.length === 0 ? (
            <EmptyState message="差し迫った期限はありません。" sub="顧問先を登録すると自動で期限が生成されます。" />
          ) : (
            <ul className="divide-y divide-black/5">
              {topUrgent.map((d) => {
                const client = clientById.get(d.clientId)
                const days = daysUntil(d.dueDate)
                const urgency = classifyUrgency(d.dueDate)
                return (
                  <li key={d.id} className="py-3 flex items-center gap-4">
                    <UrgencyDot urgency={urgency} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[15px] font-medium truncate">
                          {client?.name ?? '（不明な顧問先）'}
                        </span>
                        <DeadlineStatusBadge status={d.status} />
                      </div>
                      <div className="text-[13px] text-ink-soft truncate">
                        {d.category} / {d.kind}
                        {d.periodLabel ? ` · ${d.periodLabel}` : ''}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[15px] font-semibold">{formatDateJP(d.dueDate)}</div>
                      <div
                        className={
                          'text-[12px] ' +
                          (days < 0
                            ? 'text-[#ff3b30]'
                            : days <= 7
                            ? 'text-[#ff9500]'
                            : 'text-ink-mute')
                        }
                      >
                        {days < 0 ? `${Math.abs(days)}日経過` : days === 0 ? '今日' : `あと${days}日`}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="gw-card p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[22px] font-semibold tracking-tight">クイックアクション</h2>
          </div>
          <div className="flex flex-col gap-3">
            <Link href="/clients/new" className="gw-btn-primary w-full">+ 顧問先を登録</Link>
            <Link href="/clients" className="gw-btn-secondary w-full">顧問先一覧</Link>
            <Link href="/deadlines" className="gw-btn-secondary w-full">期限一覧</Link>
            <Link href="/launcher" className="gw-btn-secondary w-full">アプリランチャー</Link>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[22px] font-semibold tracking-tight">アプリ</h2>
          <Link href="/launcher" className="gw-btn-ghost">管理 →</Link>
        </div>
        {apps.length === 0 ? (
          <EmptyState message="まだアプリが登録されていません。" sub="「管理」から外部アプリのURLやファイルパスを登録できます。" />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {apps.map((app) => (
              <a
                key={app.id}
                href={app.url}
                target={app.openInNewTab ? '_blank' : undefined}
                rel={app.openInNewTab ? 'noreferrer' : undefined}
                className="gw-card gw-card-hover p-5 flex items-start gap-3"
              >
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center text-2xl shrink-0"
                  style={{
                    background: (app.color ?? '#0071e3') + '1a',
                    color: app.color ?? '#0071e3',
                  }}
                >
                  {app.icon ?? '🧩'}
                </div>
                <div className="min-w-0">
                  <div className="text-[15px] font-semibold truncate">{app.name}</div>
                  {app.description ? (
                    <div className="text-[12px] text-ink-mute line-clamp-2 mt-0.5">{app.description}</div>
                  ) : null}
                </div>
              </a>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  )
}

function SummaryCard({
  label,
  value,
  tone,
  href,
}: {
  label: string
  value: number
  tone: 'danger' | 'warning' | 'info' | 'neutral'
  href: string
}) {
  const styles = {
    danger: 'text-[#ff3b30]',
    warning: 'text-[#ff9500]',
    info: 'text-[#0071e3]',
    neutral: 'text-ink',
  }[tone]
  return (
    <Link href={href} className="gw-card gw-card-hover p-5 block">
      <div className="gw-label">{label}</div>
      <div className={`mt-2 text-[36px] font-semibold tracking-tight ${styles}`}>{value}</div>
    </Link>
  )
}

function UrgencyDot({
  urgency,
}: {
  urgency: 'overdue' | 'critical' | 'warning' | 'upcoming' | 'far'
}) {
  const color = {
    overdue: 'bg-[#ff3b30]',
    critical: 'bg-[#ff9500]',
    warning: 'bg-[#ffcc00]',
    upcoming: 'bg-[#0071e3]',
    far: 'bg-[#c7c7cc]',
  }[urgency]
  return <span className={`inline-block w-2 h-2 rounded-full ${color} shrink-0`} aria-hidden />
}

function EmptyState({ message, sub }: { message: string; sub?: string }) {
  return (
    <div className="text-center py-10">
      <p className="text-ink-soft">{message}</p>
      {sub ? <p className="text-[13px] text-ink-mute mt-1">{sub}</p> : null}
    </div>
  )
}
