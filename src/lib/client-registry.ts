/**
 * Google Driveベースの動的クライアント管理
 *
 * フォルダ構造:
 *   {年末調整ルートフォルダ}/                ← 04_年末調整業務
 *     令和8年度/
 *       会社別URL・QRコード一覧 (Google Spreadsheet)
 *       _system/                            ← システムファイル隠しフォルダ
 *         _clients.json
 *         _upload_log.json
 *       001_株式会社A/
 *         年末調整管理 (Google Spreadsheet)  ← 会社別進捗管理
 *         _employee_data.json
 *         山田太郎/
 *           生命保険料控除証明書.pdf
 *           _confirmed_info.json
 *       002_株式会社B/
 *         ...
 */

import { google } from 'googleapis'
import { Readable } from 'stream'
import type { Client } from './clients'

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/spreadsheets',
    ],
  })
}

function getDrive() {
  return google.drive({ version: 'v3', auth: getAuth() })
}

function getSheets() {
  return google.sheets({ version: 'v4', auth: getAuth() })
}

const ROOT_FOLDER_ID = () => process.env.GOOGLE_ROOT_FOLDER_ID || ''
const SHARED_DRIVE_ID = () => process.env.GOOGLE_SHARED_DRIVE_ID || ''
const CLIENTS_FILE = '_clients.json'
const SYSTEM_FOLDER_NAME = '_system'
const URL_SHEET_NAME = '会社別URL・QRコード一覧'
const PROGRESS_SHEET_NAME = '年末調整管理'

/**
 * 年度フォルダを取得 or 作成
 */
export async function getOrCreateYearFolder(yearLabel: string): Promise<string> {
  const drive = getDrive()
  const rootId = ROOT_FOLDER_ID()
  const driveId = SHARED_DRIVE_ID()

  const res = await drive.files.list({
    q: `'${rootId}' in parents and name = '${yearLabel}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    ...(driveId ? { driveId, corpora: 'drive' } : {}),
  })

  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id!
  }

  const createRes = await drive.files.create({
    requestBody: {
      name: yearLabel,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [rootId],
    },
    fields: 'id',
    supportsAllDrives: true,
  })

  return createRes.data.id!
}

/**
 * 法人フォルダを取得 or 作成
 */
export async function getOrCreateCompanyFolder(
  yearFolderId: string,
  companyCode: string,
  companyName: string
): Promise<string> {
  const folderName = `${companyCode}_${companyName}`
  return findOrCreateFolderInDrive(yearFolderId, folderName)
}

/**
 * 年度フォルダ内の _system フォルダを取得 or 作成（隠しシステムフォルダ）
 */
export async function getOrCreateSystemFolder(yearFolderId: string): Promise<string> {
  return findOrCreateFolderInDrive(yearFolderId, SYSTEM_FOLDER_NAME)
}

/**
 * フォルダを取得 or 作成（汎用）
 */
export async function findOrCreateFolderInDrive(
  parentId: string,
  folderName: string
): Promise<string> {
  const drive = getDrive()
  const driveId = SHARED_DRIVE_ID()

  const res = await drive.files.list({
    q: `'${parentId}' in parents and name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    ...(driveId ? { driveId, corpora: 'drive' } : {}),
  })

  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id!
  }

  const createRes = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
    supportsAllDrives: true,
  })

  return createRes.data.id!
}

/**
 * 年度フォルダ配下の _system/_clients.json を読み込む
 */
export async function loadClients(yearFolderId: string): Promise<Client[]> {
  const systemFolderId = await getOrCreateSystemFolder(yearFolderId)
  const data = await readJsonFromFolder<Client[]>(systemFolderId, CLIENTS_FILE)
  return data || []
}

/**
 * 年度フォルダ配下の _system/_clients.json を更新
 */
export async function saveClients(yearFolderId: string, clients: Client[]): Promise<void> {
  const systemFolderId = await getOrCreateSystemFolder(yearFolderId)
  await writeJsonToFolder(systemFolderId, CLIENTS_FILE, clients)
}

/**
 * フォルダからJSONファイルを読み込む汎用関数
 */
export async function readJsonFromFolder<T>(folderId: string, fileName: string): Promise<T | null> {
  const drive = getDrive()
  const driveId = SHARED_DRIVE_ID()

  const res = await drive.files.list({
    q: `'${folderId}' in parents and name = '${fileName}' and trashed = false`,
    fields: 'files(id)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    ...(driveId ? { driveId, corpora: 'drive' } : {}),
  })

  if (!res.data.files || res.data.files.length === 0) return null

  const fileRes = await drive.files.get(
    { fileId: res.data.files[0].id!, alt: 'media', supportsAllDrives: true },
    { responseType: 'text' }
  )

  return JSON.parse(fileRes.data as string) as T
}

