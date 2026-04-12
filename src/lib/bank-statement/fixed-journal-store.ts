import { getSelectedClientId, clientStorageKey } from './client-store'

export interface FixedJournalEntry {
  id: string
  debitCode: string
  debitName: string
  creditCode: string
  creditName: string
  taxType: string
  amount: number
  description: string
}

function getKey(): string {
  const cid = getSelectedClientId()
  return cid ? `bs-fixed-journals-${cid}` : 'bs-fixed-journals'
}

export function getFixedJournals(): FixedJournalEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(getKey())
    if (stored) return JSON.parse(stored)
  } catch { /* ignore */ }
  return []
}

export function saveFixedJournals(items: FixedJournalEntry[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(getKey(), JSON.stringify(items))
}

export function addFixedJournal(entry: Omit<FixedJournalEntry, 'id'>): FixedJournalEntry {
  const items = getFixedJournals()
  const newItem: FixedJournalEntry = {
    ...entry,
    id: `fj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  }
  items.push(newItem)
  saveFixedJournals(items)
  return newItem
}

export function deleteFixedJournal(id: string): void {
  const items = getFixedJournals().filter((i) => i.id !== id)
  saveFixedJournals(items)
}
