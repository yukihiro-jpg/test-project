import { NextRequest, NextResponse } from 'next/server'
import { Readable } from 'stream'
import { google } from 'googleapis'
import { getClient } from '@/lib/clients'
import { getFiscalYear } from '@/lib/fiscal-year'
import { parseCsv } from '@/lib/employee-data'
import { findOrCreateFolder } from '@/lib/google-drive'

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/drive'],
  })
}

/**
 * JDL年末調整CSVをアップロードし、パースしてGoogle Driveに従業員データJSONとして保存する。
 * 保存先: {顧問先フォルダ}/{年度フォルダ}/_employee_data.json
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const clientId = formData.get('clientId') as string
    const yearId = formData.get('yearId') as string
    const csvFile = formData.get('csvFile') as File | null

    if (!clientId || !yearId || !csvFile) {
      return NextResponse.json(
        { error: '顧問先ID、年度、CSVファイルは必須です' },
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

    // CSVをパース
    const csvText = await csvFile.text()
    const employees = parseCsv(csvText)

    if (employees.length === 0) {
      return NextResponse.json(
        { error: 'CSVから従業員データを読み取れませんでした' },
        { status: 400 }
      )
    }

    // Google Driveの年度フォルダにJSONとして保存
    const yearFolderId = await findOrCreateFolder(
      client.driveFolderId,
      fiscalYear.label
    )

    const drive = google.drive({ version: 'v3', auth: getAuth() })
    const driveId = process.env.GOOGLE_SHARED_DRIVE_ID
    const jsonFileName = '_employee_data.json'
    const jsonContent = JSON.stringify(employees, null, 2)

    // 既存ファイルを検索
    const searchRes = await drive.files.list({
      q: `'${yearFolderId}' in parents and name = '${jsonFileName}' and trashed = false`,
      fields: 'files(id)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      ...(driveId ? { driveId, corpora: 'drive' } : {}),
    })

    const stream = new Readable()
    stream.push(jsonContent)
    stream.push(null)

    if (searchRes.data.files && searchRes.data.files.length > 0) {
      // 既存ファイルを更新
      await drive.files.update({
        fileId: searchRes.data.files[0].id!,
        media: { mimeType: 'application/json', body: stream },
        supportsAllDrives: true,
      })
    } else {
      // 新規作成
      await drive.files.create({
        requestBody: {
          name: jsonFileName,
          parents: [yearFolderId],
        },
        media: { mimeType: 'application/json', body: stream },
        fields: 'id',
        supportsAllDrives: true,
      })
    }

    return NextResponse.json({
      success: true,
      employeeCount: employees.length,
      message: `${employees.length}名の従業員データを登録しました`,
    })
  } catch (error) {
    console.error('CSV upload error:', error)
    return NextResponse.json(
      { error: 'CSVアップロード中にエラーが発生しました' },
      { status: 500 }
    )
  }
}
