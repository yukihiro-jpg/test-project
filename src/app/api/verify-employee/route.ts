import { NextRequest, NextResponse } from 'next/server'
import { getClientDynamic } from '@/lib/clients'
import { loadEmployeeDataFromDrive } from '@/lib/client-registry'

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

    const client = await getClientDynamic(yearId, clientId)
    if (!client) {
      return NextResponse.json({ error: '顧問先が見つかりません' }, { status: 404 })
    }

    const employees = await loadEmployeeDataFromDrive(client.driveFolderId)
    const employee = employees.find((e) => e.code === employeeCode)

    if (!employee) {
      return NextResponse.json(
        { error: '従業員が見つかりません' },
        { status: 404 }
      )
    }

    // 生年月日の照合
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
        furigana: employee.furigana,
        birthday: employee.birthday,
        gender: employee.gender,
        postalCode: employee.postalCode,
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
  if (numMatch) return numMatch[1]

  // 和暦: S37.7.5 / H2.1.15 / R1.5.1
  const warekiMatch = cleaned.match(/^([STHR])(\d{1,2})\.(\d{1,2})\.(\d{1,2})$/)
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
