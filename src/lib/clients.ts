/**
 * 顧問先（法人）管理 - 動的クライアントルックアップ
 *
 * 顧問先情報はGoogle Driveの年度フォルダ内 _clients.json から動的に読み込む。
 */

import { getFiscalYear } from './fiscal-year'
import { getOrCreateYearFolder, loadClients } from './client-registry'

export interface Client {
  code: string
  name: string
  driveFolderId: string
}

export function getClientFolderName(code: string, name: string): string {
  return `${code}_${name}`
}

/**
 * 年度を指定してクライアントを動的に取得
 */
export async function getClientDynamic(
  yearId: string,
  clientCode: string
): Promise<Client | null> {
  const fiscalYear = getFiscalYear(yearId)
  if (!fiscalYear) return null

  const yearFolderId = await getOrCreateYearFolder(fiscalYear.label)
  const clients = await loadClients(yearFolderId)
  return clients.find((c) => c.code === clientCode) ?? null
}

/**
 * 年度を指定して全クライアントを動的に取得
 */
export async function getAllClientsDynamic(yearId: string): Promise<Client[]> {
  const fiscalYear = getFiscalYear(yearId)
  if (!fiscalYear) return []

  const yearFolderId = await getOrCreateYearFolder(fiscalYear.label)
  return loadClients(yearFolderId)
}
