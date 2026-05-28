'use client'

import { useEffect, useState } from 'react'
import { load, save, PayerInfo } from '@/lib/tax/storage'
import {
  BackLink,
  Card,
  Field,
  PageContainer,
  PageTitle,
  PrimaryButton,
  TextInput,
  Toggle,
} from '@/components/tax/ui'

export default function PayerSettingsPage() {
  const [payer, setPayer] = useState<PayerInfo | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    load().then(s => setPayer(s.payer))
  }, [])

  if (!payer) return null

  const update = (k: keyof PayerInfo, v: string | boolean) =>
    setPayer({ ...payer, [k]: v })

  const saveAll = async () => {
    setSaving(true)
    const s = await load()
    s.payer = payer
    await save(s)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <PageContainer>
      <BackLink href="/tax/settings" label="設定" />
      <PageTitle>納付者情報</PageTitle>

      <Card className="space-y-4">
        <Field label="税務署名">
          <TextInput value={payer.taxOffice} onChange={e => update('taxOffice', e.target.value)} />
        </Field>
        <Field label="税務署番号" hint="3桁">
          <TextInput value={payer.taxOfficeNumber} onChange={e => update('taxOfficeNumber', e.target.value)} />
        </Field>
        <Field label="整理番号" hint="8桁">
          <TextInput value={payer.seiriNumber} onChange={e => update('seiriNumber', e.target.value)} />
        </Field>
        <Field label="整理番号" hint="13桁/記入者">
          <TextInput value={payer.payerNumber} onChange={e => update('payerNumber', e.target.value)} />
        </Field>
        <Field label="住所(所在地)">
          <TextInput value={payer.address} onChange={e => update('address', e.target.value)} />
        </Field>
        <Field label="氏名(名称)">
          <TextInput value={payer.name} onChange={e => update('name', e.target.value)} />
        </Field>
        <Field label="電話番号">
          <TextInput value={payer.phone} onChange={e => update('phone', e.target.value)} inputMode="tel" />
        </Field>
        <div className="pt-2 border-t border-gray-100">
          <Toggle
            checked={payer.noukiTokurei}
            onChange={v => update('noukiTokurei', v)}
            label="納期の特例を適用（半年に1回納付）"
          />
        </div>
      </Card>

      <div className="mt-6">
        <PrimaryButton onClick={() => void saveAll()} disabled={saving}>
          {saving ? '保存中…' : saved ? '保存しました ✓' : '保存'}
        </PrimaryButton>
      </div>
    </PageContainer>
  )
}
