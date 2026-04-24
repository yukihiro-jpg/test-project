import Link from 'next/link'
import { AppShell } from '@/components/groupware/AppShell'
import { listClients, listDeadlines } from '@/lib/groupware/store'
import { classifyUrgency } from '@/lib/groupware/deadlines'
import { formatDateJP } from '@/lib/groupware/format'

export const dynamic = 'force-dynamic'

export default async function ClientsPage() {
  const [clients, deadlines] = await Promise.all([listClients(), listDeadlines()])
  const urgentByClient = new Map<string, number>()
  deadlines.forEach((d) => {
    if (d.status === '提出済' || d.status === '納付済') return
    const u = classifyUrgency(d.dueDate)
    if (u === 'overdue' || u === 'critical') {
      urgentByClient.set(d.clientId, (urgentByClient.get(d.clientId) ?? 0) + 1)
    }
  })

  return (
    <AppShell>
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="gw-label mb-2">顧問先</p>
          <h1 className="text-[36px] font-semibold tracking-tight">顧問先一覧</h1>
          <p className="text-ink-soft mt-1">{clients.length} 件</p>
        </div>
        <Link href="/clients/new" className="gw-btn-primary">+ 新規登録</Link>
      </div>

      {clients.length === 0 ? (
        <div className="gw-card p-14 text-center">
          <p className="text-ink-soft">まだ顧問先が登録されていません。</p>
          <Link href="/clients/new" className="gw-btn-primary mt-5">最初の顧問先を登録</Link>
        </div>
      ) : (
        <div className="gw-card overflow-hidden">
          <table className="w-full">
            <thead className="bg-surface-muted text-[12px] text-ink-mute uppercase tracking-wider">
              <tr>
                <th className="text-left px-5 py-3 font-medium">名称</th>
                <th className="text-left px-5 py-3 font-medium">区分</th>
                <th className="text-left px-5 py-3 font-medium">決算月</th>
                <th className="text-left px-5 py-3 font-medium">消費税</th>
                <th className="text-left px-5 py-3 font-medium">契約開始</th>
                <th className="text-left px-5 py-3 font-medium">緊急期限</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => {
                const urgent = urgentByClient.get(c.id) ?? 0
                return (
                  <tr key={c.id} className="border-t border-black/5 hover:bg-surface-muted/50 transition-colors">
                    <td className="px-5 py-4">
                      <Link href={`/clients/${c.id}`} className="font-medium hover:underline">
                        {c.name}
                      </Link>
                      {c.nameKana ? <div className="text-[12px] text-ink-mute">{c.nameKana}</div> : null}
                    </td>
                    <td className="px-5 py-4 text-[14px] text-ink-soft">
                      {c.entityType === 'corporation' ? '法人' : '個人'}
                      {c.corporation?.corporationType ? ` · ${c.corporation.corporationType}` : ''}
                    </td>
                    <td className="px-5 py-4 text-[14px] text-ink-soft">
                      {c.entityType === 'corporation' && c.corporation?.fiscalYearEndMonth
                        ? `${c.corporation.fiscalYearEndMonth}月`
                        : '—'}
                    </td>
                    <td className="px-5 py-4 text-[14px] text-ink-soft">
                      {c.corporation?.consumptionTaxMethod ?? c.individual?.consumptionTaxMethod ?? '—'}
                    </td>
                    <td className="px-5 py-4 text-[14px] text-ink-soft">{formatDateJP(c.contractStartDate) || '—'}</td>
                    <td className="px-5 py-4">
                      {urgent > 0 ? (
                        <span className="gw-chip-danger">{urgent}件</span>
                      ) : (
                        <span className="text-ink-mute text-[13px]">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link href={`/clients/${c.id}`} className="text-accent text-[13px]">開く →</Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  )
}
