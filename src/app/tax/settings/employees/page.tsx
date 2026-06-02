'use client'

import { useEffect, useState } from 'react'
import { Employee, EmployeeKind, load, save, uid } from '@/lib/tax/storage'
import {
  BackLink,
  Card,
  Field,
  PageContainer,
  PageTitle,
  PrimaryButton,
  SecondaryButton,
  Select,
  SectionLabel,
  TextArea,
  TextInput,
  Toggle,
} from '@/components/tax/ui'

const blank = {
  name: '',
  furigana: '',
  stageName: '',
  address: '',
  birthday: '',
  memo: '',
  kind: 'koyo_otsu' as EmployeeKind,
  reportable: true,
}

export default function EmployeesPage() {
  const [list, setList] = useState<Employee[]>([])
  const [form, setForm] = useState(blank)
  const [editId, setEditId] = useState<string | null>(null)

  useEffect(() => {
    load().then(s => setList(s.employees))
  }, [])

  const reset = () => {
    setForm(blank)
    setEditId(null)
  }

  const submit = async () => {
    if (!form.name.trim()) return
    const s = await load()
    if (editId) {
      const idx = s.employees.findIndex(e => e.id === editId)
      if (idx >= 0) s.employees[idx] = { ...s.employees[idx], ...form, name: form.name.trim() }
    } else {
      s.employees.push({
        id: uid(),
        ...form,
        name: form.name.trim(),
        createdAt: Date.now(),
      })
    }
    await save(s)
    setList(s.employees)
    reset()
  }

  const edit = (e: Employee) => {
    setEditId(e.id)
    setForm({
      name: e.name,
      furigana: e.furigana,
      stageName: e.stageName,
      address: e.address,
      birthday: e.birthday,
      memo: e.memo,
      kind: e.kind,
      reportable: e.reportable,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const del = async (id: string) => {
    if (!confirm('削除しますか？(支払記録も併せて削除されます)')) return
    const s = await load()
    s.employees = s.employees.filter(e => e.id !== id)
    s.dailyPayments = s.dailyPayments.filter(p => p.employeeId !== id)
    await save(s)
    setList(s.employees)
    if (editId === id) reset()
  }

  const update = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm({ ...form, [k]: v })

  return (
    <PageContainer>
      <BackLink href="/tax/settings" label="設定" />
      <PageTitle>従業員の登録</PageTitle>

      <SectionLabel>{editId ? '従業員を編集' : '新規登録'}</SectionLabel>
      <Card className="space-y-4">
        <Field label="氏名">
          <TextInput
            value={form.name}
            onChange={e => update('name', e.target.value)}
            placeholder="山田 花子"
          />
        </Field>
        <Field label="フリガナ">
          <TextInput
            value={form.furigana}
            onChange={e => update('furigana', e.target.value)}
            placeholder="ヤマダ ハナコ"
          />
        </Field>
        <Field label="源氏名" hint="店内呼称（任意）">
          <TextInput
            value={form.stageName}
            onChange={e => update('stageName', e.target.value)}
            placeholder="れな"
          />
        </Field>
        <Field label="住所">
          <TextInput value={form.address} onChange={e => update('address', e.target.value)} />
        </Field>
        <Field label="生年月日">
          <TextInput
            type="date"
            value={form.birthday}
            onChange={e => update('birthday', e.target.value)}
          />
        </Field>
        <Field label="区分">
          <Select value={form.kind} onChange={e => update('kind', e.target.value as EmployeeKind)}>
            <option value="koyo_otsu">一般従業員（乙欄）</option>
            <option value="hostess">ホステス</option>
          </Select>
        </Field>
        <Field label="メモ">
          <TextArea
            rows={3}
            value={form.memo}
            onChange={e => update('memo', e.target.value)}
          />
        </Field>
        <div className="pt-2 border-t border-gray-100">
          <Toggle
            checked={form.reportable}
            onChange={v => update('reportable', v)}
            label="支払情報を税理士へ報告する"
          />
          <p className="text-[12px] text-gray-500 mt-1.5 leading-snug">
            OFFにすると、この人の支払はCSV出力（税理士提出用ファイル）から除外されます。納付書の本税合計には含まれます。
          </p>
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
          {list.map(e => (
            <Card key={e.id}>
              <div className="flex justify-between items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-[16px] font-semibold text-gray-900">
                    {e.name}
                    {e.stageName && (
                      <span className="text-[14px] text-pink-600 ml-2 font-medium">
                        源氏名：{e.stageName}
                      </span>
                    )}
                  </div>
                  {e.furigana && (
                    <div className="text-[12px] text-gray-500 mt-0.5">{e.furigana}</div>
                  )}
                  <div className="text-[13px] text-gray-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                    <span>
                      {e.kind === 'koyo_otsu' ? '一般従業員（乙欄）' : 'ホステス'}
                      {e.birthday && ` ・ ${e.birthday}`}
                    </span>
                    {!e.reportable && (
                      <span className="inline-block bg-red-50 text-red-700 text-[11px] px-1.5 py-0.5 rounded-full ring-1 ring-red-200">
                        報告不可
                      </span>
                    )}
                  </div>
                  {e.address && (
                    <div className="text-[13px] text-gray-500 mt-1 leading-snug">{e.address}</div>
                  )}
                  {e.memo && (
                    <div className="text-[13px] text-gray-700 mt-2 whitespace-pre-wrap bg-gray-50 rounded-lg px-3 py-2 leading-snug">
                      {e.memo}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <button
                    onClick={() => edit(e)}
                    className="text-[14px] text-blue-500 active:text-blue-700 px-2 py-1"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => void del(e.id)}
                    className="text-[14px] text-red-500 active:text-red-700 px-2 py-1"
                  >
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
