'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import type { Deadline, DeadlineStatus, TaxCategory } from '@/lib/groupware/types'
import { DeadlineStatusBadge } from './StatusBadge'
import { classifyUrgency, daysUntil } from '@/lib/groupware/deadlines'
import { formatDateJP } from '@/lib/groupware/format'

const STATUSES: DeadlineStatus[] = [
  '未着手',
  '資料回収中',
  '作成中',
  '申告書完成',
  '提出済',
  '納付済',
]

const CATEGORIES: TaxCategory[] = [
  '法人税',
  '地方法人税',
  '法人住民税',
  '法人事業税',
  '特別法人事業税',
  '消費税',
  '所得税',
  '源泉所得税',
  '年末調整',
  '法定調書',
  '償却資産税',
  '印紙税',
  '国税その他',
]

const KINDS: Deadline['kind'][] = [
  '確定申告',
  '中間申告',
  '予定納税',
  '源泉納付',
  '年末調整',
  '法定調書',
  '償却資産',
  'その他',
]

export function DeadlineTable({
  deadlines,
  clientNames,
  showClient = false,
  clientIdForCreate,
}: {
  deadlines: Deadline[]
  clientNames?: Map<string, string>
  showClient?: boolean
  clientIdForCreate?: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [creating, setCreating] = useState(false)

  function updateStatus(id: string, status: DeadlineStatus) {
    startTransition(async () => {
      await fetch(`/api/groupware/deadlines/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      router.refresh()
    })
  }

  function remove(id: string) {
    if (!confirm('この期限を削除しますか？')) return
    startTransition(async () => {
      await fetch(`/api/groupware/deadlines/${id}`, { method: 'DELETE' })
      router.refresh()
    })
  }

  return (
    <div className="gw-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-black/5">
        <div className="text-[12px] text-ink-mute">{deadlines.length} 件</div>
        {clientIdForCreate ? (
          <button
            type="button"
            onClick={() => setCreating((v) => !v)}
            className="gw-btn-ghost text-[12px] !py-1.5 !px-3"
          >
            {creating ? 'キャンセル' : '+ 期限を追加'}
          </button>
        ) : null}
      </div>
      {creating && clientIdForCreate ? (
        <NewDeadlineRow
          clientId={clientIdForCreate}
          onDone={() => {
            setCreating(false)
            router.refresh()
          }}
        />
      ) : null}
      <table className="w-full">
        <thead className="bg-surface-muted text-[12px] text-ink-mute uppercase tracking-wider">
          <tr>
            {showClient ? <th className="text-left px-5 py-3 font-medium">顧問先</th> : null}
            <th className="text-left px-5 py-3 font-medium">税目</th>
            <th className="text-left px-5 py-3 font-medium">種別</th>
            <th className="text-left px-5 py-3 font-medium">対象期</th>
            <th className="text-left px-5 py-3 font-medium">期限</th>
            <th className="text-left px-5 py-3 font-medium">ステータス</th>
            <th className="w-10"></th>
          </tr>
        </thead>
        <tbody>
          {deadlines.length === 0 ? (
            <tr>
              <td colSpan={showClient ? 7 : 6} className="px-5 py-10 text-center text-ink-mute text-[14px]">
                期限はありません
              </td>
            </tr>
          ) : (
            deadlines.map((d) => {
              const u = classifyUrgency(d.dueDate)
              const days = daysUntil(d.dueDate)
              const isClosed = d.status === '提出済' || d.status === '納付済'
              return (
                <tr key={d.id} className="border-t border-black/5 hover:bg-surface-muted/40">
                  {showClient ? (
                    <td className="px-5 py-3 text-[14px]">
                      {clientNames?.get(d.clientId) ?? '—'}
                    </td>
                  ) : null}
                  <td className="px-5 py-3 text-[14px]">{d.category}</td>
                  <td className="px-5 py-3 text-[14px] text-ink-soft">{d.kind}</td>
                  <td className="px-5 py-3 text-[13px] text-ink-mute">{d.periodLabel ?? '—'}</td>
                  <td className="px-5 py-3 text-[14px]">
                    <div className="font-medium">{formatDateJP(d.dueDate)}</div>
                    {!isClosed ? (
                      <div
                        className={
                          'text-[11px] ' +
                          (u === 'overdue'
                            ? 'text-[#ff3b30]'
                            : u === 'critical'
                            ? 'text-[#ff9500]'
                            : 'text-ink-mute')
                        }
                      >
                        {days < 0 ? `${Math.abs(days)}日経過` : days === 0 ? '今日' : `あと${days}日`}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <DeadlineStatusBadge status={d.status} />
                      <select
                        className="text-[12px] bg-transparent text-ink-mute hover:text-ink focus:outline-none cursor-pointer"
                        value={d.status}
                        onChange={(e) => updateStatus(d.id, e.target.value as DeadlineStatus)}
                        disabled={pending}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => remove(d.id)}
                      className="text-[12px] text-ink-mute hover:text-[#ff3b30]"
                      disabled={pending}
                    >
                      削除
                    </button>
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}

function NewDeadlineRow({
  clientId,
  onDone,
}: {
  clientId: string
  onDone: () => void
}) {
  const [category, setCategory] = useState<TaxCategory>('法人税')
  const [kind, setKind] = useState<Deadline['kind']>('確定申告')
  const [periodLabel, setPeriodLabel] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [note, setNote] = useState('')
  const [pending, startTransition] = useTransition()

  function submit() {
    if (!dueDate) return
    startTransition(async () => {
      await fetch('/api/groupware/deadlines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          category,
          kind,
          periodLabel: periodLabel || undefined,
          dueDate,
          status: '未着手',
          note: note || undefined,
        }),
      })
      onDone()
    })
  }

  return (
    <div className="p-5 bg-surface-muted border-b border-black/5 grid grid-cols-2 md:grid-cols-6 gap-3">
      <select className="gw-select" value={category} onChange={(e) => setCategory(e.target.value as TaxCategory)}>
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <select className="gw-select" value={kind} onChange={(e) => setKind(e.target.value as Deadline['kind'])}>
        {KINDS.map((k) => (
          <option key={k} value={k}>
            {k}
          </option>
        ))}
      </select>
      <input
        className="gw-input"
        placeholder="対象期 (例: 第5期)"
        value={periodLabel}
        onChange={(e) => setPeriodLabel(e.target.value)}
      />
      <input
        type="date"
        className="gw-input"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
      />
      <input
        className="gw-input md:col-span-1"
        placeholder="メモ"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <button
        onClick={submit}
        className="gw-btn-primary"
        disabled={pending || !dueDate}
      >
        追加
      </button>
    </div>
  )
}
