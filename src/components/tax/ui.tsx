'use client'

import Link from 'next/link'
import { ReactNode, InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, ButtonHTMLAttributes } from 'react'

export function PageContainer({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <main className={`px-5 pt-3 pb-12 mx-auto ${wide ? 'max-w-5xl' : 'max-w-md'}`}>
      {children}
    </main>
  )
}

export function BackLink({ href, label = '戻る' }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center text-[15px] text-blue-500 active:text-blue-700 -ml-1 py-1"
    >
      <svg className="w-[18px] h-[18px] -mr-0.5" viewBox="0 0 24 24" fill="none">
        <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label}
    </Link>
  )
}

export function PageTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex justify-between items-end mt-2 mb-5">
      <h1 className="text-[28px] font-bold tracking-tight leading-tight">{children}</h1>
      {action}
    </div>
  )
}

export function Card({
  children,
  className = '',
  padded = true,
}: {
  children: ReactNode
  className?: string
  padded?: boolean
}) {
  return (
    <div className={`bg-white rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.04] ${padded ? 'p-4' : ''} ${className}`}>
      {children}
    </div>
  )
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-4 pb-1.5 pt-3 text-[13px] font-medium text-gray-500 uppercase tracking-wide">
      {children}
    </div>
  )
}

// グループリスト：iOS の設定アプリ風の縦並びリスト
export function GroupedList({ children }: { children: ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.04] overflow-hidden divide-y divide-gray-100">
      {children}
    </div>
  )
}

export function ListLink({
  href,
  title,
  description,
  icon,
}: {
  href: string
  title: string
  description?: string
  icon?: ReactNode
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3.5 active:bg-gray-50"
    >
      {icon && <div className="text-2xl shrink-0 w-9 text-center">{icon}</div>}
      <div className="flex-1 min-w-0">
        <div className="text-[16px] font-medium text-gray-900">{title}</div>
        {description && (
          <div className="text-[13px] text-gray-500 mt-0.5 leading-snug">{description}</div>
        )}
      </div>
      <svg className="w-4 h-4 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="none">
        <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="block text-[13px] font-medium text-gray-600 mb-1">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-gray-400 mt-1">{hint}</span>}
    </label>
  )
}

const inputBase =
  'block w-full box-border bg-gray-100 rounded-xl px-3.5 py-2.5 text-[16px] text-gray-900 placeholder:text-gray-400 border-0 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition appearance-none [&::-webkit-date-and-time-value]:text-left'

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputBase} ${props.className || ''}`} />
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputBase} resize-none ${props.className || ''}`} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputBase} appearance-none pr-9 bg-[length:18px] bg-no-repeat bg-[right_0.75rem_center] bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%236b7280%22 stroke-width=%222.5%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><polyline points=%226 9 12 15 18 9%22/></svg>')] ${props.className || ''}`} />
}

export function PrimaryButton({
  children,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`w-full bg-blue-500 text-white font-semibold rounded-2xl py-3.5 text-[17px] active:bg-blue-600 disabled:bg-gray-300 disabled:text-gray-500 transition ${className}`}
    >
      {children}
    </button>
  )
}

export function SecondaryButton({
  children,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`px-4 py-2.5 bg-gray-100 text-gray-900 rounded-xl text-[15px] font-medium active:bg-gray-200 transition ${className}`}
    >
      {children}
    </button>
  )
}

export function Pill({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`text-[15px] py-2 rounded-full font-medium transition ${
        selected
          ? 'bg-blue-500 text-white'
          : 'bg-gray-100 text-gray-700 active:bg-gray-200'
      }`}
    >
      {children}
    </button>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer py-1">
      <span className="text-[15px] text-gray-900">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative w-[51px] h-[31px] rounded-full transition ${
          checked ? 'bg-green-500' : 'bg-gray-300'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-[27px] h-[27px] bg-white rounded-full shadow transition ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </label>
  )
}
