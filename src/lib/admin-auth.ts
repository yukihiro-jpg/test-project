/**
 * 管理画面の認証ミドルウェア
 *
 * ADMIN_PASSWORD 環境変数に設定されたパスワードでクッキー認証を行う。
 * - Cookie名: admin_auth
 * - 値: HMAC-SHA256(password, "admin-auth") の hex
 * - 有効期限: 30日
 *
 * Edge Runtime（middleware）と Node.js Runtime（API route）の両方で
 * 動作するよう、Web Crypto API (crypto.subtle) を使用。
 */

import { NextRequest, NextResponse } from 'next/server'

const COOKIE_NAME = 'admin_auth'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30日

/**
 * Web Crypto APIでHMAC-SHA256を計算しhex文字列を返す
 */
async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyBuffer = encoder.encode(key)
  const messageBuffer = encoder.encode(message)

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageBuffer)
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * パスワードから認証トークンを生成
 */
export async function generateAuthToken(password: string): Promise<string> {
  return hmacSha256Hex(password, 'admin-auth')
}

/**
 * 現在のCookieが有効な認証トークンかチェック
 */
export async function isAuthenticated(request: NextRequest): Promise<boolean> {
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) {
    // パスワード未設定の場合は認証をスキップ（開発時用）
    return true
  }

  const cookie = request.cookies.get(COOKIE_NAME)
  if (!cookie) return false

  const expectedToken = await generateAuthToken(adminPassword)
  return cookie.value === expectedToken
}

/**
 * 認証Cookieをレスポンスに付与
 */
export async function setAuthCookie(
  response: NextResponse,
  password: string,
): Promise<NextResponse> {
  const token = await generateAuthToken(password)
  response.cookies.set({
    name: COOKIE_NAME,
    value: token,
    maxAge: COOKIE_MAX_AGE,
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
  })
  return response
}

/**
 * パスワードが正しいか検証（定数時間比較）
 */
export function verifyPassword(input: string): boolean {
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) return true
  if (input.length !== adminPassword.length) return false

  // 定数時間比較（タイミング攻撃対策）
  let result = 0
  for (let i = 0; i < input.length; i++) {
    result |= input.charCodeAt(i) ^ adminPassword.charCodeAt(i)
  }
  return result === 0
}
