import { NextRequest, NextResponse } from 'next/server'
import { verifyPassword, setAuthCookie } from '@/lib/admin-auth'

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json()

    if (typeof password !== 'string' || !password) {
      return NextResponse.json({ error: 'パスワードを入力してください' }, { status: 400 })
    }

    if (!verifyPassword(password)) {
      return NextResponse.json({ error: 'パスワードが正しくありません' }, { status: 401 })
    }

    const response = NextResponse.json({ success: true })
    return setAuthCookie(response, password)
  } catch {
    return NextResponse.json({ error: 'ログイン処理中にエラーが発生しました' }, { status: 500 })
  }
}
