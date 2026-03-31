import { NextRequest, NextResponse } from 'next/server'
import { getClientDynamic } from '@/lib/clients'
import { getFiscalYear } from '@/lib/fiscal-year'
import { getDocumentLabel, DOCUMENT_TYPES } from '@/lib/document-types'
import { imageToPdf } from '@/lib/pdf-converter'
import {
  findOrCreateFolderInDrive,
  uploadPdfToDrive,
  writeJsonToFolder,
} from '@/lib/client-registry'
import type { ConfirmedEmployeeInfo } from '@/lib/employee-data'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const clientId = formData.get('clientId') as string
    const yearId = formData.get('yearId') as string
    const employeeName = formData.get('employeeName') as string
    const isNewHire = formData.get('isNewHire') === 'true'
    const confirmedInfoJson = formData.get('confirmedInfo') as string | null

    if (!clientId || !employeeName || !yearId) {
      return NextResponse.json(
        { error: '顧問先ID、氏名、年度は必須です' },
        { status: 400 }
      )
    }

    const client = await getClientDynamic(yearId, clientId)
    if (!client) {
      return NextResponse.json({ error: '顧問先が見つかりません' }, { status: 404 })
    }

    const fiscalYear = getFiscalYear(yearId)
    if (!fiscalYear) {
      return NextResponse.json({ error: '無効な年度です' }, { status: 400 })
    }

    // 従業員フォルダを作成（法人フォルダ直下）
    const folderName = isNewHire ? `【本年入社】${employeeName}` : employeeName
    const employeeFolderId = await findOrCreateFolderInDrive(
      client.driveFolderId,
      folderName
    )

    // 確認済み従業員情報を保存
    if (confirmedInfoJson) {
      const confirmedInfo: ConfirmedEmployeeInfo = JSON.parse(confirmedInfoJson)
      await writeJsonToFolder(employeeFolderId, '_confirmed_info.json', confirmedInfo)
    }

    // 各書類を処理
    const uploadedDocs: string[] = []

    for (const docType of DOCUMENT_TYPES) {
      const file = formData.get(docType.id) as File | null
      if (!file) continue

      const arrayBuffer = await file.arrayBuffer()
      const imageBuffer = Buffer.from(arrayBuffer)

      const pdfBuffer = await imageToPdf(imageBuffer)
      const fileName = `${getDocumentLabel(docType.id)}.pdf`
      await uploadPdfToDrive(employeeFolderId, fileName, pdfBuffer)

      uploadedDocs.push(docType.id)
    }

    if (uploadedDocs.length === 0) {
      return NextResponse.json(
        { error: '書類が1つも添付されていません' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      employeeName,
      uploadedDocuments: uploadedDocs,
      message: `${uploadedDocs.length}件の書類をアップロードしました`,
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'アップロード中にエラーが発生しました' },
      { status: 500 }
    )
  }
}
