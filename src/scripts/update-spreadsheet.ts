/**
 * 進捗管理スプレッドシート更新スクリプト
 *
 * 実行: npm run cron:spreadsheet -- --year=R8
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { DOCUMENT_TYPES } from '../lib/document-types'
import { getFiscalYear, getCurrentFiscalYearId } from '../lib/fiscal-year'
import {
  getOrCreateYearFolder,
  loadClients,
  loadEmployeeDataFromDrive,
  listSubFoldersInDrive,
  listFilesInDrive,
  readJsonFromFolder,
} from '../lib/client-registry'
import type { ConfirmedEmployeeInfo, EmployeeData } from '../lib/employee-data'
import { google } from 'googleapis'

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

const MAX_DEPENDENTS = 10

function parseYearArg(): string {
  const yearArg = process.argv.find((a) => a.startsWith('--year='))
  return yearArg ? yearArg.split('=')[1] : getCurrentFiscalYearId()
}

interface SubmissionInfo {
  docs: string[]
  latestDate: string
  isNewHire: boolean
  confirmed: ConfirmedEmployeeInfo | null
}

async function getSubmissionStatus(
  companyFolderId: string
): Promise<Map<string, SubmissionInfo>> {
  const folders = await listSubFoldersInDrive(companyFolderId)
  const statusMap = new Map<string, SubmissionInfo>()

  for (const folder of folders) {
    // _employee_data.json等のシステムファイルはスキップ
    if (folder.name.startsWith('_')) continue

    const files = await listFilesInDrive(folder.id, 'application/pdf')
    if (files.length === 0) continue

    const isNewHire = folder.name.startsWith('【本年入社】')
    const employeeName = isNewHire ? folder.name.replace('【本年入社】', '') : folder.name

    const docNames = files.map((f) => f.name.replace('.pdf', ''))
    const latestDate = files.map((f) => f.modifiedTime).sort().reverse()[0]

    // _confirmed_info.json を読み込み
    const confirmed = await readJsonFromFolder<ConfirmedEmployeeInfo>(folder.id, '_confirmed_info.json')

    statusMap.set(employeeName, { docs: docNames, latestDate, isNewHire, confirmed })
  }

  return statusMap
}

function buildHeaderRow(): string[] {
  const docLabels = DOCUMENT_TYPES.map((d) => d.label)

  const header = [
    '従業員コード', '氏名', '最終提出日',
    ...docLabels,
    '前年相違', '住所', '障碍者区分', '寡婦ひとり親',
  ]

  // 扶養親族1〜MAX_DEPENDENTS
  for (let i = 1; i <= MAX_DEPENDENTS; i++) {
    header.push(
      `扶養${i}氏名`, `扶養${i}続柄`, `扶養${i}生年月日`,
      `扶養${i}障碍者`, `扶養${i}年収`
    )
  }

  return header
}

function buildDataRow(
  code: string,
  name: string,
  sub: SubmissionInfo | undefined,
  docLabels: string[]
): string[] {
  const row: string[] = [
    code,
    name,
    sub ? sub.latestDate.split('T')[0] : '未提出',
    ...docLabels.map((label) => (sub?.docs.includes(label) ? '○' : '')),
  ]

  // 確認済み情報
  const ci = sub?.confirmed
  row.push(ci?.infoChanged ? '○' : '')
  row.push(ci?.employee.address || '')
  row.push(ci?.employee.disability || '')
  row.push(ci?.employee.widowSingleParent || '')

  // 扶養親族
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

async function main() {
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID
  if (!spreadsheetId) {
    console.error('GOOGLE_SPREADSHEET_ID が設定されていません')
    process.exit(1)
  }

  const yearId = parseYearArg()
  const fiscalYear = getFiscalYear(yearId)
  if (!fiscalYear) {
    console.error(`無効な年度: ${yearId}`)
    process.exit(1)
  }

  console.log(`対象年度: ${fiscalYear.label}`)

  const yearFolderId = await getOrCreateYearFolder(fiscalYear.label)
  const clients = await loadClients(yearFolderId)

  if (clients.length === 0) {
    console.log('登録済みの顧問先がありません')
    return
  }

  const sheets = getSheets()
  const docLabels = DOCUMENT_TYPES.map((d) => d.label)
  const headerRow = buildHeaderRow()

  for (const client of clients) {
    console.log(`\n処理中: ${client.name}`)

    try {
      // 従業員マスタ
      const employees = await loadEmployeeDataFromDrive(client.driveFolderId)
      console.log(`  従業員数: ${employees.length}名`)

      // 提出状況
      const submissions = await getSubmissionStatus(client.driveFolderId)
      console.log(`  提出済み: ${submissions.size}名`)

      // 既存従業員の行
      const dataRows: string[][] = employees
        .sort((a, b) => a.code.localeCompare(b.code, 'ja'))
        .map((emp) => buildDataRow(emp.code, emp.name, submissions.get(emp.name), docLabels))

      // 本年入社者を追記
      const masterNames = new Set(employees.map((e) => e.name))
      submissions.forEach((sub, name) => {
        if (sub.isNewHire && !masterNames.has(name)) {
          dataRows.push(buildDataRow('本年入社', name, sub, docLabels))
        }
      })

      // シート名
      const statusSheetName = `${fiscalYear.label}_${client.name}`
      const unsubmittedSheetName = `${fiscalYear.label}_${client.name}_未提出者`

      // シート取得/作成
      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId })
      const existingSheets = spreadsheet.data.sheets || []
      const requests: Array<Record<string, unknown>> = []

      if (!existingSheets.some((s) => s.properties?.title === statusSheetName)) {
        requests.push({ addSheet: { properties: { title: statusSheetName } } })
      }
      if (!existingSheets.some((s) => s.properties?.title === unsubmittedSheetName)) {
        requests.push({ addSheet: { properties: { title: unsubmittedSheetName } } })
      }
      if (requests.length > 0) {
        await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } })
      }

      // 提出状況シート更新
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${statusSheetName}'!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: [headerRow, ...dataRows] },
      })

      // 未提出者シート
      const unsubmitted = employees.filter((e) => !submissions.has(e.name))
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${unsubmittedSheetName}'!A1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [
            ['従業員コード', '氏名'],
            ...unsubmitted.map((e) => [e.code, e.name]),
          ],
        },
      })

      const submittedCount = employees.filter((e) => submissions.has(e.name)).length
      console.log(`  完了: ${submittedCount}/${employees.length}名提出済み`)
    } catch (error) {
      console.error(`  エラー: ${error}`)
    }
  }

  console.log('\n=== 処理完了 ===')
}

main().catch((err) => {
  console.error('スクリプトエラー:', err)
  process.exit(1)
})
