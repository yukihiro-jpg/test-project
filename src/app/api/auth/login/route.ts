/**
 * ログイン開始エンドポイント
 *
 * Google OAuth の認可 URL にリダイレクトする。
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthorizationUrl } from '@/lib/auth/google-oauth'

export async function GET(request: NextRequest) {
  const from = request.nextUrl.searchParams.get('from') || '/'
  // CSRF 対策: state にランダム値と戻り先を含める
  const state = Buffer.from(
    JSON.stringify({ nonce: crypto.randomUUID(), from }),
  ).toString('base64url')
  const url = getAuthorizationUrl(state)
  return NextResponse.redirect(url)
}
