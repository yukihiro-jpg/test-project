/**
 * Google OAuth コールバック
 *
 * state を検証し、code をトークンに交換し、ユーザーのメールを取得して
 * 許可リストと照合。OK ならセッション Cookie を発行して元のページに戻す。
 */

import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForTokens, getUserEmail } from '@/lib/auth/google-oauth'
import { publicUrl } from '@/lib/auth/public-url'
import { createSession, getCookieMaxAge, getCookieName } from '@/lib/auth/session'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const stateParam = request.nextUrl.searchParams.get('state')

  if (!code || !stateParam) {
    return NextResponse.redirect(publicUrl('/login?error=invalid_callback', request))
  }

  let from = '/'
  try {
    const state = JSON.parse(Buffer.from(stateParam, 'base64url').toString('utf-8'))
    from = typeof state.from === 'string' ? state.from : '/'
  } catch {
    return NextResponse.redirect(publicUrl('/login?error=invalid_state', request))
  }

  try {
    const tokens = await exchangeCodeForTokens(code)
    if (!tokens.access_token) {
      return NextResponse.redirect(publicUrl('/login?error=no_token', request))
    }
    const email = await getUserEmail(tokens.access_token)
    if (!email) {
      return NextResponse.redirect(publicUrl('/login?error=no_email', request))
    }

    const allowedEmail = process.env.ALLOWED_EMAIL
    if (allowedEmail && email !== allowedEmail) {
      return NextResponse.redirect(publicUrl('/login?error=not_allowed', request))
    }

    const sessionToken = await createSession(email)
    const response = NextResponse.redirect(publicUrl(from, request))
    response.cookies.set(getCookieName(), sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: getCookieMaxAge(),
      path: '/',
    })
    return response
  } catch (err) {
    console.error('OAuth callback error:', err)
    return NextResponse.redirect(publicUrl('/login?error=oauth_failed', request))
  }
}
