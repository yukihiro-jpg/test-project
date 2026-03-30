import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
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
 * 氏名 + 生年月日で本人認証し、認証成功時のみ個人情報を返す
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { clientId, yearId, employeeCode, birthday } = body

    if (!clientId || !yearId || !employeeCode || !birthday) {
      return NextResponse.json(
        { error: '必須項目が不足しています' },
        { status: 400 }
      )
    }

    const client = getClient(clientId)
    if (!client) {
      return NextResponse.json({ error: '顧問先が見つかりません' }, { status: 404 })
    }

    const fiscalYear = getFiscalYear(yearId)
    if (!fiscalYear) {
      return NextResponse.json({ error: '無効な年度です' }, { status: 400 })
    }

    const employees = await loadEmployeeData(client.driveFolderId, fiscalYear.label)
    const employee = employees.find((e) => e.code === employeeCode)

    if (!employee) {
      return NextResponse.json(
        { error: '従業員が見つかりません' },
        { status: 404 }
      )
    }

    // 生年月日の照合（フォーマット正規化して比較）
    const normalizedInput = normalizeBirthday(birthday)
    const normalizedStored = normalizeBirthday(employee.birthday)

    if (normalizedInput !== normalizedStored) {
      return NextResponse.json(
        { error: '生年月日が一致しません' },
        { status: 401 }
      )
    }

    // 認証成功：個人情報を返す
    return NextResponse.json({
      verified: true,
      employee: {
        code: employee.code,
        name: employee.name,
        birthday: employee.birthday,
        address: employee.address,
        disability: employee.disability,
        widowSingleParent: employee.widowSingleParent,
        dependents: employee.dependents,
      },
    })
  } catch (error) {
    console.error('Verification error:', error)
    return NextResponse.json(
      { error: '認証中にエラーが発生しました' },
      { status: 500 }
    )
  }
}

/**
 * 生年月日を YYYYMMDD 形式に正規化
 * 対応フォーマット: "1990/01/15", "1990-01-15", "19900115", "H2.1.15" 等
 */
function normalizeBirthday(input: string): string {
  const cleaned = input.trim()

  // YYYY/MM/DD or YYYY-MM-DD
  const slashMatch = cleaned.match(/^(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})$/)
  if (slashMatch) {
    return `${slashMatch[1]}${slashMatch[2].padStart(2, '0')}${slashMatch[3].padStart(2, '0')}`
  }

  // YYYYMMDD
  const numMatch = cleaned.match(/^(\d{8})$/)
  if (numMatch) {
    return numMatch[1]
  }

  // 和暦対応: S, H, R + 年.月.日
  const warekiMatch = cleaned.match(/^([STHR])(\d{1,2})[./](\d{1,2})[./](\d{1,2})$/)
  if (warekiMatch) {
    const era = warekiMatch[1]
    const eraYear = parseInt(warekiMatch[2])
    const month = warekiMatch[3].padStart(2, '0')
    const day = warekiMatch[4].padStart(2, '0')

    let westernYear: number
    switch (era) {
      case 'R': westernYear = 2018 + eraYear; break
      case 'H': westernYear = 1988 + eraYear; break
      case 'S': westernYear = 1925 + eraYear; break
      case 'T': westernYear = 1911 + eraYear; break
      default: return cleaned
    }

    return `${westernYear}${month}${day}`
  }

  return cleaned
}
