import { NextRequest, NextResponse } from 'next/server'
import { manualUnlock } from '@/lib/rate-limit'

/**
 * 管理者向け: 特定従業員のロックを手動解除
 * POST /api/admin-unlock
 * Body: { yearId, clientCode, employeeCode }
 */
export async function POST(request: NextRequest) {
  try {
    const { yearId, clientCode, employeeCode } = await request.json()

    if (!yearId || !clientCode || !employeeCode) {
      return NextResponse.json(
        { error: 'yearId, clientCode, employeeCode は必須です' },
        { status: 400 },
      )
    }

    await manualUnlock(yearId, clientCode, employeeCode)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('admin-unlock error:', err)
    return NextResponse.json({ error: 'ロック解除に失敗しました' }, { status: 500 })
  }
}
