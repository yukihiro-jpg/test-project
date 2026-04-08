import { NextRequest, NextResponse } from 'next/server'
import { listAllLocks } from '@/lib/rate-limit'
import { getAllClientsDynamic } from '@/lib/clients'
import { loadEmployeeDataFromDrive } from '@/lib/client-registry'

/**
 * 管理者向け: 現在ロック中の従業員一覧を取得
 * GET /api/admin-locks?year=R8
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const yearId = searchParams.get('year')
  if (!yearId) {
    return NextResponse.json({ error: 'year は必須です' }, { status: 400 })
  }

  try {
    const locks = await listAllLocks(yearId)
    if (locks.length === 0) return NextResponse.json({ locks: [] })

    // 会社名・従業員名を取得
    const clients = await getAllClientsDynamic(yearId)
    const clientMap = new Map(clients.map((c) => [c.code, c]))

    const enrichedLocks = await Promise.all(
      locks.map(async (lock) => {
        const client = clientMap.get(lock.clientCode)
        if (!client) {
          return {
            ...lock,
            clientName: '(不明)',
            employeeName: '(不明)',
          }
        }
        const employees = await loadEmployeeDataFromDrive(client.driveFolderId)
        const employee = employees.find((e) => e.code === lock.employeeCode)
        return {
          ...lock,
          clientName: client.name,
          employeeName: employee?.name || '(不明)',
        }
      }),
    )

    return NextResponse.json({ locks: enrichedLocks })
  } catch (err) {
    console.error('admin-locks error:', err)
    return NextResponse.json({ error: 'ロック情報取得エラー' }, { status: 500 })
  }
}
