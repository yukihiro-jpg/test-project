import { NextRequest, NextResponse } from 'next/server'
import archiver from 'archiver'
import { Readable } from 'node:stream'
import { google } from 'googleapis'
import { getClientDynamic } from '@/lib/clients'
import { getFiscalYear } from '@/lib/fiscal-year'
import { listSubFoldersInDrive, listFilesInDrive } from '@/lib/client-registry'

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  })
}

/**
 * 指定した会社・年度の全従業員PDFを1つのZIPにまとめてダウンロードする。
 *
 * GET /api/download-zip?client=712&year=R8
 *
 * ZIP構造:
 *   {法人コード}_{会社名}_令和8年度.zip
 *     ├── 山田太郎/
 *     │   ├── 生命保険料控除証明書.pdf
 *     │   └── ...
 *     └── 鈴木花子/
 *         └── ...
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const clientCode = searchParams.get('client')
  const yearId = searchParams.get('year')

  if (!clientCode || !yearId) {
    return NextResponse.json(
      { error: 'client と year は必須です' },
      { status: 400 }
    )
  }

  const client = await getClientDynamic(yearId, clientCode)
  if (!client) {
    return NextResponse.json({ error: '会社が見つかりません' }, { status: 404 })
  }

  const fiscalYear = getFiscalYear(yearId)
  if (!fiscalYear) {
    return NextResponse.json({ error: '無効な年度です' }, { status: 400 })
  }

  const drive = google.drive({ version: 'v3', auth: getAuth() })

  // 会社フォルダ内の全従業員フォルダを取得（_systemやハイフン始まりは除外）
  const employeeFolders = await listSubFoldersInDrive(client.driveFolderId)
  const validFolders = employeeFolders.filter((f) => !f.name.startsWith('_'))

  // ZIPアーカイブを作成
  const archive = archiver('zip', { zlib: { level: 6 } })

  archive.on('error', (err) => {
    console.error('Archive error:', err)
  })

  // 各従業員フォルダのPDFをアーカイブに追加（並列で取得）
  let fileCount = 0
  for (const folder of validFolders) {
    const files = await listFilesInDrive(folder.id, 'application/pdf')
    for (const file of files) {
      try {
        const driveRes = await drive.files.get(
          { fileId: file.id, alt: 'media', supportsAllDrives: true },
          { responseType: 'stream' }
        )
        archive.append(driveRes.data as Readable, {
          name: `${folder.name}_${file.name}`,
        })
        fileCount++
      } catch (err) {
        console.error(`PDF取得失敗: ${folder.name}/${file.name}`, err)
      }
    }
  }

  // ファイルが1つもなければエラー
  if (fileCount === 0) {
    return NextResponse.json(
      { error: 'ダウンロード可能なPDFがありません' },
      { status: 404 }
    )
  }

  // アーカイブを確定（これ以降はファイル追加不可）
  archive.finalize()

  // Node.js Readable stream を Web ReadableStream に変換
  const webStream = Readable.toWeb(archive) as ReadableStream<Uint8Array>

  const zipName = `${client.code}_${client.name}_${fiscalYear.label}.zip`

  return new Response(webStream, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(zipName)}`,
    },
  })
}
