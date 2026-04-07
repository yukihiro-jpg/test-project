import { NextRequest, NextResponse } from 'next/server'
import { getClientDynamic } from '@/lib/clients'
import { loadEmployeeDataFromDrive } from '@/lib/client-registry'

/**
 * 従業員の氏名一覧を返す（個人情報は含まない）
 * フリガナ順でソート
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const clientCode = searchParams.get('client')
  const yearId = searchParams.get('year')

  if (!clientCode || !yearId) {
    return NextResponse.json({ error: 'client と year は必須です' }, { status: 400 })
  }

  const client = await getClientDynamic(yearId, clientCode)
  if (!client) {
    return NextResponse.json({ error: '顧問先が見つかりません' }, { status: 404 })
  }

  try {
    const employees = await loadEmployeeDataFromDrive(client.driveFolderId)

    // フリガナ順でソート（フリガナがない場合は氏名順）
    const sorted = [...employees].sort((a, b) => {
      const keyA = (a.furigana || a.name || '').trim()
      const keyB = (b.furigana || b.name || '').trim()
      return keyA.localeCompare(keyB, 'ja')
    })

    const nameList = sorted.map((e) => ({
      code: e.code,
      name: e.name,
    }))

    return NextResponse.json({ employees: nameList })
  } catch {
    return NextResponse.json({ employees: [] })
  }
}
