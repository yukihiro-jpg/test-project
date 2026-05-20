'use client'

export type EmployeeKind = 'koyo_otsu' | 'hostess' | 'zeirishi'

export type Employee = {
  id: string
  name: string
  kind: EmployeeKind
  createdAt: number
}

export type PayrollEntry = {
  id: string
  employeeId: string
  year: number
  month: number
  amount: number // 月額（給与/ホステス支払/税理士月額顧問料）
  spotAmount?: number // 税理士のスポット報酬等
  days?: number
  socialInsurance?: number
  manualTaxOverride?: number | null
}

export type PayerInfo = {
  address: string
  name: string
  phone: string
  taxOffice: string
  taxOfficeNumber: string
  seiriNumber: string
  payerNumber: string
  noukiTokurei: boolean // 納期の特例 を選択しているか
}

const KEY = 'tax-app-v1'

type Store = {
  employees: Employee[]
  payroll: PayrollEntry[]
  payer: PayerInfo
  paymentDates: { [yearMonth: string]: string } // "YYYY-M" -> "YYYY-MM-DD"
}

const empty: Store = {
  employees: [],
  payroll: [],
  payer: {
    address: '',
    name: '',
    phone: '',
    taxOffice: '',
    taxOfficeNumber: '',
    seiriNumber: '',
    payerNumber: '',
    noukiTokurei: false,
  },
  paymentDates: {},
}

export function load(): Store {
  if (typeof window === 'undefined') return empty
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return empty
    const parsed = JSON.parse(raw)
    return {
      ...empty,
      ...parsed,
      payer: { ...empty.payer, ...(parsed.payer || {}) },
      paymentDates: { ...empty.paymentDates, ...(parsed.paymentDates || {}) },
    }
  } catch {
    return empty
  }
}

export function save(store: Store) {
  localStorage.setItem(KEY, JSON.stringify(store))
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export function ymKey(year: number, month: number) {
  return `${year}-${month}`
}
