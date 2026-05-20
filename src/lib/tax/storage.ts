'use client'

export type EmployeeKind = 'koyo_otsu' | 'hostess'

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
  amount: number
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
}

const KEY = 'tax-app-v1'

type Store = {
  employees: Employee[]
  payroll: PayrollEntry[]
  payer: PayerInfo
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
  },
}

export function load(): Store {
  if (typeof window === 'undefined') return empty
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return empty
    const parsed = JSON.parse(raw)
    return { ...empty, ...parsed, payer: { ...empty.payer, ...(parsed.payer || {}) } }
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
