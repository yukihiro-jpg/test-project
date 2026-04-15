/**
 * リクエストから外部に公開されている URL を取得するユーティリティ
 *
 * Codespace やプロキシ経由では request.url が内部 URL（例: localhost:3000）に
 * なってしまいリダイレクトが失敗する。
 * 優先順位:
 *   1. NEXT_PUBLIC_APP_URL（明示的に設定されていればこれを信頼）
 *   2. x-forwarded-proto / x-forwarded-host ヘッダ
 *   3. request.url
 */
export function getPublicBaseUrl(request: Request): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL
  if (envUrl) return envUrl.replace(/\/$/, '')

  const proto = request.headers.get('x-forwarded-proto')
  const host = request.headers.get('x-forwarded-host')
  if (proto && host) return `${proto}://${host}`

  return new URL(request.url).origin
}

/**
 * 公開 URL を基準に相対パスから絶対 URL を作る
 */
export function publicUrl(path: string, request: Request): URL {
  return new URL(path, getPublicBaseUrl(request))
}
