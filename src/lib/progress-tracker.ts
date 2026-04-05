/**
 * 進捗管理の共有ライブラリ
 *
 * - スプレッドシートのリアルタイム更新（upload API から呼び出し）
 * - 全員提出完了チェック
 * - アップロードログの追記・読み込み・クリア
 */

import { google } from 'googleapis'
import { DOCUMENT_TYPES } from './document-types'
import type { Client } from './clients'
import type { ConfirmedEmployeeInfo } from './employee-data'
import {
  loadEmployeeDataFromDrive,
  listSubFoldersInDrive,
  listFilesInDrive,
  readJsonFromFolder,
  writeJsonToFolder,
} from './client-registry'

const MAX_DEPENDENTS = 10
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1000

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

function getSheets() {
  return google.sheets({ version: 'v4', auth: getAuth() })
}

// ---------- リトライ付きSheets書き込み ----------

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn()
    } catch (err: unknown) {
      const status = (err as { code?: number })?.code
      if (status === 429 && attempt < MAX_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)))
        continue
      }
      throw err
    }
  }
  throw new Error('Max retries reached')
}

// ---------- スプレッドシートのヘッダー・データ行構築 ----------

interface SubmissionInfo {
  docs: string[]
  latestDate: string
  isNewHire: boolean
  confirmed: ConfirmedEmployeeInfo | null
}

function buildHeaderRow(): string[] {
  const docLabels = DOCUMENT_TYPES.map((d) => d.label)
  const header = [
    '従業員コード', '氏名', '最終提出日',
    ...docLabels,
    '前年相違', '住所', '障碍者区分', '寡婦ひとり親',
  ]
  for (let i = 1; i <= MAX_DEPENDENTS; i++) {
    header.push(`扶養${i}氏名`, `扶養${i}続柄`, `扶養${i}生年月日`, `扶養${i}障碍者`, `扶養${i}年収`)
  }
  return header
}

function buildDataRow(
  code: string, name: string, sub: SubmissionInfo | undefined, docLabels: string[]
): string[] {
  const row: string[] = [
    code, name,
    sub ? sub.latestDate.split('T')[0] : '未提出',
    ...docLabels.map((label) => (sub?.docs.includes(label) ? '○' : '')),
  ]
  const ci = sub?.confirmed
  row.push(ci?.infoChanged ? '○' : '')
  row.push(ci?.employee.address || '')
  row.push(ci?.employee.disability || '')
  row.push(ci?.employee.widowSingleParent || '')
  for (let i = 0; i < MAX_DEPENDENTS; i++) {
    const dep = ci?.dependents[i]
    if (dep) {
      row.push(dep.name, dep.relationship, dep.birthday, dep.disability, dep.annualIncome)
    } else {
      row.push('', '', '', '', '')
    }
  }
  return row
}

async function getSubmissionStatus(companyFolderId: string): Promise<Map<string, SubmissionInfo>> {
  const folders = await listSubFoldersInDrive(companyFolderId)
  const statusMap = new Map<string, SubmissionInfo>()

  for (const folder of folders) {
    if (folder.name.startsWith('_')) continue
    const files = await listFilesInDrive(folder.id, 'application/pdf')
    if (files.length === 0) continue

    const isNewHire = folder.name.startsWith('【本年入社】')
    const employeeName = isNewHire ? folder.name.replace('【本年入社】', '') : folder.name
    const docNames = files.map((f) => f.name.replace('.pdf', ''))
    const latestDate = files.map((f) => f.modifiedTime).sort().reverse()[0]
    const confirmed = await readJsonFromFolder<ConfirmedEmployeeInfo>(folder.id, '_confirmed_info.json')

    statusMap.set(employeeName, { docs: docNames, latestDate, isNewHire, confirmed })
  }

  return statusMap
}

// ---------- 公開関数 ----------

/**
 * 1社分の進捗をスプレッドシートに反映
 */
