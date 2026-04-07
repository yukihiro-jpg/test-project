import { NextRequest, NextResponse } from 'next/server'
import { getClientDynamic } from '@/lib/clients'
import { getFiscalYear } from '@/lib/fiscal-year'
import { getDocumentLabel, DOCUMENT_TYPES } from '@/lib/document-types'
import { imagesToPdf } from '@/lib/pdf-converter'
import {
  findOrCreateFolderInDrive,
  uploadPdfToDrive,
  writeJsonToFolder,
  getOrCreateYearFolder,
} from '@/lib/client-registry'
import {
  updateCompanyProgress,
  appendUploadLog,
  checkAllSubmitted,
} from '@/lib/progress-tracker'
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

    // 各書類を処理（複数ファイル対応：同じ docType.id で複数のファイルが送られる）
    const uploadedDocs: string[] = []
    const uploadedDocLabels: string[] = []

    for (const docType of DOCUMENT_TYPES) {
      const files = formData.getAll(docType.id) as File[]
      if (files.length === 0) continue

      const imageBuffers: Buffer[] = []
      for (const file of files) {
        if (!(file instanceof File) || file.size === 0) continue
        const arrayBuffer = await file.arrayBuffer()
        imageBuffers.push(Buffer.from(arrayBuffer))
      }

      if (imageBuffers.length === 0) continue

      // 複数画像を1つのPDFにまとめる
      const pdfBuffer = await imagesToPdf(imageBuffers)
      const fileName = `${getDocumentLabel(docType.id)}.pdf`
      await uploadPdfToDrive(employeeFolderId, fileName, pdfBuffer)

      uploadedDocs.push(docType.id)
      uploadedDocLabels.push(getDocumentLabel(docType.id))
    }

    // 書類0件でも送信OK（該当する書類がない従業員のため）

    // レスポンスを先に返し、バックグラウンドで進捗更新
    const response = NextResponse.json({
      success: true,
      employeeName,
      uploadedDocuments: uploadedDocs,
      message:
        uploadedDocs.length > 0
          ? `${uploadedDocs.length}件の書類をアップロードしました`
          : '提出書類なしで送信しました',
    })

    // バックグラウンド処理（失敗しても従業員のレスポンスに影響しない）
    const backgroundTasks = async () => {
      try {
        const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID
        if (spreadsheetId) {
          await updateCompanyProgress(spreadsheetId, fiscalYear.label, client)
        }
      } catch (err) {
        console.error('スプレッドシート更新エラー:', err)
      }

      try {
        const yearFolderId = await getOrCreateYearFolder(fiscalYear.label)
        const today = new Date().toISOString().split('T')[0]
        await appendUploadLog(yearFolderId, {
          date: today,
          clientCode: client.code,
          clientName: client.name,
          employeeName,
          docs: uploadedDocLabels,
          isNewHire,
        })
      } catch (err) {
        console.error('アップロードログ追記エラー:', err)
      }

      try {
        const result = await checkAllSubmitted(client.driveFolderId)
        if (result.allSubmitted) {
          console.log(`★ 全員提出完了: ${client.name}（${result.total}名）`)
        }
      } catch (err) {
        console.error('全員提出チェックエラー:', err)
      }
    }

    // fire-and-forget
    backgroundTasks()

    return response
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'アップロード中にエラーが発生しました' },
      { status: 500 }
    )
  }
}
