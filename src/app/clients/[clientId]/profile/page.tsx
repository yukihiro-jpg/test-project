'use client'

/**
 * 社長プロファイル設定画面
 *
 * 顧問先ごとに社長の好み・重視KPI・用語設定を保存する。
 * AI叩き台コメント生成時のコンテキストとして使用される。
 */

import { useEffect, useState } from 'react'
import type { ClientProfile, Kpi } from '@/lib/types'

const ALL_KPIS: { key: Kpi; label: string }[] = [
  { key: 'revenue', label: '売上高' },
  { key: 'gross_margin', label: '粗利率' },
  { key: 'operating_income', label: '営業利益' },
  { key: 'cash_balance', label: '現預金残高' },
  { key: 'accounts_receivable', label: '売掛金' },
  { key: 'debt_balance', label: '借入金残高' },
  { key: 'labor_cost_ratio', label: '人件費率' },
]

export default function ProfilePage({ params }: { params: { clientId: string } }) {
  const [profile, setProfile] = useState<Partial<ClientProfile>>({
    clientId: params.clientId,
    presidentName: '',
    presidentEmail: '',
    reportStyle: 'balanced',
    commentTone: 'polite',
    focusedKpis: [],
    vocabularyPreference: {},
    customTerms: {},
    fontSize: 'normal',
    meetingFrequency: 'monthly',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/clients/${params.clientId}/profile`)
      .then((r) => r.json())
      .then(({ profile: p }) => {
        if (p) setProfile(p)
      })
  }, [params.clientId])

  const save = async () => {
    setSaving(true)
    try {
      await fetch(`/api/clients/${params.clientId}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      })
    } finally {
      setSaving(false)
    }
  }

  const toggleKpi = (kpi: Kpi) => {
    setProfile((p) => {
      const current = p.focusedKpis ?? []
      return current.includes(kpi)
        ? { ...p, focusedKpis: current.filter((k) => k !== kpi) }
        : { ...p, focusedKpis: [...current, kpi] }
    })
  }

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-bold mb-6">社長プロファイル設定</h1>

      <div className="bg-white rounded-lg shadow-sm p-6 space-y-5">
        {/* 基本情報 */}
        <section>
          <h2 className="font-semibold mb-3">基本情報</h2>
          <div className="space-y-3">
            <Input
              label="社長氏名"
              value={profile.presidentName}
              onChange={(v) => setProfile({ ...profile, presidentName: v })}
            />
            <Input
              label="社長メールアドレス"
              value={profile.presidentEmail}
              onChange={(v) => setProfile({ ...profile, presidentEmail: v })}
              type="email"
            />
            <Select
              label="年齢層（フォントサイズ最適化に使用）"
              value={profile.presidentAgeGroup ?? ''}
              onChange={(v) =>
                setProfile({ ...profile, presidentAgeGroup: (v || undefined) as ClientProfile['presidentAgeGroup'] })
              }
              options={[
                { value: '', label: '未指定' },
                { value: 'under_40s', label: '40代以下' },
                { value: '50s', label: '50代' },
                { value: '60s', label: '60代' },
                { value: '70s_plus', label: '70代以上' },
              ]}
            />
          </div>
        </section>

        {/* 資料スタイル */}
        <section>
          <h2 className="font-semibold mb-3">資料スタイル</h2>
          <div className="space-y-3">
            <Select
              label="資料の詳しさ"
              value={profile.reportStyle ?? 'balanced'}
              onChange={(v) => setProfile({ ...profile, reportStyle: v as ClientProfile['reportStyle'] })}
              options={[
                { value: 'detailed', label: '詳細型（データを網羅）' },
                { value: 'balanced', label: 'バランス型' },
                { value: 'summary', label: 'サマリー型（要点のみ）' },
              ]}
            />
            <Select
              label="AI コメントのトーン"
              value={profile.commentTone ?? 'polite'}
              onChange={(v) => setProfile({ ...profile, commentTone: v as ClientProfile['commentTone'] })}
              options={[
                { value: 'polite', label: '丁寧（敬体）' },
                { value: 'casual', label: 'カジュアル' },
                { value: 'data_driven', label: 'データ重視' },
              ]}
            />
            <Select
              label="フォントサイズ"
              value={profile.fontSize ?? 'normal'}
              onChange={(v) => setProfile({ ...profile, fontSize: v as ClientProfile['fontSize'] })}
              options={[
                { value: 'normal', label: '標準' },
                { value: 'large', label: '大' },
                { value: 'extra_large', label: '特大' },
              ]}
            />
          </div>
        </section>

        {/* 重視KPI */}
        <section>
          <h2 className="font-semibold mb-3">重視する KPI（複数選択可）</h2>
          <div className="grid grid-cols-2 gap-2">
            {ALL_KPIS.map((k) => (
              <label key={k.key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={(profile.focusedKpis ?? []).includes(k.key)}
                  onChange={() => toggleKpi(k.key)}
                />
                {k.label}
              </label>
            ))}
          </div>
        </section>

        {/* 打合せメモ */}
        <section>
          <h2 className="font-semibold mb-3">打合せスタイル</h2>
          <Select
            label="打合せ頻度"
            value={profile.meetingFrequency ?? 'monthly'}
            onChange={(v) => setProfile({ ...profile, meetingFrequency: v as ClientProfile['meetingFrequency'] })}
            options={[
              { value: 'monthly', label: '毎月' },
              { value: 'bi_monthly', label: '隔月' },
            ]}
          />
          <label className="block mt-3">
            <span className="block text-sm font-medium mb-1">打合せに関するメモ</span>
            <textarea
              value={profile.meetingNotes ?? ''}
              onChange={(e) => setProfile({ ...profile, meetingNotes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded min-h-[80px]"
              placeholder="例：毎月第2月曜10時〜、会議室で対面"
            />
          </label>
        </section>

        <button
          onClick={save}
          disabled={saving}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium py-3 rounded"
        >
          {saving ? '保存中...' : 'プロファイルを保存'}
        </button>
      </div>
    </main>
  )
}

function Input({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string | undefined
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium mb-1">{label}</span>
      <input
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded"
      />
    </label>
  )
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium mb-1">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded bg-white"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
