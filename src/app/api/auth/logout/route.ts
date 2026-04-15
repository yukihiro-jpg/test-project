/**
 * ログアウト
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCookieName } from '@/lib/auth/session'

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/login', request.url), { status: 303 })
  response.cookies.delete(getCookieName())
  return response
}
