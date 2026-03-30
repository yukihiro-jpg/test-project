import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { Readable } from 'stream'
import { getClient } from '@/lib/clients'
import { getFiscalYear } from '@/lib/fiscal-year'
import { findOrCreateFolder } from '@/lib/google-drive'
import type { EmployeeData } from '@/lib/employee-data'

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/drive'],
  })
}

async function loadEmployeeData(
  clientFolderId: string,
  yearLabel: string
): Promise<EmployeeData[]> {
  const drive = google.drive({ version: 'v3', auth: getAuth() })
  const driveId = process.env.GOOGLE_SHARED_DRIVE_ID

  const yearFolderId = await findOrCreateFolder(clientFolderId, yearLabel)

  const searchRes = await drive.files.list({
    q: `'${yearFolderId}' in parents and name = '_employee_data.json' and trashed = false`,
    fields: 'files(id)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    ...(driveId ? { driveId, corpora: 'drive' } : {}),
  })

  if (!searchRes.data.files || searchRes.data.files.length === 0) {
    return []
  }

  const fileId = searchRes.data.files[0].id!
  const res = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'text' }
  )

  return JSON.parse(res.data as string) as EmployeeData[]
}

/**
 * 従業員の氏名一覧を返す（個人情報は含まない）
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('client')
  const yearId = searchParams.get('year')

  if (!clientId || !yearId) {
    return NextResponse.json({ error: 'client と year は必須です' }, { status: 400 })
  }

  const client = getClient(clientId)
  if (!client) {
    return NextResponse.json({ error: '顧問先が見つかりません' }, { status: 404 })
  }

  const fiscalYear = getFiscalYear(yearId)
  if (!fiscalYear) {
    return NextResponse.json({ error: '無効な年度です' }, { status: 400 })
  }

  try {
    const employees = await loadEmployeeData(client.driveFolderId, fiscalYear.label)

    // 氏名とコードのみ返す（個人情報は含めない）
    const nameList = employees.map((e) => ({
      code: e.code,
      name: e.name,
    }))

    return NextResponse.json({ employees: nameList })
  } catch {
    return NextResponse.json({ employees: [] })
  }
}