/**
 * フォルダにJSONファイルを保存（既存なら上書き）
 */
export async function writeJsonToFolder(folderId: string, fileName: string, data: unknown): Promise<void> {
  const drive = getDrive()
  const driveId = SHARED_DRIVE_ID()
  const jsonContent = JSON.stringify(data, null, 2)

  const res = await drive.files.list({
    q: `'${folderId}' in parents and name = '${fileName}' and trashed = false`,
    fields: 'files(id)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    ...(driveId ? { driveId, corpora: 'drive' } : {}),
  })

  const stream = new Readable()
  stream.push(jsonContent)
  stream.push(null)

  if (res.data.files && res.data.files.length > 0) {
    await drive.files.update({
      fileId: res.data.files[0].id!,
      media: { mimeType: 'application/json', body: stream },
      supportsAllDrives: true,
    })
  } else {
    await drive.files.create({
      requestBody: { name: fileName, parents: [folderId] },
      media: { mimeType: 'application/json', body: stream },
      fields: 'id',
      supportsAllDrives: true,
    })
  }
}

/**
 * 法人フォルダ内の _employee_data.json を読み込む
 */
export async function loadEmployeeDataFromDrive(companyFolderId: string): Promise<import('./employee-data').EmployeeData[]> {
  const data = await readJsonFromFolder<import('./employee-data').EmployeeData[]>(companyFolderId, '_employee_data.json')
  return data || []
}

/**
 * フォルダ内のサブフォルダ一覧を取得
 */
export async function listSubFoldersInDrive(folderId: string): Promise<Array<{ id: string; name: string }>> {
  const drive = getDrive()
  const driveId = SHARED_DRIVE_ID()

  const res = await drive.files.list({
    q: `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    ...(driveId ? { driveId, corpora: 'drive' } : {}),
  })

  return (res.data.files || []).map((f) => ({ id: f.id!, name: f.name! }))
}

/**
 * フォルダ内のファイル一覧を取得
 */
export async function listFilesInDrive(
  folderId: string,
  mimeType?: string
): Promise<Array<{ id: string; name: string; modifiedTime: string }>> {
  const drive = getDrive()
  const driveId = SHARED_DRIVE_ID()

  let q = `'${folderId}' in parents and trashed = false`
  if (mimeType) q += ` and mimeType = '${mimeType}'`

  const res = await drive.files.list({
    q,
    fields: 'files(id, name, modifiedTime)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    ...(driveId ? { driveId, corpora: 'drive' } : {}),
  })

  return (res.data.files || []).map((f) => ({
    id: f.id!,
    name: f.name!,
    modifiedTime: f.modifiedTime!,
  }))
}

/**
 * PDFファイルをアップロード（同名は上書き）
 */
export async function uploadPdfToDrive(folderId: string, fileName: string, pdfBuffer: Buffer): Promise<string> {
  const drive = getDrive()
  const driveId = SHARED_DRIVE_ID()

  const res = await drive.files.list({
    q: `'${folderId}' in parents and name = '${fileName}' and trashed = false`,
    fields: 'files(id)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    ...(driveId ? { driveId, corpora: 'drive' } : {}),
  })

  const stream = new Readable()
  stream.push(pdfBuffer)
  stream.push(null)

  if (res.data.files && res.data.files.length > 0) {
    const fileId = res.data.files[0].id!
    await drive.files.update({
      fileId,
      media: { mimeType: 'application/pdf', body: stream },
      supportsAllDrives: true,
    })
    return fileId
  }

  const createRes = await drive.files.create({
    requestBody: { name: fileName, parents: [folderId] },
    media: { mimeType: 'application/pdf', body: stream },
    fields: 'id',
    supportsAllDrives: true,
  })

  return createRes.data.id!
}

/**
 * 年度フォルダ内の「会社別URL・QRコード一覧」スプレッドシートを取得 or 作成
 * 共有ドライブ内に直接作成する（サービスアカウントはマイドライブを持たないため）
 */
async function getOrCreateUrlSheet(yearFolderId: string, yearLabel: string): Promise<string> {
  const drive = getDrive()
  const sheets = getSheets()
  const driveId = SHARED_DRIVE_ID()

  // 既存ファイルを検索
  const res = await drive.files.list({
    q: `'${yearFolderId}' in parents and name = '${URL_SHEET_NAME}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`,
    fields: 'files(id)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    ...(driveId ? { driveId, corpora: 'drive' } : {}),
  })

  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id!
  }

  // 共有ドライブ内に直接スプレッドシートを作成
  const createRes = await drive.files.create({
    requestBody: {
      name: URL_SHEET_NAME,
      mimeType: 'application/vnd.google-apps.spreadsheet',
      parents: [yearFolderId],
    },
    fields: 'id',
    supportsAllDrives: true,
  })

  const spreadsheetId = createRes.data.id!

  // デフォルトシート名を年度に変更
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          updateSheetProperties: {
            properties: { sheetId: 0, title: yearLabel },
            fields: 'title',
          },
        },
      ],
    },
  })

  return spreadsheetId
}

