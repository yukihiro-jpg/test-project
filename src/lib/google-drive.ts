import { google } from 'googleapis'
import { Readable } from 'stream'

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/gmail.send',
    ],
  })
}

function getDrive() {
  return google.drive({ version: 'v3', auth: getAuth() })
}

export function getSheets() {
  return google.sheets({ version: 'v4', auth: getAuth() })
}

export function getGmail() {
  return google.gmail({ version: 'v1', auth: getAuth() })
}

/**
 * 指定フォルダ内でフォルダ名を検索し、なければ作成する
 */
export async function findOrCreateFolder(
  parentFolderId: string,
  folderName: string
): Promise<string> {
  const drive = getDrive()
  const driveId = process.env.GOOGLE_SHARED_DRIVE_ID

  // 既存フォルダを検索
  const searchRes = await drive.files.list({
    q: `'${parentFolderId}' in parents and name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    ...(driveId ? { driveId, corpora: 'drive' } : {}),
  })

  if (searchRes.data.files && searchRes.data.files.length > 0) {
    return searchRes.data.files[0].id!
  }

  // フォルダを作成
  const createRes = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId],
    },
    fields: 'id',
    supportsAllDrives: true,
  })

  return createRes.data.id!
}

/**
 * PDFファイルをGoogle Driveにアップロード（同名ファイルがあれば上書き）
 */
export async function uploadPdf(
  folderId: string,
  fileName: string,
  pdfBuffer: Buffer
): Promise<string> {
  const drive = getDrive()
  const driveId = process.env.GOOGLE_SHARED_DRIVE_ID

  // 既存ファイルを検索（同名は上書き）
  const searchRes = await drive.files.list({
    q: `'${folderId}' in parents and name = '${fileName}' and trashed = false`,
    fields: 'files(id)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    ...(driveId ? { driveId, corpora: 'drive' } : {}),
  })

  const stream = new Readable()
  stream.push(pdfBuffer)
  stream.push(null)

  if (searchRes.data.files && searchRes.data.files.length > 0) {
    // 既存ファイルを更新
    const fileId = searchRes.data.files[0].id!
    await drive.files.update({
      fileId,
      media: {
        mimeType: 'application/pdf',
        body: stream,
      },
      supportsAllDrives: true,
    })
    return fileId
  }

  // 新規アップロード
  const createRes = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: {
      mimeType: 'application/pdf',
      body: stream,
    },
    fields: 'id',
    supportsAllDrives: true,
  })

  return createRes.data.id!
}

/**
 * フォルダ内のファイル一覧を取得
 */
export async function listFiles(
  folderId: string,
  mimeType?: string
): Promise<Array<{ id: string; name: string; mimeType: string; modifiedTime: string }>> {
  const drive = getDrive()
  const driveId = process.env.GOOGLE_SHARED_DRIVE_ID

  let q = `'${folderId}' in parents and trashed = false`
  if (mimeType) {
    q += ` and mimeType = '${mimeType}'`
  }

  const res = await drive.files.list({
    q,
    fields: 'files(id, name, mimeType, modifiedTime)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    ...(driveId ? { driveId, corpora: 'drive' } : {}),
  })

  return (res.data.files || []).map((f) => ({
    id: f.id!,
    name: f.name!,
    mimeType: f.mimeType!,
    modifiedTime: f.modifiedTime!,
  }))
}

/**
 * フォルダ内のサブフォルダ一覧を取得
 */
export async function listSubFolders(
  folderId: string
): Promise<Array<{ id: string; name: string }>> {
  const files = await listFiles(folderId, 'application/vnd.google-apps.folder')
  return files.map((f) => ({ id: f.id, name: f.name }))
}

/**
 * スプレッドシートファイルの内容を読み取る（従業員一覧表用）
 */
export async function readSpreadsheetFromDrive(
  fileId: string
): Promise<string[][]> {
  const sheets = getSheets()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: fileId,
    range: 'A:Z',
  })
  return (res.data.values || []) as string[][]
}

/**
 * Google Driveからスプレッドシートファイルを検索
 */
export async function findSpreadsheetInFolder(
  folderId: string,
  nameContains: string
): Promise<{ id: string; name: string } | null> {
  const drive = getDrive()
  const driveId = process.env.GOOGLE_SHARED_DRIVE_ID

  const res = await drive.files.list({
    q: `'${folderId}' in parents and name contains '${nameContains}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`,
    fields: 'files(id, name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    ...(driveId ? { driveId, corpora: 'drive' } : {}),
  })

  if (res.data.files && res.data.files.length > 0) {
    return { id: res.data.files[0].id!, name: res.data.files[0].name! }
  }
  return null
}
