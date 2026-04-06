import { NextRequest, NextResponse } from 'next/server'
import { getFiscalYear } from '@/lib/fiscal-year'
import { parseJdlCsv } from '@/lib/employee-data'
import {
  getOrCreateYearFolder,
  getOrCreateCompanyFolder,
  loadClients,
  saveClients,
  updateUrlSheet,
  writeJsonToFolder,
} from '@/lib/client-registry'

/**
 * 会社登録API
 * 年度フォルダ + 法人フォルダを作成し、CSVをパースして保存する
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const yearId = formData.get('yearId') as string
    const companyCode = formData.get('companyCode') as string
    const companyName = formData.get('companyName') as string
    const csvFile = formData.get('csvFile') as File | null

    if (!yearId || !companyCode || !companyName || !csvFile) {
      return NextResponse.json(
        { error: '年度、法人コード、会社名、CSVファイルは必須です' },
        { status: 400 }
      )
    }

    const fiscalYear = getFiscalYear(yearId)
    if (!fiscalYear) {
      return NextResponse.json({ error: '無効な年度です' }, { status: 400 })
    }

    // 1. 年度フォルダを取得/作成（2社目以降は流用）
    const yearFolderId = await getOrCreateYearFolder(fiscalYear.label)

    // 2. 法人フォルダを作成（法人コード_法人名）
    const companyFolderId = await getOrCreateCompanyFolder(
      yearFolderId,
      companyCode,
      companyName
    )

    // 3. CSVをパースして _employee_data.json として保存
    const csvText = await csvFile.text()
    const employees = parseJdlCsv(csvText)

    if (employees.length === 0) {
      return NextResponse.json(
        { error: 'CSVから在職中の従業員データを読み取れませんでした' },
        { status: 400 }
      )
    }

    await writeJsonToFolder(companyFolderId, '_employee_data.json', employees)

    // 4. _clients.json を更新（upsert）
    const existingClients = await loadClients(yearFolderId)
    const clientIndex = existingClients.findIndex((c) => c.code === companyCode)

    const clientEntry = {
      code: companyCode,
      name: companyName,
      driveFolderId: companyFolderId,
    }

    if (clientIndex >= 0) {
      existingClients[clientIndex] = clientEntry
    } else {
      existingClients.push(clientEntry)
    }

    await saveClients(yearFolderId, existingClients)

    // 5. URL・QRコード一覧表スプレッドシートを更新
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || ''
    await updateUrlSheet(yearFolderId, fiscalYear.label, existingClients, appUrl, yearId)

    return NextResponse.json({
      success: true,
      employeeCount: employees.length,
      companyCode,
      companyName,
      uploadUrl: `${appUrl}/upload?client=${companyCode}&year=${yearId}`,
      message: `${companyName}を登録しました（従業員${employees.length}名）`,
    })
  } catch (error) {
    console.error('Register company error:', error)
    const message = error instanceof Error ? error.message : '不明なエラー'
    return NextResponse.json(
      { error: `会社登録中にエラーが発生しました: ${message}` },
      { status: 500 }
    )
  }
}