/**
 * URL・QRコード一覧表を更新
 * QRコード列にはGoogle SheetsのIMAGE関数で /api/qrcode を呼び出して
 * QRコード画像を埋め込む
 */
export async function updateUrlSheet(
  yearFolderId: string,
  yearLabel: string,
  clients: Client[],
  appUrl: string,
  yearId: string
): Promise<void> {
  const sheets = getSheets()
  const spreadsheetId = await getOrCreateUrlSheet(yearFolderId, yearLabel)

  const headerRow = ['法人コード', '法人名', 'アップロードURL', 'QRコード']
  const dataRows = clients.map((c) => {
    const uploadUrl = `${appUrl}/upload?client=${c.code}&year=${yearId}`
    const qrApiUrl = `${appUrl}/api/qrcode?text=${encodeURIComponent(uploadUrl)}`
    // IMAGE関数 mode 4 = 指定ピクセルサイズ（200x200）
    const qrFormula = `=IMAGE("${qrApiUrl}", 4, 200, 200)`
    return [c.code, c.name, uploadUrl, qrFormula]
  })

  // 値を更新（USER_ENTERED でIMAGE関数を評価）
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${yearLabel}'!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [headerRow, ...dataRows],
    },
  })

  // QRコード画像が見えるよう行・列のサイズを調整
  const meta = await sheets.spreadsheets.get({ spreadsheetId })
  const sheetMeta = meta.data.sheets?.find(
    (s) => s.properties?.title === yearLabel,
  )
  const sheetId = sheetMeta?.properties?.sheetId

  if (sheetId !== null && sheetId !== undefined) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          // データ行の高さを210pxに（QRコード200pxを表示できる高さ）
          {
            updateDimensionProperties: {
              range: {
                sheetId,
                dimension: 'ROWS',
                startIndex: 1, // 2行目以降
                endIndex: 1 + dataRows.length,
              },
              properties: { pixelSize: 210 },
              fields: 'pixelSize',
            },
          },
          // QRコード列（D列）の幅を220pxに
          {
            updateDimensionProperties: {
              range: {
                sheetId,
                dimension: 'COLUMNS',
                startIndex: 3,
                endIndex: 4,
              },
              properties: { pixelSize: 220 },
              fields: 'pixelSize',
            },
          },
          // アップロードURL列（C列）の幅を400pxに
          {
            updateDimensionProperties: {
              range: {
                sheetId,
                dimension: 'COLUMNS',
                startIndex: 2,
                endIndex: 3,
              },
              properties: { pixelSize: 400 },
              fields: 'pixelSize',
            },
          },
        ],
      },
    })
  }
}

/**
 * 会社フォルダ内の「年末調整管理」スプレッドシートを取得 or 作成
 * 共有ドライブ内に直接作成する（サービスアカウントはマイドライブを持たないため）
 * 戻り値: スプレッドシートID
 */
export async function getOrCreateProgressSheet(companyFolderId: string): Promise<string> {
  const drive = getDrive()
  const sheets = getSheets()
  const driveId = SHARED_DRIVE_ID()

  // 既存ファイルを検索
  const res = await drive.files.list({
    q: `'${companyFolderId}' in parents and name = '${PROGRESS_SHEET_NAME}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`,
    fields: 'files(id)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    ...(driveId ? { driveId, corpora: 'drive' } : {}),
  })

  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id!
  }

  // 共有ドライブ内に直接スプレッドシートを作成
  const createRes = await drive.files.create({
    requestBody: {
      name: PROGRESS_SHEET_NAME,
      mimeType: 'application/vnd.google-apps.spreadsheet',
      parents: [companyFolderId],
    },
    fields: 'id',
    supportsAllDrives: true,
  })

  const spreadsheetId = createRes.data.id!

  // デフォルトシートを「提出状況」にrename + 「未提出者」シート追加
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          updateSheetProperties: {
            properties: { sheetId: 0, title: '提出状況' },
            fields: 'title',
          },
        },
        {
          addSheet: {
            properties: { title: '未提出者' },
          },
        },
      ],
    },
  })

  return spreadsheetId
}
