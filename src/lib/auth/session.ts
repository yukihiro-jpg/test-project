/**
 * セッション管理
 *
 * HMAC 署名付き Cookie でセッションを管理する。
 * Google OAuth で認証済みのメールアドレスを Cookie に署名付きで保存し、
 * ミドルウェアで検証する。
 *
 * Edge Runtime（Next.js middleware）でも動作するよう Web Crypto API を使用。
 */

const COOKIE_NAME = 'financial_report_session'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7日間

export interface SessionPayload {
  email: string
  issuedAt: number
  expiresAt: number
}

export async function createSession(email: string): Promise<string> {
  const now = Date.now()
  const payload: SessionPayload = {
    email,
    issuedAt: now,
    expiresAt: now + COOKIE_MAX_AGE * 1000,
  }
  const payloadJson = JSON.stringify(payload)
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(payloadJson))
  const signature = await sign(payloadB64)
  return `${payloadB64}.${signature}`
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  const [payloadB64, signature] = token.split('.')
  if (!payloadB64 || !signature) return null

  const expectedSig = await sign(payloadB64)
  if (!timingSafeEqual(signature, expectedSig)) return null

  try {
    const payloadJson = new TextDecoder().decode(base64UrlDecode(payloadB64))
    const payload = JSON.parse(payloadJson) as SessionPayload
    if (payload.expiresAt < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

export function getCookieName(): string {
  return COOKIE_NAME
}

export function getCookieMaxAge(): number {
  return COOKIE_MAX_AGE
}

// -----------------------------------------------------------------------------
// 内部実装（Web Crypto API）
// -----------------------------------------------------------------------------

async function sign(data: string): Promise<string> {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('SESSION_SECRET が設定されていません')

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sigBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  return base64UrlEncode(new Uint8Array(sigBuffer))
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function base64UrlDecode(s: string): Uint8Array {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (4 - (s.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return result === 0
}
