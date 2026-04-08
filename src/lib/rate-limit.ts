/**
 * 本人確認の連続失敗ロック管理
 *
 * データは年度フォルダの _system/_rate_limit.json に保存する。
 *
 * ロックルール:
 * - 5回連続失敗: 1時間ロック
 * - 10回連続失敗: 24時間ロック
 * - 正解したらカウントリセット
 * - 管理画面から手動でロック解除可能
 */

import {
  readJsonFromFolder,
  writeJsonToFolder,
  getOrCreateSystemFolder,
  getOrCreateYearFolder,
} from './client-registry'
import { getFiscalYear } from './fiscal-year'

const RATE_LIMIT_FILE = '_rate_limit.json'

export interface RateLimitEntry {
  fails: number
  lastFailAt: string // ISO
  lockedUntil: string | null // ISO or null
}

export type RateLimitMap = Record<string, RateLimitEntry>

/**
 * キー: "{clientCode}:{employeeCode}"
 */
function makeKey(clientCode: string, employeeCode: string): string {
  return `${clientCode}:${employeeCode}`
}

async function loadMap(yearId: string): Promise<{ map: RateLimitMap; folderId: string }> {
  const fiscalYear = getFiscalYear(yearId)
  if (!fiscalYear) throw new Error('無効な年度です')
  const yearFolderId = await getOrCreateYearFolder(fiscalYear.label)
  const systemFolderId = await getOrCreateSystemFolder(yearFolderId)
  const map = (await readJsonFromFolder<RateLimitMap>(systemFolderId, RATE_LIMIT_FILE)) || {}
  return { map, folderId: systemFolderId }
}

async function saveMap(folderId: string, map: RateLimitMap): Promise<void> {
  await writeJsonToFolder(folderId, RATE_LIMIT_FILE, map)
}

/**
 * ロック状態をチェック。ロック中なら残り秒数を返す。
 */
export async function checkLock(
  yearId: string,
  clientCode: string,
  employeeCode: string,
): Promise<{ locked: boolean; remainingSeconds: number; fails: number }> {
  const { map } = await loadMap(yearId)
  const entry = map[makeKey(clientCode, employeeCode)]
  if (!entry) return { locked: false, remainingSeconds: 0, fails: 0 }

  if (entry.lockedUntil) {
    const lockedUntilMs = new Date(entry.lockedUntil).getTime()
    const now = Date.now()
    if (lockedUntilMs > now) {
      return {
        locked: true,
        remainingSeconds: Math.ceil((lockedUntilMs - now) / 1000),
        fails: entry.fails,
      }
    }
  }

  return { locked: false, remainingSeconds: 0, fails: entry.fails }
}

/**
 * 失敗を記録。必要ならロックする。
 */
export async function recordFailure(
  yearId: string,
  clientCode: string,
  employeeCode: string,
): Promise<{ locked: boolean; fails: number }> {
  const { map, folderId } = await loadMap(yearId)
  const key = makeKey(clientCode, employeeCode)
  const existing = map[key] || { fails: 0, lastFailAt: '', lockedUntil: null }
  const fails = existing.fails + 1

  let lockedUntil: string | null = null
  if (fails >= 10) {
    // 24時間ロック
    lockedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  } else if (fails >= 5) {
    // 1時間ロック
    lockedUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString()
  }

  map[key] = {
    fails,
    lastFailAt: new Date().toISOString(),
    lockedUntil,
  }
  await saveMap(folderId, map)
  return { locked: lockedUntil !== null, fails }
}

/**
 * 成功時にカウントをリセット
 */
export async function resetCount(
  yearId: string,
  clientCode: string,
  employeeCode: string,
): Promise<void> {
  const { map, folderId } = await loadMap(yearId)
  const key = makeKey(clientCode, employeeCode)
  if (map[key]) {
    delete map[key]
    await saveMap(folderId, map)
  }
}

/**
 * 管理画面から手動でロック解除
 */
export async function manualUnlock(
  yearId: string,
  clientCode: string,
  employeeCode: string,
): Promise<void> {
  await resetCount(yearId, clientCode, employeeCode)
}

/**
 * 全ロック状態を取得（管理画面表示用）
 */
export async function listAllLocks(
  yearId: string,
): Promise<Array<{ clientCode: string; employeeCode: string; entry: RateLimitEntry }>> {
  const { map } = await loadMap(yearId)
  const now = Date.now()
  return Object.entries(map)
    .filter(([, entry]) => {
      if (!entry.lockedUntil) return false
      return new Date(entry.lockedUntil).getTime() > now
    })
    .map(([key, entry]) => {
      const [clientCode, employeeCode] = key.split(':')
      return { clientCode, employeeCode, entry }
    })
}
