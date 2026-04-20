import { getSelectedClientId } from './client-store'

export interface ProcessingStatus {
  accountCode: string
  accountName: string
  lastDate: string       // YYYYMMDD の最終取引日
  lastUpdated: string    // ISO タイムスタンプ（この状態が更新された日時）
  transactionCount?: number
}

function getKey(): string {
  const cid = getSelectedClientId()
  return cid ? `bank-statement-client-${cid}-processing-status` : 'bank-statement-processing-status'
}

export function getProcessingStatuses(): ProcessingStatus[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(getKey())
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return []
}

export function saveProcessingStatuses(statuses: ProcessingStatus[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(getKey(), JSON.stringify(statuses))
}

/**
 * 1つの科目の最終処理日を更新。既存より新しい日付の場合のみ上書き。
 */
export function updateProcessingStatus(
  accountCode: string,
  accountName: string,
  dates: string[],
  transactionCount?: number,
): void {
  if (!accountCode || dates.length === 0) return
  const latestDate = dates.reduce((a, b) => (a > b ? a : b))
  const statuses = getProcessingStatuses()
  const idx = statuses.findIndex((s) => s.accountCode === accountCode)
  const now = new Date().toISOString()
  if (idx >= 0) {
    // 新しい日付の場合のみ上書き
    if (latestDate > statuses[idx].lastDate) {
      statuses[idx] = { accountCode, accountName, lastDate: latestDate, lastUpdated: now, transactionCount }
    } else {
      // 日付が同じ or 古い場合でも、科目名・更新日時・件数は最新に
      statuses[idx].accountName = accountName || statuses[idx].accountName
      statuses[idx].lastUpdated = now
      if (transactionCount != null) statuses[idx].transactionCount = transactionCount
    }
  } else {
    statuses.push({ accountCode, accountName, lastDate: latestDate, lastUpdated: now, transactionCount })
  }
  saveProcessingStatuses(statuses)
}

// YYYYMMDD → YYYY/MM/DD
export function formatLastDate(yyyymmdd: string): string {
  if (!yyyymmdd || yyyymmdd.length !== 8) return yyyymmdd
  return `${yyyymmdd.slice(0, 4)}/${yyyymmdd.slice(4, 6)}/${yyyymmdd.slice(6, 8)}`
}
