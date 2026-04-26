'use client'

import { useState } from 'react'
import { parseLooseDate, toIsoDate, toWareki } from '@/lib/wareki'

type NumberInputProps = {
  value: number
  onChange: (v: number) => void
  className?: string
  placeholder?: string
}

export function NumberInput({ value, onChange, className, placeholder }: NumberInputProps) {
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState('')
  const display = focused
    ? draft
    : value
    ? value < 0
      ? `△${Math.abs(value).toLocaleString()}`
      : value.toLocaleString()
    : ''
  return (
    <input
      type="text"
      inputMode="numeric"
      value={display}
      placeholder={placeholder}
      onFocus={() => {
        setFocused(true)
        setDraft(value ? String(value) : '')
      }}
      onBlur={() => {
        setFocused(false)
        const cleaned = draft.replace(/[,，\s]/g, '').replace(/△/g, '-')
        const n = Number(cleaned)
        onChange(isNaN(n) ? 0 : n)
      }}
      onChange={(e) => setDraft(e.target.value)}
      className={className ?? 'w-full border border-slate-200 rounded px-1 py-0.5 text-right'}
    />
  )
}

type WarekiInputProps = {
  value: string
  onChange: (v: string) => void
  className?: string
  placeholder?: string
}

export function WarekiInput({ value, onChange, className, placeholder }: WarekiInputProps) {
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState('')
  const wareki = toWareki(value)
  const display = focused ? draft : wareki || value || ''
  return (
    <input
      type="text"
      value={display}
      placeholder={placeholder ?? '例: 令和6年12月2日'}
      onFocus={() => {
        setFocused(true)
        setDraft(wareki || value || '')
      }}
      onBlur={() => {
        setFocused(false)
        const parsed = parseLooseDate(draft)
        if (parsed) {
          onChange(toIsoDate(parsed))
        } else {
          onChange(draft)
        }
      }}
      onChange={(e) => setDraft(e.target.value)}
      className={className ?? 'w-full border border-slate-200 rounded px-1 py-0.5'}
    />
  )
}
