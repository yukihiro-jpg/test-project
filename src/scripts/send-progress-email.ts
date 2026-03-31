/**
 * 進捗メール送信スクリプト
 *
 * 実行: npm run cron:email -- --year=R8
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
import type { ConfirmedEmployeeInfo } from '../lib/employee-data'
import { google } from 'googleapis'

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/gmail.send'],
  })
}

function getGmail() {
  return google.gmail({ version: 'v1', auth: getAuth() })
}

interface ClientProgress {
  clientName: string
  totalEmployees: number
  submittedCount: number
  unsubmittedNames: string[]
  newHireNames: string[]
  infoChangedCount: number
  docBreakdown: Record<string, number>
}

function parseYearArg(): string {
  const yearArg = process.argv.find((a) => a.startsWith('--year='))
  return yearArg ? yearArg.split('=')[1] : getCurrentFiscalYearId()
}

async function getClientProgress(
  clientName: string,
  companyFolderId: string
): Promise<ClientProgress> {
  const employees = await loadEmployeeDataFromDrive(companyFolderId)
  const folders = await listSubFoldersInDrive(companyFolderId)

  const submittedNames = new Set<string>()
  const newHireNames: string[] = []
  let infoChangedCount = 0
  const docBreakdown: Record<string, number> = {}

  for (const docType of DOCUMENT_TYPES) {
    docBreakdown[docType.label] = 0
  }

  for (const folder of folders) {
    if (folder.name.startsWith('_')) continue

    const files = await listFilesInDrive(folder.id, 'application/pdf')
    if (files.length === 0) continue

    const isNewHire = folder.name.startsWith('【本年入社】')
    const employeeName = isNewHire ? folder.name.replace('【本年入社】', '') : folder.name

    if (isNewHire) newHireNames.push(employeeName)

    const isEmployee = employees.some((e) => e.name === employeeName)
    if (isEmployee || isNewHire || employees.length === 0) {
      submittedNames.add(employeeName)
      for (const file of files) {
        const docName = file.name.replace('.pdf', '')
        if (docBreakdown[docName] !== undefined) docBreakdown[docName]++
      }
    }

    // 相違あり確認
    const confirmed = await readJsonFromFolder<ConfirmedEmployeeInfo>(folder.id, '_confirmed_info.json')
    if (confirmed?.infoChanged) infoChangedCount++
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
    infoChangedCount,
    docBreakdown,
  }
}

function buildEmailHtml(progressList: ClientProgress[], yearLabel: string, date: string): string {
  let html = `<html><body style="font-family:sans-serif;color:#333;">
    <h2>${yearLabel} 年末調整 書類提出状況レポート</h2>
    <p>集計日時: ${date}</p><hr/>`

  for (const p of progressList) {
    const pct = p.totalEmployees > 0 ? Math.round((p.submittedCount / p.totalEmployees) * 100) : 0
    html += `<h3>${p.clientName}</h3>
      <p><strong>提出率: ${p.submittedCount}/${p.totalEmployees}名 (${pct}%)</strong></p>`

    if (p.infoChangedCount > 0) {
      html += `<p style="color:#c60;">前年相違あり: ${p.infoChangedCount}名</p>`
    }

    html += `<table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;font-size:14px;margin-bottom:8px;">
      <tr style="background:#f0f0f0;"><th>書類名</th><th>提出数</th></tr>`
    for (const [docName, count] of Object.entries(p.docBreakdown)) {
      html += `<tr><td>${docName}</td><td style="text-align:center;">${count}</td></tr>`
    }
    html += `</table>`

    if (p.newHireNames.length > 0) {
      html += `<p style="color:#06c;">本年入社 (${p.newHireNames.length}名):</p><ul>`
      for (const name of p.newHireNames) html += `<li>${name}</li>`
      html += `</ul>`
    }
    if (p.unsubmittedNames.length > 0) {
      html += `<p style="color:#c00;">未提出者 (${p.unsubmittedNames.length}名):</p><ul>`
      for (const name of p.unsubmittedNames) html += `<li>${name}</li>`
      html += `</ul>`
    } else {
      html += `<p style="color:#090;">全員提出済み</p>`
    }
    html += `<hr/>`
  }

  html += `</body></html>`
  return html
}

async function sendEmail(to: string, subject: string, htmlBody: string) {
  const gmail = getGmail()

  const messageParts = [
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    '',
    htmlBody,
  ]

  const rawMessage = messageParts.join('\n')
  const encoded = Buffer.from(rawMessage).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encoded },
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

  const yearFolderId = await getOrCreateYearFolder(fiscalYear.label)
  const clients = await loadClients(yearFolderId)

  const progressList: ClientProgress[] = []
  for (const client of clients) {
    console.log(`  集計中: ${client.name}`)
    try {
      const progress = await getClientProgress(client.name, client.driveFolderId)
      progressList.push(progress)
    } catch (error) {
      console.error(`  エラー: ${client.name}: ${error}`)
    }
  }

  const now = new Date()
  const dateStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  const subject = `【年末調整】${fiscalYear.label} 書類提出状況レポート (${dateStr})`
  const htmlBody = buildEmailHtml(progressList, fiscalYear.label, dateStr)

  console.log(`\nメール送信中: ${notificationEmail}`)
  await sendEmail(notificationEmail, subject, htmlBody)
  console.log('メール送信完了')
}

main().catch((err) => {
  console.error('スクリプトエラー:', err)
  process.exit(1)
})
