/**
 * 管理画面の認証ミドルウェア
 *
 * ADMIN_PASSWORD 環境変数に設定されたパスワードでクッキー認証を行う。
 * - Cookie名: admin_auth
 * - 値: HMAC-SHA256(password, secret) の hex
 * - 有効期限: 30日
 */

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

const COOKIE_NAME = 'admin_auth'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30日

/**
 * パスワードから認証トークンを生成
 * HMAC-SHA256 でハッシュ化。秘密鍵は ADMIN_PASSWORD 自身を使う（シンプル化）。
 */
export function generateAuthToken(password: string): string {
  return crypto.createHmac('sha256', password).update('admin-auth').digest('hex')
}

/**
 * 現在のCookieが有効な認証トークンかチェック
 */
export function isAuthenticated(request: NextRequest): boolean {
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) {
    // パスワード未設定の場合は認証をスキップ（開発時用）
    return true
  }

  const cookie = request.cookies.get(COOKIE_NAME)
  if (!cookie) return false

  const expectedToken = generateAuthToken(adminPassword)
  return cookie.value === expectedToken
}

/**
 * 認証Cookieをレスポンスに付与
 */
export function setAuthCookie(response: NextResponse, password: string): NextResponse {
  const token = generateAuthToken(password)
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
 * パスワードが正しいか検証
 */
export function verifyPassword(input: string): boolean {
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) return true
  // タイミング攻撃対策
  try {
    const a = Buffer.from(input)
    const b = Buffer.from(adminPassword)
    if (a.length !== b.length) return false
    return crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}
