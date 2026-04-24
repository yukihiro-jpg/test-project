'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import type { LauncherApp, LauncherAppType } from '@/lib/groupware/types'

const EMOJI_PALETTE = ['🧩', '📊', '📄', '💼', '📝', '🧮', '📈', '📁', '💰', '🏢', '📮', '✉️', '🖇️', '🧾']
const COLOR_PALETTE = [
  '#0071e3',
  '#34c759',
  '#ff9500',
  '#ff3b30',
  '#af52de',
  '#ff2d55',
  '#5ac8fa',
  '#8e8e93',
]

export function LauncherManager({ apps }: { apps: LauncherApp[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [creating, setCreating] = useState(false)

  function update(id: string, patch: Partial<LauncherApp>) {
    startTransition(async () => {
      await fetch(`/api/groupware/launcher/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      router.refresh()
    })
  }

  function remove(id: string) {
    if (!confirm('このアプリボタンを削除しますか？')) return
    startTransition(async () => {
      await fetch(`/api/groupware/launcher/${id}`, { method: 'DELETE' })
      router.refresh()
    })
  }

  return (
    <div className="space-y-8">
      <div className="gw-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[18px] font-semibold tracking-tight">登録済みアプリ</h3>
            <p className="text-[12px] text-ink-mute mt-1">
              ダッシュボードに表示されるボタンの順序・色・URLを管理します。
            </p>
          </div>
          <button onClick={() => setCreating((v) => !v)} className="gw-btn-primary">
            {creating ? 'キャンセル' : '+ アプリを追加'}
          </button>
        </div>
      </div>

      {creating ? (
        <NewAppForm
          onDone={() => {
            setCreating(false)
            router.refresh()
          }}
          nextOrder={apps.length > 0 ? Math.max(...apps.map((a) => a.order)) + 1 : 1}
        />
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {apps.map((app) => (
          <AppEditCard
            key={app.id}
            app={app}
            onUpdate={(patch) => update(app.id, patch)}
            onDelete={() => remove(app.id)}
            pending={pending}
          />
        ))}
      </div>
      {apps.length === 0 && !creating ? (
        <div className="gw-card p-10 text-center">
          <p className="text-ink-soft">まだ登録されていません。</p>
          <p className="text-[12px] text-ink-mute mt-1">
            Claude Codeで作ったアプリのURLや、ローカルのHTMLファイルパスを登録できます。
          </p>
        </div>
      ) : null}
    </div>
  )
}

function NewAppForm({ onDone, nextOrder }: { onDone: () => void; nextOrder: number }) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [type, setType] = useState<LauncherAppType>('web')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('🧩')
  const [color, setColor] = useState('#0071e3')
  const [openInNewTab, setOpenInNewTab] = useState(true)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function submit() {
    if (!name.trim() || !url.trim()) {
      setError('名前とURL/パスは必須です')
      return
    }
    startTransition(async () => {
      const res = await fetch('/api/groupware/launcher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          url: url.trim(),
          type,
          description: description.trim() || undefined,
          icon,
          color,
          openInNewTab,
          order: nextOrder,
        }),
      })
      if (!res.ok) {
        setError('保存に失敗しました')
        return
      }
      onDone()
    })
  }

  return (
    <div className="gw-card p-6">
      <h3 className="text-[18px] font-semibold tracking-tight mb-4">新しいアプリを追加</h3>
      {error ? <div className="text-[#ff3b30] text-[13px] mb-3">{error}</div> : null}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="block">
          <div className="text-[12px] text-ink-soft mb-1.5 font-medium">表示名 *</div>
          <input className="gw-input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block">
          <div className="text-[12px] text-ink-soft mb-1.5 font-medium">種類</div>
          <select
            className="gw-select"
            value={type}
            onChange={(e) => setType(e.target.value as LauncherAppType)}
          >
            <option value="web">Webアプリ (URL)</option>
            <option value="file">ローカルファイル (file://)</option>
            <option value="note">メモのみ (起動しない)</option>
          </select>
        </label>
        <label className="block md:col-span-2">
          <div className="text-[12px] text-ink-soft mb-1.5 font-medium">URL / パス *</div>
          <input
            className="gw-input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={
              type === 'web'
                ? 'https://example.com または /apps/your-app'
                : 'file:///Users/xxx/tool/index.html'
            }
          />
          {type === 'file' ? (
            <div className="text-[11px] text-ink-mute mt-1">
              ブラウザ設定によっては file:// のリンクが動作しない場合があります。ローカルHTMLは /public に置くか、簡易サーバで配信するのがおすすめです。
            </div>
          ) : null}
        </label>
        <label className="block md:col-span-2">
          <div className="text-[12px] text-ink-soft mb-1.5 font-medium">説明</div>
          <input
            className="gw-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <div>
          <div className="text-[12px] text-ink-soft mb-1.5 font-medium">アイコン</div>
          <div className="flex flex-wrap gap-2">
            {EMOJI_PALETTE.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setIcon(e)}
                className={
                  'w-9 h-9 rounded-lg text-lg ' +
                  (icon === e ? 'bg-ink text-white' : 'bg-surface-muted hover:bg-[#e8e8ed]')
                }
              >
                {e}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[12px] text-ink-soft mb-1.5 font-medium">色</div>
          <div className="flex flex-wrap gap-2">
            {COLOR_PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={
                  'w-9 h-9 rounded-lg border-2 ' +
                  (color === c ? 'border-ink' : 'border-transparent')
                }
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
      </div>
      <label className="mt-4 flex items-center gap-2 text-[13px]">
        <input
          type="checkbox"
          checked={openInNewTab}
          onChange={(e) => setOpenInNewTab(e.target.checked)}
        />
        新規タブで開く
      </label>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onDone} className="gw-btn-secondary" disabled={pending}>
          キャンセル
        </button>
        <button onClick={submit} className="gw-btn-primary" disabled={pending}>
          追加
        </button>
      </div>
    </div>
  )
}

function AppEditCard({
  app,
  onUpdate,
  onDelete,
  pending,
}: {
  app: LauncherApp
  onUpdate: (patch: Partial<LauncherApp>) => void
  onDelete: () => void
  pending: boolean
}) {
  const [name, setName] = useState(app.name)
  const [url, setUrl] = useState(app.url)
  const [description, setDescription] = useState(app.description ?? '')
  const [icon, setIcon] = useState(app.icon ?? '🧩')
  const [color, setColor] = useState(app.color ?? '#0071e3')
  const [order, setOrder] = useState(app.order)
  const [openInNewTab, setOpenInNewTab] = useState(app.openInNewTab ?? true)
  const [dirty, setDirty] = useState(false)

  function markDirty<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v)
      setDirty(true)
    }
  }

  return (
    <div className="gw-card p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center text-2xl"
            style={{ background: color + '1a', color }}
          >
            {icon}
          </div>
          <div>
            <div className="font-semibold">{app.name}</div>
            <div className="text-[12px] text-ink-mute truncate max-w-[240px]">{app.url}</div>
          </div>
        </div>
        <button
          onClick={onDelete}
          className="text-[12px] text-ink-mute hover:text-[#ff3b30]"
          disabled={pending}
        >
          削除
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 text-[13px]">
        <label>
          <div className="text-[11px] text-ink-mute mb-1">名前</div>
          <input className="gw-input !py-2" value={name} onChange={(e) => markDirty(setName)(e.target.value)} />
        </label>
        <label>
          <div className="text-[11px] text-ink-mute mb-1">順序</div>
          <input
            type="number"
            className="gw-input !py-2"
            value={order}
            onChange={(e) => markDirty(setOrder)(Number(e.target.value))}
          />
        </label>
        <label className="col-span-2">
          <div className="text-[11px] text-ink-mute mb-1">URL / パス</div>
          <input className="gw-input !py-2" value={url} onChange={(e) => markDirty(setUrl)(e.target.value)} />
        </label>
        <label className="col-span-2">
          <div className="text-[11px] text-ink-mute mb-1">説明</div>
          <input
            className="gw-input !py-2"
            value={description}
            onChange={(e) => markDirty(setDescription)(e.target.value)}
          />
        </label>
        <div>
          <div className="text-[11px] text-ink-mute mb-1">アイコン</div>
          <div className="flex flex-wrap gap-1">
            {EMOJI_PALETTE.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => markDirty(setIcon)(e)}
                className={
                  'w-8 h-8 rounded-md text-base ' +
                  (icon === e ? 'bg-ink text-white' : 'bg-surface-muted hover:bg-[#e8e8ed]')
                }
              >
                {e}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-ink-mute mb-1">色</div>
          <div className="flex flex-wrap gap-1">
            {COLOR_PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => markDirty(setColor)(c)}
                className={
                  'w-8 h-8 rounded-md border-2 ' +
                  (color === c ? 'border-ink' : 'border-transparent')
                }
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <label className="flex items-center gap-2 text-[12px]">
          <input
            type="checkbox"
            checked={openInNewTab}
            onChange={(e) => markDirty(setOpenInNewTab)(e.target.checked)}
          />
          新規タブで開く
        </label>
        <button
          className="gw-btn-primary !py-1.5 !px-4 text-[13px]"
          disabled={!dirty || pending}
          onClick={() => {
            onUpdate({ name, url, description, icon, color, order, openInNewTab })
            setDirty(false)
          }}
        >
          {dirty ? '保存' : '保存済み'}
        </button>
      </div>
    </div>
  )
}
