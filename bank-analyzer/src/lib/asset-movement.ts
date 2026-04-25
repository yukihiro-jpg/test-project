import type { AssetMovementRow, AssetMovementTable, ParsedPassbook, Transaction } from '@/types'
import { isAtmDescription } from './atm-keywords'
import { parseLooseDate } from './wareki'

const THRESHOLD = 500_000
const TRANSFER_DATE_TOLERANCE_DAYS = 5

type Indexed = {
  passbookId: string
  passbookLabel: string
  tx: Transaction
}

function diffDays(a: string, b: string): number {
  const da = parseLooseDate(a)
  const db = parseLooseDate(b)
  if (!da || !db) return Number.POSITIVE_INFINITY
  return Math.abs(da.getTime() - db.getTime()) / (1000 * 60 * 60 * 24)
}

function txAmount(tx: Transaction): number {
  return Math.max(tx.deposit, tx.withdrawal)
}

function buildRow(
  date: string,
  passbookOrder: string[],
  entries: Indexed[],
  atmKeywords: string[],
  isFundTransfer: boolean
): AssetMovementRow {
  const passbookEntries: Record<string, { deposit: number; withdrawal: number }> = {}
  for (const id of passbookOrder) {
    passbookEntries[id] = { deposit: 0, withdrawal: 0 }
  }
  for (const e of entries) {
    const slot = passbookEntries[e.passbookId]
    slot.deposit += e.tx.deposit
    slot.withdrawal += e.tx.withdrawal
  }

  let remarks = ''
  let conclusionAmount = 0

  if (isFundTransfer) {
    remarks = '資金移動'
    conclusionAmount = 0
  } else {
    const tx = entries[0].tx
    const desc = (tx.description || '').trim()
    if (isAtmDescription(desc, atmKeywords) || desc === '') {
      remarks = '不明金'
      conclusionAmount = -tx.withdrawal + tx.deposit
    } else {
      remarks = desc
      conclusionAmount = 0
    }
  }

  return {
    id: `row-${entries.map((e) => e.tx.id).join('|')}`,
    date,
    passbookEntries,
    conclusionAmount,
    remarks,
    isFundTransfer,
    sourceTransactionIds: entries.map((e) => e.tx.id)
  }
}

export type BuildOptions = {
  manualIncludes?: Set<string>
  manualExcludes?: Set<string>
  manualOverrides?: Record<string, Partial<AssetMovementRow>>
}

export function buildAssetMovementTable(
  passbooks: ParsedPassbook[],
  atmKeywords: string[],
  options: BuildOptions = {}
): AssetMovementTable {
  const passbookOrder = passbooks.map((p) => p.passbookId)
  const manualIncludes = options.manualIncludes ?? new Set<string>()
  const manualExcludes = options.manualExcludes ?? new Set<string>()
  const manualOverrides = options.manualOverrides ?? {}

  const allTx: Indexed[] = []
  for (const p of passbooks) {
    for (const tx of p.transactions) {
      allTx.push({ passbookId: p.passbookId, passbookLabel: p.label, tx })
    }
  }

  const isAutoEligible = (idx: Indexed) => {
    const desc = (idx.tx.description || '').trim()
    return txAmount(idx.tx) >= THRESHOLD && (isAtmDescription(desc, atmKeywords) || desc === '')
  }

  const candidates = allTx.filter((e) => {
    if (manualIncludes.has(e.tx.id)) return true
    if (manualExcludes.has(e.tx.id)) return false
    return isAutoEligible(e)
  })

  const used = new Set<string>()
  const rows: AssetMovementRow[] = []

  for (let i = 0; i < candidates.length; i++) {
    const a = candidates[i]
    if (used.has(a.tx.id)) continue
    if (a.tx.withdrawal <= 0) continue

    let pair: Indexed | undefined
    for (let j = 0; j < candidates.length; j++) {
      const b = candidates[j]
      if (used.has(b.tx.id)) continue
      if (b.tx.id === a.tx.id) continue
      if (b.passbookId === a.passbookId) continue
      if (b.tx.deposit <= 0) continue
      if (b.tx.deposit !== a.tx.withdrawal) continue
      if (diffDays(a.tx.date, b.tx.date) > TRANSFER_DATE_TOLERANCE_DAYS) continue
      pair = b
      break
    }

    if (pair) {
      used.add(a.tx.id)
      used.add(pair.tx.id)
      rows.push(buildRow(a.tx.date, passbookOrder, [a, pair], atmKeywords, true))
    }
  }

  for (const e of candidates) {
    if (used.has(e.tx.id)) continue
    used.add(e.tx.id)
    rows.push(buildRow(e.tx.date, passbookOrder, [e], atmKeywords, false))
  }

  rows.sort((a, b) => {
    const da = parseLooseDate(a.date)?.getTime() ?? 0
    const db = parseLooseDate(b.date)?.getTime() ?? 0
    return da - db
  })

  for (const row of rows) {
    const override = manualOverrides[row.id]
    if (override) {
      Object.assign(row, override)
    }
  }

  return { passbookOrder, rows }
}
