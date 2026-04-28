'use client'

import { useState } from 'react'
import { parseLooseDate, toIsoDate, toWareki } from '@/lib/wareki'

type NumberInputProps = {
  value: number
  onChange: (v: number) => void
  className?: string
  placeholder?: string
}

const DEFAULT_CELL_INPUT_CLASS =
  'w-full h-full px-1.5 py-0 bg-transparent border-0 outline-none text-right focus:bg-blue-50 focus:outline focus:outline-2 focus:outline-blue-400 focus:-outline-offset-1'

const DEFAULT_TEXT_CELL_INPUT_CLASS =
  'w-full h-full px-1.5 py-0 bg-transparent border-0 outline-none text-left focus:bg-blue-50 focus:outline focus:outline-2 focus:outline-blue-400 focus:-outline-offset-1'

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
      className={className ?? DEFAULT_CELL_INPUT_CLASS}
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
      className={className ?? DEFAULT_TEXT_CELL_INPUT_CLASS}
    />
  )
}
