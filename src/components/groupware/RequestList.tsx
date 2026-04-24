'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import type { RequestItem, RequestItemStatus } from '@/lib/groupware/types'
import { RequestStatusBadge } from './StatusBadge'
import { formatDateJP } from '@/lib/groupware/format'

const STATUSES: RequestItemStatus[] = ['未依頼', '依頼済', '一部受領', '受領済', '不要']

const TEMPLATES: { name: string; items: string[] }[] = [
  {
    name: '法人決算・申告用',
    items: [
      '総勘定元帳',
      '試算表',
      '預金通帳コピー（事業年度分）',
      '現金出納帳',
      '売掛金・買掛金残高一覧',
      '棚卸表（期末在庫）',
      '固定資産一覧・購入時書類',
      '借入金返済予定表・残高証明書',
      '保険証券・保険料領収証',
      '賃貸借契約書',
      'リース契約書',
      '給与台帳・源泉徴収簿',
      '社会保険関係書類',
      '消費税区分資料',
    ],
  },
  {
    name: '年末調整',
    items: [
      '扶養控除等（異動）申告書',
      '基礎控除・配偶者控除等申告書',
      '保険料控除申告書',
      '住宅借入金等特別控除申告書',
      '生命保険料控除証明書',
      '地震保険料控除証明書',
      '国民年金保険料控除証明書',
      '小規模企業共済掛金証明書',
      'iDeCo掛金証明書',
      '前職の源泉徴収票',
    ],
  },
  {
    name: '個人確定申告',
    items: [
      '源泉徴収票',
      '事業収支内訳 (売上・経費一覧)',
      '通帳コピー',
      '医療費控除明細',
      '社会保険料控除証明書',
      '生命保険料控除証明書',
      '寄附金控除関係書類',
      '住宅ローン控除関係書類',
      '株式・配当等の年間取引報告書',
    ],
  },
  {
    name: '月次資料',
    items: [
      '預金通帳コピー',
      '売上データ (請求書・レジデータ等)',
      '経費領収書',
      'クレジットカード明細',
      '請求書 (売上・仕入)',
      '給与データ',
    ],
  },
]

export function RequestList({
  clientId,
  requests,
}: {
  clientId: string
  requests: RequestItem[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [newTitle, setNewTitle] = useState('')
  const [newDueDate, setNewDueDate] = useState('')
  const [templateOpen, setTemplateOpen] = useState(false)

  function updateStatus(id: string, status: RequestItemStatus) {
    startTransition(async () => {
      await fetch(`/api/groupware/requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          receivedAt: status === '受領済' ? new Date().toISOString().slice(0, 10) : undefined,
        }),
      })
      router.refresh()
    })
  }

  function updateField(id: string, patch: Partial<RequestItem>) {
    startTransition(async () => {
      await fetch(`/api/groupware/requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      router.refresh()
    })
  }

  function remove(id: string) {
    if (!confirm('この項目を削除しますか？')) return
    startTransition(async () => {
      await fetch(`/api/groupware/requests/${id}`, { method: 'DELETE' })
      router.refresh()
    })
  }

  function addSingle() {
    if (!newTitle.trim()) return
    startTransition(async () => {
      await fetch('/api/groupware/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          title: newTitle.trim(),
          status: '未依頼',
          dueDate: newDueDate || undefined,
        }),
      })
      setNewTitle('')
      setNewDueDate('')
      router.refresh()
    })
  }

  function addTemplate(template: { name: string; items: string[] }) {
    startTransition(async () => {
      await fetch('/api/groupware/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: template.items.map((t) => ({
            clientId,
            title: t,
            status: '未依頼',
          })),
        }),
      })
      setTemplateOpen(false)
      router.refresh()
    })
  }

  const completed = requests.filter((r) => r.status === '受領済' || r.status === '不要').length
  const pct = requests.length === 0 ? 0 : Math.round((completed / requests.length) * 100)

  return (
    <div className="gw-card">
      <div className="p-5 border-b border-black/5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-[18px] font-semibold tracking-tight">依頼資料リスト</h3>
            <p className="text-[12px] text-ink-mute mt-0.5">
              進捗 {completed}/{requests.length} ({pct}%)
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setTemplateOpen((v) => !v)}
              className="gw-btn-secondary !py-1.5 !px-3 text-[12px]"
            >
              テンプレから追加
            </button>
          </div>
        </div>
        {/* progress bar */}
        <div className="h-1.5 rounded-full bg-surface-muted overflow-hidden">
          <div
            className="h-full bg-accent transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {templateOpen ? (
        <div className="p-5 border-b border-black/5 bg-surface-muted/50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {TEMPLATES.map((t) => (
              <button
                key={t.name}
                onClick={() => addTemplate(t)}
                className="text-left gw-card gw-card-hover p-4"
                disabled={pending}
              >
                <div className="font-medium text-[15px]">{t.name}</div>
                <div className="text-[12px] text-ink-mute mt-1">{t.items.length} 項目を追加</div>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="divide-y divide-black/5">
        {requests.length === 0 ? (
          <div className="p-10 text-center text-ink-mute text-[14px]">
            依頼資料がまだありません。下から追加するか、テンプレを利用できます。
          </div>
        ) : (
          requests.map((r) => (
            <div key={r.id} className="px-5 py-3 flex items-center gap-3">
              <input
                type="checkbox"
                checked={r.status === '受領済'}
                onChange={(e) =>
                  updateStatus(r.id, e.target.checked ? '受領済' : '依頼済')
                }
                className="w-4 h-4 accent-[#0071e3]"
              />
              <div className="flex-1 min-w-0">
                <div
                  className={
                    'text-[15px] ' +
                    (r.status === '受領済' || r.status === '不要'
                      ? 'text-ink-mute line-through'
                      : 'text-ink')
                  }
                >
                  {r.title}
                </div>
                {r.description ? (
                  <div className="text-[12px] text-ink-mute">{r.description}</div>
                ) : null}
                {r.dueDate ? (
                  <div className="text-[11px] text-ink-mute mt-0.5">回収希望: {formatDateJP(r.dueDate)}</div>
                ) : null}
              </div>
              <input
                type="date"
                value={r.dueDate ?? ''}
                onChange={(e) => updateField(r.id, { dueDate: e.target.value || undefined })}
                className="text-[12px] border-none bg-transparent text-ink-soft focus:outline-none"
              />
              <RequestStatusBadge status={r.status} />
              <select
                className="text-[12px] bg-transparent text-ink-mute hover:text-ink focus:outline-none cursor-pointer"
                value={r.status}
                onChange={(e) => updateStatus(r.id, e.target.value as RequestItemStatus)}
                disabled={pending}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <button
                onClick={() => remove(r.id)}
                className="text-[12px] text-ink-mute hover:text-[#ff3b30]"
                disabled={pending}
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>

      <div className="p-5 border-t border-black/5 bg-surface-muted/40 flex gap-2">
        <input
          className="gw-input flex-1"
          placeholder="依頼資料名を入力 (例: 総勘定元帳)"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addSingle()
            }
          }}
        />
        <input
          type="date"
          className="gw-input w-44"
          value={newDueDate}
          onChange={(e) => setNewDueDate(e.target.value)}
        />
        <button onClick={addSingle} className="gw-btn-primary" disabled={pending || !newTitle.trim()}>
          追加
        </button>
      </div>
    </div>
  )
}
