/**
 * Google Driveベースの動的クライアント管理
 *
 * 年度フォルダ内の _clients.json を読み書きして顧問先を管理する。
 * フォルダ構造:
 *   {年末調整ルートフォルダ}/
 *     令和8年度/
 *       _clients.json
 *       URL・QRコード一覧表 (Google Spreadsheet)
 *       001_株式会社A/
 *       002_株式会社B/
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

/**
 * 年度フォルダを取得 or 作成
 */
export async function getOrCreateYearFolder(yearLabel: string): Promise<string> {
  const drive = getDrive()
  const rootId = ROOT_FOLDER_ID()
  const driveId = SHARED_DRIVE_ID()

  // 既存フォルダを検索
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

  // 作成
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
  const drive = getDrive()
  const driveId = SHARED_DRIVE_ID()
  const folderName = `${companyCode}_${companyName}`

  const res = await drive.files.list({
    q: `'${yearFolderId}' in parents and name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
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
      parents: [yearFolderId],
    },
    fields: 'id',
    supportsAllDrives: true,
  })

  return createRes.data.id!
}

/**
 * 年度フォルダから _clients.json を読み込む
 */
export async function loadClients(yearFolderId: string): Promise<Client[]> {
  const drive = getDrive()
  const driveId = SHARED_DRIVE_ID()

  const res = await drive.files.list({
    q: `'${yearFolderId}' in parents and name = '${CLIENTS_FILE}' and trashed = false`,
    fields: 'files(id)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    ...(driveId ? { driveId, corpora: 'drive' } : {}),
  })

  if (!res.data.files || res.data.files.length === 0) {
    return []
  }

  const fileRes = await drive.files.get(
    { fileId: res.data.files[0].id!, alt: 'media', supportsAllDrives: true },
    { responseType: 'text' }
  )

  return JSON.parse(fileRes.data as string) as Client[]
}

/**
 * 年度フォルダの _clients.json を更新
 */
export async function saveClients(yearFolderId: string, clients: Client[]): Promise<void> {
  const drive = getDrive()
  const driveId = SHARED_DRIVE_ID()
  const jsonContent = JSON.stringify(clients, null, 2)

  const res = await drive.files.list({
    q: `'${yearFolderId}' in parents and name = '${CLIENTS_FILE}' and trashed = false`,
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
      requestBody: { name: CLIENTS_FILE, parents: [yearFolderId] },
      media: { mimeType: 'application/json', body: stream },
      fields: 'id',
      supportsAllDrives: true,
    })
  }
}

/**
 * URL・QRコード一覧表スプレッドシートを取得 or 作成
 */
async function getOrCreateUrlSheet(yearFolderId: string, yearLabel: string): Promise<string> {
  const drive = getDrive()
  const sheets = getSheets()
  const driveId = SHARED_DRIVE_ID()
  const sheetName = `URL・QRコード一覧表`

  const res = await drive.files.list({
    q: `'${yearFolderId}' in parents and name = '${sheetName}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`,
    fields: 'files(id)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    ...(driveId ? { driveId, corpora: 'drive' } : {}),
  })

  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id!
  }

  // スプレッドシートを作成
  const spreadsheet = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: sheetName },
      sheets: [{ properties: { title: yearLabel } }],
    },
  })

  const spreadsheetId = spreadsheet.data.spreadsheetId!

  // 年度フォルダに移動
  await drive.files.update({
    fileId: spreadsheetId,
    addParents: yearFolderId,
    removeParents: 'root',
    supportsAllDrives: true,
    fields: 'id',
  })

  return spreadsheetId
}

/**
 * URL・QRコード一覧表を更新
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

  const headerRow = ['法人コード', '法人名', 'アップロードURL']
  const dataRows = clients.map((c) => [
    c.code,
    c.name,
    `${appUrl}/upload?client=${c.code}&year=${yearId}`,
  ])

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${yearLabel}'!A1`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [headerRow, ...dataRows],
    },
  })
}
