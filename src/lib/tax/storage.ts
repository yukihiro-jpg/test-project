'use client'

export type EmployeeKind = 'koyo_otsu' | 'hostess'

export type Employee = {
  id: string
  name: string
  furigana: string
  address: string
  birthday: string // YYYY-MM-DD
  memo: string
  kind: EmployeeKind
  createdAt: number
}

export type TaxAccountant = {
  id: string
  name: string
  amount: number
  paymentMonths: number[] // [1..12]
  createdAt: number
}

// 日別の支払（乙欄/ホステス共通）
export type DailyPayment = {
  id: string
  employeeId: string
  date: string // YYYY-MM-DD
  amount: number
}

export type PayerInfo = {
  address: string
  name: string
  phone: string
  taxOffice: string
  taxOfficeNumber: string
  seiriNumber: string
  payerNumber: string
  noukiTokurei: boolean
}

export type Store = {
  employees: Employee[]
  accountants: TaxAccountant[]
  dailyPayments: DailyPayment[]
  payer: PayerInfo
}

const empty: Store = {
  employees: [],
  accountants: [],
  dailyPayments: [],
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
}

function normalize(parsed: unknown): Store {
  if (!parsed || typeof parsed !== 'object') return empty
  const p = parsed as Partial<Store>
  return {
    ...empty,
    ...p,
    employees: (p.employees || []).map(e => ({
      ...e,
      furigana: e.furigana ?? '',
      address: e.address ?? '',
      birthday: e.birthday ?? '',
      memo: e.memo ?? '',
    })),
    accountants: p.accountants || [],
    dailyPayments: p.dailyPayments || [],
    payer: { ...empty.payer, ...(p.payer || {}) },
  }
}

export async function load(): Promise<Store> {
  if (typeof window === 'undefined') return empty
  try {
    const res = await fetch('/api/store', { cache: 'no-store' })
    if (!res.ok) return empty
    const data = await res.json()
    return normalize(data)
  } catch {
    return empty
  }
}

export async function save(store: Store): Promise<void> {
  await fetch('/api/store', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(store),
  })
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export function ymKey(year: number, month: number) {
  return `${year}-${month}`
}
