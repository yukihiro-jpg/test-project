/**
 * 進捗メール送信スクリプト（日次レポート）
 *
 * - 前日のアップロードログを会社ごとにまとめて表示
 * - 全員提出完了の会社を冒頭に表示
 * - 従来の未提出者リスト・書類別提出数も含む
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
} from '../lib/client-registry'
import {
  checkAllSubmitted,
  readAndClearUploadLog,
  type UploadLogEntry,
} from '../lib/progress-tracker'
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
  clientCode: string
  totalEmployees: number
  submittedCount: number
  allSubmitted: boolean
  unsubmittedNames: string[]
  docBreakdown: Record<string, number>
}

function parseYearArg(): string {
  const yearArg = process.argv.find((a) => a.startsWith('--year='))
  return yearArg ? yearArg.split('=')[1] : getCurrentFiscalYearId()
}

async function getClientProgress(
  clientName: string,
  clientCode: string,
  companyFolderId: string,
): Promise<ClientProgress> {
  const employees = await loadEmployeeDataFromDrive(companyFolderId)
  const folders = await listSubFoldersInDrive(companyFolderId)

  const submittedNames = new Set<string>()
  const docBreakdown: Record<string, number> = {}
  for (const docType of DOCUMENT_TYPES) { docBreakdown[docType.label] = 0 }

  for (const folder of folders) {
    if (folder.name.startsWith('_')) continue
    const files = await listFilesInDrive(folder.id, 'application/pdf')
    if (files.length === 0) continue

    const isNewHire = folder.name.startsWith('【本年入社】')
    const empName = isNewHire ? folder.name.replace('【本年入社】', '') : folder.name
    const isEmployee = employees.some((e) => e.name === empName)

    if (isEmployee || isNewHire || employees.length === 0) {
      submittedNames.add(empName)
      for (const file of files) {
        const docName = file.name.replace('.pdf', '')
        if (docBreakdown[docName] !== undefined) docBreakdown[docName]++
      }
    }
  }

  const completion = await checkAllSubmitted(companyFolderId)
  const unsubmittedNames = employees
    .filter((e) => !submittedNames.has(e.name))
    .sort((a, b) => a.code.localeCompare(b.code, 'ja'))
    .map((e) => `${e.code} ${e.name}`)

  return {
    clientName, clientCode,
    totalEmployees: employees.length || submittedNames.size,
    submittedCount: submittedNames.size,
    allSubmitted: completion.allSubmitted,
    unsubmittedNames,
    docBreakdown,
  }
}

function buildEmailHtml(
  progressList: ClientProgress[],
  uploadLog: UploadLogEntry[],
  yearLabel: string,
  date: string,
): string {
  // 全員完了の会社
  const completedClients = progressList.filter((p) => p.allSubmitted)

  // ログを会社ごとにグループ化
  const logByClient = new Map<string, UploadLogEntry[]>()
  for (const entry of uploadLog) {
    const key = entry.clientName
    if (!logByClient.has(key)) logByClient.set(key, [])
    logByClient.get(key)!.push(entry)
  }

  let html = `<html><body style="font-family:sans-serif;color:#333;">
    <h2>${yearLabel} 年末調整 日次レポート</h2>
    <p>集計日時: ${date}</p>`

  // ★ 全員提出完了
  if (completedClients.length > 0) {
    html += `<div style="background:#e8f5e9;border:2px solid #4caf50;padding:12px;border-radius:8px;margin:16px 0;">`
    for (const c of completedClients) {
      html += `<p style="font-size:16px;font-weight:bold;color:#2e7d32;margin:4px 0;">
        ★ 全員提出完了: ${c.clientName}（${c.totalEmployees}/${c.totalEmployees}名）</p>`
    }
    html += `</div>`
  }

  // --- 昨日の提出 ---
  if (uploadLog.length > 0) {
    html += `<h3>--- 昨日の提出 ---</h3>`
    logByClient.forEach((entries, clientName) => {
      const progress = progressList.find((p) => p.clientName === clientName)
      const cumulative = progress ? `${progress.submittedCount}/${progress.totalEmployees}名` : ''
      html += `<h4>${clientName}（本日提出: ${entries.length}名 / 累計: ${cumulative}）</h4><ul>`
      for (const e of entries) {
        const badge = e.isNewHire ? '<span style="color:#e65100;">[本年入社]</span> ' : ''
        html += `<li>${badge}${e.employeeName} → ${e.docs.join(', ')}</li>`
      }
      html += `</ul>`
    })
  } else {
    html += `<p style="color:#999;">昨日のアップロードはありませんでした。</p>`
  }

  html += `<hr/>`

  // --- 各社の進捗サマリー ---
  for (const p of progressList) {
    const pct = p.totalEmployees > 0 ? Math.round((p.submittedCount / p.totalEmployees) * 100) : 0
    html += `<h3>${p.clientName}</h3>
      <p><strong>提出率: ${p.submittedCount}/${p.totalEmployees}名 (${pct}%)</strong></p>`

    html += `<table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;font-size:14px;margin-bottom:8px;">
      <tr style="background:#f0f0f0;"><th>書類名</th><th>提出数</th></tr>`
    for (const [docName, count] of Object.entries(p.docBreakdown)) {
      html += `<tr><td>${docName}</td><td style="text-align:center;">${count}</td></tr>`
    }
    html += `</table>`

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
    '', htmlBody,
  ]
  const encoded = Buffer.from(messageParts.join('\n')).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  await gmail.users.messages.send({ userId: 'me', requestBody: { raw: encoded } })
}

async function main() {
  const notificationEmail = process.env.NOTIFICATION_EMAIL
  if (!notificationEmail) { console.error('NOTIFICATION_EMAIL が設定されていません'); process.exit(1) }

  const yearId = parseYearArg()
  const fiscalYear = getFiscalYear(yearId)
  if (!fiscalYear) { console.error(`無効な年度: ${yearId}`); process.exit(1) }

  console.log(`対象年度: ${fiscalYear.label}`)

  const yearFolderId = await getOrCreateYearFolder(fiscalYear.label)
  const clients = await loadClients(yearFolderId)

  // アップロードログを読み込み＋クリア
  const uploadLog = await readAndClearUploadLog(yearFolderId)
  console.log(`アップロードログ: ${uploadLog.length}件`)

  // 各社の進捗
  const progressList: ClientProgress[] = []
  for (const client of clients) {
    console.log(`  集計中: ${client.name}`)
    try {
      const progress = await getClientProgress(client.name, client.code, client.driveFolderId)
      progressList.push(progress)
    } catch (error) {
      console.error(`  エラー: ${client.name}: ${error}`)
    }
  }

  const now = new Date()
  const dateStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  const subject = `【年末調整】${fiscalYear.label} 日次レポート (${dateStr})`
  const htmlBody = buildEmailHtml(progressList, uploadLog, fiscalYear.label, dateStr)

  console.log(`\nメール送信中: ${notificationEmail}`)
  await sendEmail(notificationEmail, subject, htmlBody)
  console.log('メール送信完了')
}

main().catch((err) => { console.error('スクリプトエラー:', err); process.exit(1) })
