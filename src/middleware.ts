/**
 * 認証ミドルウェア
 *
 * 全ページへのアクセスを Google ログインで保護する。
 * ログイン・コールバック・静的アセットは認証対象外。
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCookieName, verifySession } from '@/lib/auth/session'

// middleware が動作する対象パス
export const config = {
  matcher: [
    '/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)',
  ],
}

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(getCookieName())?.value

  // SESSION_SECRET 未設定の場合は verifySession が例外を投げる。
  // 開発環境セットアップ前の画面確認を通すため、例外は握りつぶしてログイン画面に逃がす。
  let session = null
  if (token) {
    try {
      session = await verifySession(token)
    } catch {
      session = null
    }
  }

  // 許可メールアドレスかチェック
  const allowedEmail = process.env.ALLOWED_EMAIL
  if (!session || (allowedEmail && session.email !== allowedEmail)) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  // セッション情報をヘッダに載せて API に渡す
  const response = NextResponse.next()
  response.headers.set('x-user-email', session.email)
  return response
}
