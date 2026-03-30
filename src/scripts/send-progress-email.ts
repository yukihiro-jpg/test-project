/**
 * 進捗メール送信スクリプト
 *
 * 毎朝6:30に実行し、全顧問先の書類提出状況をまとめたメールを送信する。
 *
 * 実行: npm run cron:email -- --year=R8
 * cron設定例: 30 6 * * * cd /path/to/project && npm run cron:email -- --year=R8
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
  getGmail,
} from '../lib/google-drive'

interface EmployeeMaster {
  code: string
  name: string
}

interface ClientProgress {
  clientName: string
  totalEmployees: number
  submittedCount: number
  unsubmittedNames: string[]
  newHireNames: string[]
  docBreakdown: Record<string, number>
}

function parseYearArg(): string {
  const yearArg = process.argv.find((a) => a.startsWith('--year='))
  if (yearArg) {
    return yearArg.split('=')[1]
  }
  return getCurrentFiscalYearId()
}

async function getEmployeeMaster(clientFolderId: string): Promise<EmployeeMaster[]> {
  const sheet = await findSpreadsheetInFolder(clientFolderId, '従業員一覧')
  if (!sheet) return []

  const rows = await readSpreadsheetFromDrive(sheet.id)
  return rows
    .slice(1)
    .map((row) => ({ code: row[0] || '', name: row[1] || '' }))
    .filter((e) => e.code && e.name)
}

async function getClientProgress(
  clientName: string,
  clientFolderId: string,
  yearLabel: string
): Promise<ClientProgress> {
  const employees = await getEmployeeMaster(clientFolderId)

  // 年度フォルダを探す
  const yearFolderId = await findOrCreateFolder(clientFolderId, yearLabel)
  const folders = await listSubFolders(yearFolderId)

  const submittedNames = new Set<string>()
  const newHireNames: string[] = []
  const docBreakdown: Record<string, number> = {}

  for (const docType of DOCUMENT_TYPES) {
    docBreakdown[docType.label] = 0
  }

  for (const folder of folders) {
    const files = await listFiles(folder.id, 'application/pdf')
    if (files.length === 0) continue

    const isNewHire = folder.name.startsWith('【本年入社】')
    const employeeName = isNewHire
      ? folder.name.replace('【本年入社】', '')
      : folder.name

    if (isNewHire) {
      newHireNames.push(employeeName)
    }

    const isEmployee = employees.some((e) => e.name === employeeName)
    if (isEmployee || isNewHire || employees.length === 0) {
      submittedNames.add(employeeName)

      for (const file of files) {
        const docName = file.name.replace('.pdf', '')
        if (docBreakdown[docName] !== undefined) {
          docBreakdown[docName]++
        }
      }
    }
  }

  const unsubmittedNames = employees
    .filter((e) => !submittedNames.has(e.name))
    .sort((a, b) => a.code.localeCompare(b.code, 'ja'))
    .map((e) => `${e.code} ${e.name}`)

  return {
    clientName,
    totalEmployees: employees.length || submittedNames.size,
    submittedCount: submittedNames.size,
    unsubmittedNames,
    newHireNames,
    docBreakdown,
  }
}

function buildEmailHtml(progressList: ClientProgress[], yearLabel: string, date: string): string {
  let html = `
    <html><body style="font-family: sans-serif; color: #333;">
    <h2>${yearLabel} 年末調整 書類提出状況レポート</h2>
    <p>集計日時: ${date}</p>
    <hr/>
  `

  for (const progress of progressList) {
    const pct =
      progress.totalEmployees > 0
        ? Math.round((progress.submittedCount / progress.totalEmployees) * 100)
        : 0

    html += `
      <h3>${progress.clientName}</h3>
      <p><strong>提出率: ${progress.submittedCount}/${progress.totalEmployees}名 (${pct}%)</strong></p>
    `

    html += `<table border="1" cellpadding="4" cellspacing="0" style="border-collapse: collapse; font-size: 14px; margin-bottom: 8px;">
      <tr style="background: #f0f0f0;"><th>書類名</th><th>提出数</th></tr>`
    for (const [docName, count] of Object.entries(progress.docBreakdown)) {
      html += `<tr><td>${docName}</td><td style="text-align: center;">${count}</td></tr>`
    }
    html += `</table>`

    if (progress.newHireNames.length > 0) {
      html += `<p style="color: #06c;">本年入社 (${progress.newHireNames.length}名):</p><ul>`
      for (const name of progress.newHireNames) {
        html += `<li>${name}</li>`
      }
      html += `</ul>`
    }

    if (progress.unsubmittedNames.length > 0) {
      html += `<p style="color: #c00;">未提出者 (${progress.unsubmittedNames.length}名):</p><ul>`
      for (const name of progress.unsubmittedNames) {
        html += `<li>${name}</li>`
      }
      html += `</ul>`
    } else {
      html += `<p style="color: #090;">全員提出済み</p>`
    }

    html += `<hr/>`
  }

  html += `</body></html>`
  return html
}

function buildEmailText(progressList: ClientProgress[], yearLabel: string, date: string): string {
  let text = `${yearLabel} 年末調整 書類提出状況レポート\n集計日時: ${date}\n\n`

  for (const progress of progressList) {
    const pct =
      progress.totalEmployees > 0
        ? Math.round((progress.submittedCount / progress.totalEmployees) * 100)
        : 0

    text += `== ${progress.clientName} ==\n`
    text += `提出率: ${progress.submittedCount}/${progress.totalEmployees}名 (${pct}%)\n\n`

    if (progress.newHireNames.length > 0) {
      text += `本年入社 (${progress.newHireNames.length}名):\n`
      for (const name of progress.newHireNames) {
        text += `  - ${name}\n`
      }
      text += `\n`
    }

    if (progress.unsubmittedNames.length > 0) {
      text += `未提出者 (${progress.unsubmittedNames.length}名):\n`
      for (const name of progress.unsubmittedNames) {
        text += `  - ${name}\n`
      }
    } else {
      text += `全員提出済み\n`
    }
    text += `\n`
  }

  return text
}

async function sendEmail(
  to: string,
  subject: string,
  htmlBody: string,
  textBody: string
) {
  const gmail = getGmail()

  const messageParts = [
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
    'MIME-Version: 1.0',
    'Content-Type: multipart/alternative; boundary="boundary"',
    '',
    '--boundary',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    textBody,
    '--boundary',
    'Content-Type: text/html; charset=UTF-8',
    '',
    htmlBody,
    '--boundary--',
  ]

  const rawMessage = messageParts.join('\n')
  const encodedMessage = Buffer.from(rawMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encodedMessage },
  })
}

async function main() {
  const notificationEmail = process.env.NOTIFICATION_EMAIL
  if (!notificationEmail) {
    console.error('NOTIFICATION_EMAIL が設定されていません')
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
  console.log(`${clients.length}件の顧問先の進捗を集計中...`)

  const progressList: ClientProgress[] = []

  for (const client of clients) {
    console.log(`  集計中: ${client.name}`)
    try {
      const progress = await getClientProgress(
        client.name,
        client.driveFolderId,
        fiscalYear.label
      )
      progressList.push(progress)
    } catch (error) {
      console.error(`  エラー: ${client.name}: ${error}`)
    }
  }

  const now = new Date()
  const dateStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  const subject = `【年末調整】${fiscalYear.label} 書類提出状況レポート (${dateStr})`
  const htmlBody = buildEmailHtml(progressList, fiscalYear.label, dateStr)
  const textBody = buildEmailText(progressList, fiscalYear.label, dateStr)

  console.log(`\nメール送信中: ${notificationEmail}`)
  await sendEmail(notificationEmail, subject, htmlBody, textBody)
  console.log('メール送信完了')
}

main().catch((err) => {
  console.error('スクリプトエラー:', err)
  process.exit(1)
})
