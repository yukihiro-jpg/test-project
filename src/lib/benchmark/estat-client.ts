/**
 * e-Stat API クライアント
 *
 * 「法人企業統計調査」（財務省）の業界平均データを取得する。
 * https://www.e-stat.go.jp/stat-search/files?tclass=000001152094
 *
 * 認証: APP_ID（無料登録、発行に数日）
 * 無料枠内で運用可能。
 */

const BASE_URL = 'https://api.e-stat.go.jp/rest/3.0/app/json'

export interface EStatStatsData {
  statsDataId: string
  statInfId: string
  // その他のフィールドは利用する統計表に応じて追加
}

/**
 * 統計表 ID から統計データを取得
 * @param statsDataId 例: "0003060791"（法人企業統計 四半期別調査）
 */
export async function getStatsData(statsDataId: string, params: Record<string, string> = {}) {
  const appId = process.env.ESTAT_APP_ID
  if (!appId) throw new Error('ESTAT_APP_ID が未設定です')

  const qs = new URLSearchParams({ appId, statsDataId, ...params })
  const url = `${BASE_URL}/getStatsData?${qs.toString()}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`e-Stat API error: ${res.status}`)
  return res.json()
}

/**
 * 統計表の検索
 */
export async function searchStatsList(searchWord: string) {
  const appId = process.env.ESTAT_APP_ID
  if (!appId) throw new Error('ESTAT_APP_ID が未設定です')

  const qs = new URLSearchParams({ appId, searchWord })
  const url = `${BASE_URL}/getStatsList?${qs.toString()}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`e-Stat API error: ${res.status}`)
  return res.json()
}
