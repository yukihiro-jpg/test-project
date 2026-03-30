/**
 * 進捗管理スプレッドシート更新スクリプト
 *
 * 毎日0:00（締め）に実行し、各顧問先のアップロード状況をスプレッドシートに反映する。
 * - 「提出状況」シート: 従業員コード順に全員の提出状況を一覧表示
 * - 「未提出者」シート: まだ1つも書類を提出していない従業員を表示
 *
 * 実行: npm run cron:spreadsheet -- --year=R8
 * cron設定例: 0 0 * * * cd /path/to/project && npm run cron:spreadsheet -- --year=R8
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { getAllClients } from '../lib/clients'
import { DOCUMENT_TYPES } from '../lib/document-types'
import { getFiscalYear, getCurrentFiscalYearId } from '../lib/fiscal-year'
import {
  listSubFolders,
  listFiles,
  findSpreadsheetInFolder,
  readSpreadsheetFromDrive,
  findOrCreateFolder,
  getSheets,
} from '../lib/google-drive'

interface EmployeeMaster {
  code: string
  name: string
}

interface EmployeeStatus {
  code: string
  name: string
  submittedDocs: string[]
  submittedDate: string | null
}

function parseYearArg(): string {
  const yearArg = process.argv.find((a) => a.startsWith('--year='))
  if (yearArg) {
    return yearArg.split('=')[1]
  }
  return getCurrentFiscalYearId()
}

/**
 * 顧問先フォルダ内の「従業員一覧」スプレッドシートを読み取り、従業員マスタを取得
 */
async function getEmployeeMaster(clientFolderId: string): Promise<EmployeeMaster[]> {
  const sheet = await findSpreadsheetInFolder(clientFolderId, '従業員一覧')
  if (!sheet) {
    console.warn(`従業員一覧が見つかりません: folderId=${clientFolderId}`)
    return []
  }

  const rows = await readSpreadsheetFromDrive(sheet.id)
  return rows.slice(1).map((row) => ({
    code: row[0] || '',
    name: row[1] || '',
  })).filter((e) => e.code && e.name)
}

/**
 * 年度フォルダ内の従業員サブフォルダを走査し、提出状況を取得
 */
async function getSubmissionStatus(
  yearFolderId: string
): Promise<Map<string, { docs: string[]; latestDate: string }>> {
  const folders = await listSubFolders(yearFolderId)
  const statusMap = new Map<string, { docs: string[]; latestDate: string }>()

  for (const folder of folders) {
    const files = await listFiles(folder.id, 'application/pdf')
    if (files.length === 0) continue

    const docNames = files.map((f) => f.name.replace('.pdf', ''))
    const latestDate = files
      .map((f) => f.modifiedTime)
      .sort()
      .reverse()[0]

    statusMap.set(folder.name, { docs: docNames, latestDate })
  }

  return statusMap
}

/**
 * スプレッドシートを更新
 */
async function updateSpreadsheet(
  spreadsheetId: string,
  clientName: string,
  yearLabel: string,
  employees: EmployeeMaster[],
  submissions: Map<string, { docs: string[]; latestDate: string }>
) {
  const sheets = getSheets()
  const docLabels = DOCUMENT_TYPES.map((d) => d.label)

  const statusRows: EmployeeStatus[] = employees
    .sort((a, b) => a.code.localeCompare(b.code, 'ja'))
    .map((emp) => {
      const sub = submissions.get(emp.name)
      return {
        code: emp.code,
        name: emp.name,
        submittedDocs: sub ? sub.docs : [],
        submittedDate: sub ? sub.latestDate.split('T')[0] : null,
      }
    })

  const headerRow = ['従業員コード', '氏名', '最終提出日', ...docLabels]

  const dataRows = statusRows.map((emp) => [
    emp.code,
    emp.name,
    emp.submittedDate || '未提出',
    ...docLabels.map((label) => (emp.submittedDocs.includes(label) ? '○' : '')),
  ])

  // シート名に年度を含める
  const statusSheetName = `${yearLabel}_${clientName}`
  const unsubmittedSheetName = `${yearLabel}_${clientName}_未提出者`

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
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests },
    })
  }

  // 提出状況シートを更新
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${statusSheetName}'!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: [headerRow, ...dataRows] },
  })

  // 未提出者リスト
  const unsubmittedEmployees = statusRows.filter(
    (emp) => emp.submittedDocs.length === 0
  )

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${unsubmittedSheetName}'!A1`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [['従業員コード', '氏名'], ...unsubmittedEmployees.map((emp) => [emp.code, emp.name])],
    },
  })

  return {
    total: employees.length,
    submitted: statusRows.filter((e) => e.submittedDocs.length > 0).length,
    unsubmitted: unsubmittedEmployees.length,
  }
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

  const clients = getAllClients()
  console.log(`${clients.length}件の顧問先を処理します...`)

  const results: Array<{
    clientName: string
    total: number
    submitted: number
    unsubmitted: number
  }> = []

  for (const client of clients) {
    console.log(`\n処理中: ${client.name}`)

    try {
      const employees = await getEmployeeMaster(client.driveFolderId)
      if (employees.length === 0) {
        console.warn(`  従業員一覧が空です。スキップします。`)
        continue
      }
      console.log(`  従業員数: ${employees.length}名`)

      // 年度フォルダを探す（なければ作成）
      const yearFolderId = await findOrCreateFolder(
        client.driveFolderId,
        fiscalYear.label
      )

      const submissions = await getSubmissionStatus(yearFolderId)
      console.log(`  提出済みフォルダ数: ${submissions.size}`)

      const result = await updateSpreadsheet(
        spreadsheetId,
        client.name,
        fiscalYear.label,
        employees,
        submissions
      )

      results.push({ clientName: client.name, ...result })
      console.log(
        `  完了: ${result.submitted}/${result.total}名提出済み（未提出: ${result.unsubmitted}名）`
      )
    } catch (error) {
      console.error(`  エラー: ${error}`)
    }
  }

  console.log('\n=== 処理完了 ===')
  for (const r of results) {
    console.log(`${r.clientName}: ${r.submitted}/${r.total}名提出済み`)
  }
}

main().catch((err) => {
  console.error('スクリプトエラー:', err)
  process.exit(1)
})
