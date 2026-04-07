/**
 * 郵便番号 → 住所 の自動取得（zipcloud API）
 *
 * 無料の公開APIを利用して、7桁の郵便番号から住所（都道府県+市区町村+町域）を取得する。
 * https://zipcloud.ibsnet.co.jp/doc/api
 *
 * APIがダウンしていたり通信エラーが発生した場合は null を返し、
 * 呼び出し側は静かに失敗するよう設計する（ユーザーには何も通知しない）。
 */

const ZIPCLOUD_URL = 'https://zipcloud.ibsnet.co.jp/api/search'

export interface PostalCodeResult {
  prefecture: string // 都道府県 (例: "茨城県")
  city: string // 市区町村 (例: "小美玉市")
  town: string // 町域 (例: "下吉影")
  fullAddress: string // 連結済み (例: "茨城県小美玉市下吉影")
}

/**
 * 郵便番号から住所を引く。
 * - 入力はハイフン・空白入りでもOK（自動で除去）
 * - 7桁の数字でない場合は null
 * - API呼び出しが失敗した場合も null（静かに失敗）
 */
export async function lookupPostalCode(
  input: string,
): Promise<PostalCodeResult | null> {
  const zipcode = input.replace(/[^\d]/g, '')
  if (zipcode.length !== 7) return null

  try {
    const res = await fetch(`${ZIPCLOUD_URL}?zipcode=${zipcode}`, {
      method: 'GET',
    })

    if (!res.ok) return null

    const data = (await res.json()) as {
      status: number
      results?: Array<{
        address1: string
        address2: string
        address3: string
      }>
    }

    if (data.status !== 200 || !data.results || data.results.length === 0) {
      return null
    }

    const first = data.results[0]
    const prefecture = first.address1 || ''
    const city = first.address2 || ''
    const town = first.address3 || ''
    const fullAddress = `${prefecture}${city}${town}`

    return { prefecture, city, town, fullAddress }
  } catch {
    return null
  }
}
