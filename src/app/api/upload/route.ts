import { NextRequest, NextResponse } from 'next/server'
import { getClient } from '@/lib/clients'
import { getFiscalYear } from '@/lib/fiscal-year'
import { getDocumentLabel, DOCUMENT_TYPES } from '@/lib/document-types'
import { imageToPdf } from '@/lib/pdf-converter'
import { findOrCreateFolder, uploadPdf } from '@/lib/google-drive'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const clientId = formData.get('clientId') as string
    const employeeName = formData.get('employeeName') as string
    const yearId = formData.get('yearId') as string

    if (!clientId || !employeeName || !yearId) {
      return NextResponse.json(
        { error: '顧問先ID、氏名、年度は必須です' },
        { status: 400 }
      )
    }

    const client = getClient(clientId)
    if (!client) {
      return NextResponse.json(
        { error: '顧問先が見つかりません' },
        { status: 404 }
      )
    }

    const fiscalYear = getFiscalYear(yearId)
    if (!fiscalYear) {
      return NextResponse.json(
        { error: '無効な年度が指定されています' },
        { status: 400 }
      )
    }

    // 年度フォルダを作成（なければ）
    const yearFolderId = await findOrCreateFolder(
      client.driveFolderId,
      fiscalYear.label
    )

    const isNewHire = formData.get('isNewHire') === 'true'

    // 本年入社の場合はフォルダ名に「【本年入社】」を付与
    const folderName = isNewHire ? `【本年入社】${employeeName}` : employeeName

    // 従業員フォルダを作成（なければ）
    const employeeFolderId = await findOrCreateFolder(
      yearFolderId,
      folderName
    )

    // 各書類を処理
    const uploadedDocs: string[] = []

    for (const docType of DOCUMENT_TYPES) {
      const file = formData.get(docType.id) as File | null
      if (!file) continue

      const arrayBuffer = await file.arrayBuffer()
      const imageBuffer = Buffer.from(arrayBuffer)

      // 画像→PDF変換
      const pdfBuffer = await imageToPdf(imageBuffer)

      // Google Driveにアップロード
      const fileName = `${getDocumentLabel(docType.id)}.pdf`
      await uploadPdf(employeeFolderId, fileName, pdfBuffer)

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
