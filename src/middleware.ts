import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/admin-auth'

/**
 * 管理系ページ・APIへのアクセスを認証で保護する
 *
 * 保護対象:
 * - /admin (管理画面)
 * - /api/register-company (会社登録)
 * - /api/clients (全クライアント一覧: year指定なしの場合)
 * - /api/download-zip (全PDF一括ダウンロード)
 * - /api/qrcode-pdf (QRコードPDF)
 * - /api/admin-* (管理系API)
 *
 * 従業員向けAPIは認証不要:
 * - /upload
 * - /api/employees
 * - /api/verify-employee
 * - /api/upload
 * - /api/qrcode
 */
export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // ログインAPI自体は認証不要（これがないとログインできない）
  if (pathname === '/api/admin-login') {
    return NextResponse.next()
  }

  // 管理画面
  if (pathname.startsWith('/admin')) {
    if (!isAuthenticated(request)) {
      const loginUrl = new URL('/admin-login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  // 管理系API
  const protectedApiPaths = [
    '/api/register-company',
    '/api/download-zip',
    '/api/qrcode-pdf',
    '/api/admin-mynumber',
    '/api/admin-locks',
    '/api/admin-unlock',
  ]
  if (protectedApiPaths.some((p) => pathname.startsWith(p))) {
    if (!isAuthenticated(request)) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/register-company/:path*',
    '/api/download-zip/:path*',
    '/api/qrcode-pdf/:path*',
    '/api/admin-mynumber/:path*',
    '/api/admin-locks/:path*',
    '/api/admin-unlock/:path*',
  ],
}
