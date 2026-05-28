'use client'

import { useEffect, useState } from 'react'
import { TaxAccountant, load, save, uid } from '@/lib/tax/storage'
import { calcZeirishiTax } from '@/lib/tax/calc'
import {
  BackLink,
  Card,
  Field,
  PageContainer,
  PageTitle,
  Pill,
  PrimaryButton,
  SecondaryButton,
  SectionLabel,
  TextInput,
} from '@/components/tax/ui'

const allMonths = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

const blank = {
  name: '',
  amount: 0,
  paymentMonths: [...allMonths],
}

export default function AccountantsPage() {
  const [list, setList] = useState<TaxAccountant[]>([])
  const [form, setForm] = useState(blank)
  const [editId, setEditId] = useState<string | null>(null)

  useEffect(() => {
    load().then(s => setList(s.accountants))
  }, [])

  const reset = () => {
    setForm(blank)
    setEditId(null)
  }

  const submit = async () => {
    if (!form.name.trim() || form.amount <= 0 || form.paymentMonths.length === 0) return
    const s = await load()
    if (editId) {
      const idx = s.accountants.findIndex(a => a.id === editId)
      if (idx >= 0) s.accountants[idx] = { ...s.accountants[idx], ...form, name: form.name.trim() }
    } else {
      s.accountants.push({
        id: uid(),
        ...form,
        name: form.name.trim(),
        createdAt: Date.now(),
      })
    }
    await save(s)
    setList(s.accountants)
    reset()
  }

  const edit = (a: TaxAccountant) => {
    setEditId(a.id)
    setForm({
      name: a.name,
      amount: a.amount,
      paymentMonths: [...a.paymentMonths],
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const del = async (id: string) => {
    if (!confirm('削除しますか？')) return
    const s = await load()
    s.accountants = s.accountants.filter(a => a.id !== id)
    await save(s)
    setList(s.accountants)
    if (editId === id) reset()
  }

  const toggleMonth = (m: number) => {
    const cur = form.paymentMonths
    setForm({
      ...form,
      paymentMonths: cur.includes(m) ? cur.filter(x => x !== m) : [...cur, m].sort((a, b) => a - b),
    })
  }

  const previewTax = form.amount > 0 ? calcZeirishiTax(form.amount) : 0

  return (
    <PageContainer>
      <BackLink href="/tax/settings" label="設定" />
      <PageTitle>税理士報酬の登録</PageTitle>

      <SectionLabel>{editId ? '税理士情報を編集' : '新規登録'}</SectionLabel>
      <Card className="space-y-4">
        <Field label="氏名・名称">
          <TextInput
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="山田税理士事務所"
          />
        </Field>
        <Field label="報酬額" hint="1回あたり（円）">
          <TextInput
            type="number"
            inputMode="numeric"
            value={form.amount || ''}
            onChange={e => setForm({ ...form, amount: parseInt(e.target.value) || 0 })}
          />
        </Field>

        {form.amount > 0 && (
          <div className="rounded-2xl bg-blue-50 p-4 space-y-1.5 text-[14px]">
            <div className="flex justify-between">
              <span className="text-gray-700">報酬額</span>
              <span className="font-semibold tabular-nums">{form.amount.toLocaleString()} 円</span>
            </div>
            <div className="flex justify-between text-red-600">
              <span>源泉所得税</span>
              <span className="font-semibold tabular-nums">−{previewTax.toLocaleString()} 円</span>
            </div>
            <div className="flex justify-between pt-1.5 border-t border-blue-200">
              <span className="text-gray-900 font-semibold">差引支払額</span>
              <span className="font-bold text-[16px] tabular-nums">
                {(form.amount - previewTax).toLocaleString()} 円
              </span>
            </div>
          </div>
        )}

        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-[13px] font-medium text-gray-600">支払月</span>
            <div className="flex gap-3">
              <button
                onClick={() => setForm({ ...form, paymentMonths: [...allMonths] })}
                className="text-[13px] text-blue-500 active:text-blue-700"
              >
                毎月
              </button>
              <button
                onClick={() => setForm({ ...form, paymentMonths: [] })}
                className="text-[13px] text-gray-500 active:text-gray-700"
              >
                クリア
              </button>
            </div>
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            {allMonths.map(m => (
              <Pill key={m} selected={form.paymentMonths.includes(m)} onClick={() => toggleMonth(m)}>
                {m}月
              </Pill>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <PrimaryButton onClick={() => void submit()}>
            {editId ? '更新' : '追加'}
          </PrimaryButton>
          {editId && (
            <SecondaryButton onClick={reset} className="shrink-0">
              キャンセル
            </SecondaryButton>
          )}
        </div>
      </Card>

      <SectionLabel>登録済み{list.length > 0 && ` (${list.length})`}</SectionLabel>
      {list.length === 0 ? (
        <Card>
          <p className="text-[15px] text-gray-500 text-center py-4">まだ登録がありません</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {list.map(a => (
            <Card key={a.id}>
              <div className="flex justify-between items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-[16px] font-semibold text-gray-900">{a.name}</div>
                  <div className="text-[13px] text-gray-500 mt-1 tabular-nums">
                    報酬 {a.amount.toLocaleString()} 円 ／ 税{' '}
                    {calcZeirishiTax(a.amount).toLocaleString()} 円
                  </div>
                  <div className="text-[13px] text-gray-500 mt-0.5">
                    支払月：{a.paymentMonths.length === 12 ? '毎月' : a.paymentMonths.map(m => `${m}月`).join('・')}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <button onClick={() => edit(a)} className="text-[14px] text-blue-500 active:text-blue-700 px-2 py-1">
                    編集
                  </button>
                  <button onClick={() => void del(a.id)} className="text-[14px] text-red-500 active:text-red-700 px-2 py-1">
                    削除
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  )
}
