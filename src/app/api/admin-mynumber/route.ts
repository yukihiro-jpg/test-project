import { NextRequest, NextResponse } from 'next/server'
import { getClientDynamic } from '@/lib/clients'
import {
  listSubFoldersInDrive,
  readJsonFromFolder,
} from '@/lib/client-registry'
import { decryptSensitive } from '@/lib/crypto-util'
import type { ConfirmedEmployeeInfo } from '@/lib/employee-data'

/**
 * 管理者向け: 特定従業員のマイナンバー（復号済み）を取得
 * GET /api/admin-mynumber?client=712&year=R8&employeeName=山田太郎
 *
 * ※ middleware.ts で認証済みの前提
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const clientCode = searchParams.get('client')
  const yearId = searchParams.get('year')
  const employeeName = searchParams.get('employeeName')

  if (!clientCode || !yearId || !employeeName) {
    return NextResponse.json(
      { error: 'client, year, employeeName は必須です' },
      { status: 400 }
    )
  }

  const client = await getClientDynamic(yearId, clientCode)
  if (!client) {
    return NextResponse.json({ error: '会社が見つかりません' }, { status: 404 })
  }

  // 従業員フォルダを探す
  const folders = await listSubFoldersInDrive(client.driveFolderId)
  const target = folders.find(
    (f) => f.name === employeeName || f.name === `【本年入社】${employeeName}`,
  )

  if (!target) {
    return NextResponse.json({ error: '従業員フォルダが見つかりません' }, { status: 404 })
  }

  const info = await readJsonFromFolder<ConfirmedEmployeeInfo>(target.id, '_confirmed_info.json')
  if (!info || !info.newHireDeclaration) {
    return NextResponse.json({ error: 'マイナンバー情報がありません' }, { status: 404 })
  }

  const d = info.newHireDeclaration
  return NextResponse.json({
    employeeName,
    personal: {
      name: `${d.personal.lastName}　${d.personal.firstName}`,
      myNumber: decryptSensitive(d.personal.myNumber),
    },
    spouse: d.spouse
      ? {
          name: `${d.spouse.lastName}　${d.spouse.firstName}`,
          myNumber: decryptSensitive(d.spouse.myNumber),
        }
      : null,
    dependents: d.dependents.map((dep) => ({
      name: `${dep.lastName}　${dep.firstName}`,
      relationship: dep.relationToEmployee,
      myNumber: decryptSensitive(dep.myNumber),
    })),
  })
}