export async function updateCompanyProgress(
  spreadsheetId: string,
  yearLabel: string,
  client: Client,
): Promise<{ total: number; submitted: number }> {
  const sheets = getSheets()
  const docLabels = DOCUMENT_TYPES.map((d) => d.label)
  const headerRow = buildHeaderRow()

  const employees = await loadEmployeeDataFromDrive(client.driveFolderId)
  const submissions = await getSubmissionStatus(client.driveFolderId)

  const dataRows = employees
    .sort((a, b) => a.code.localeCompare(b.code, 'ja'))
    .map((emp) => buildDataRow(emp.code, emp.name, submissions.get(emp.name), docLabels))

  // 本年入社者を追記
  const masterNames = new Set(employees.map((e) => e.name))
  submissions.forEach((sub, name) => {
    if (sub.isNewHire && !masterNames.has(name)) {
      dataRows.push(buildDataRow('本年入社', name, sub, docLabels))
    }
  })

  const statusSheetName = `${yearLabel}_${client.name}`
  const unsubmittedSheetName = `${yearLabel}_${client.name}_未提出者`

  // シート取得/作成
  const spreadsheet = await withRetry(() => sheets.spreadsheets.get({ spreadsheetId }))
  const existingSheets = spreadsheet.data.sheets || []
  const requests: Array<Record<string, unknown>> = []

  if (!existingSheets.some((s) => s.properties?.title === statusSheetName)) {
    requests.push({ addSheet: { properties: { title: statusSheetName } } })
  }
  if (!existingSheets.some((s) => s.properties?.title === unsubmittedSheetName)) {
    requests.push({ addSheet: { properties: { title: unsubmittedSheetName } } })
  }
  if (requests.length > 0) {
    await withRetry(() => sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } }))
  }

  await withRetry(() => sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${statusSheetName}'!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: [headerRow, ...dataRows] },
  }))

  const unsubmitted = employees.filter((e) => !submissions.has(e.name))
  await withRetry(() => sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${unsubmittedSheetName}'!A1`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [['従業員コード', '氏名'], ...unsubmitted.map((e) => [e.code, e.name])],
    },
  }))

  const submittedCount = employees.filter((e) => submissions.has(e.name)).length
  return { total: employees.length, submitted: submittedCount }
}

/**
 * 全員提出完了かチェック
 */
export async function checkAllSubmitted(
  companyFolderId: string,
): Promise<{ allSubmitted: boolean; total: number; submitted: number }> {
  const employees = await loadEmployeeDataFromDrive(companyFolderId)
  if (employees.length === 0) return { allSubmitted: false, total: 0, submitted: 0 }

  const submissions = await getSubmissionStatus(companyFolderId)
  const submittedNames = new Set(submissions.keys())

  const submitted = employees.filter((e) => submittedNames.has(e.name)).length

  return {
    allSubmitted: submitted >= employees.length,
    total: employees.length,
    submitted,
  }
}

// ---------- アップロードログ ----------

export interface UploadLogEntry {
  date: string
  clientCode: string
  clientName: string
  employeeName: string
  docs: string[]
  isNewHire: boolean
}

const UPLOAD_LOG_FILE = '_upload_log.json'

/**
 * アップロードログに追記
 */
export async function appendUploadLog(
  yearFolderId: string,
  entry: UploadLogEntry,
): Promise<void> {
  const existing = await readJsonFromFolder<UploadLogEntry[]>(yearFolderId, UPLOAD_LOG_FILE)
  const log = existing || []
  log.push(entry)
  await writeJsonToFolder(yearFolderId, UPLOAD_LOG_FILE, log)
}

/**
 * アップロードログを読み込み＋クリア
 */
export async function readAndClearUploadLog(
  yearFolderId: string,
): Promise<UploadLogEntry[]> {
  const log = await readJsonFromFolder<UploadLogEntry[]>(yearFolderId, UPLOAD_LOG_FILE)
  if (!log || log.length === 0) return []

  // クリア（空配列で上書き）
  await writeJsonToFolder(yearFolderId, UPLOAD_LOG_FILE, [])
  return log
}
