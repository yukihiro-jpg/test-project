/**
 * Gmail API クライアント
 *
 * 税理士（自分）の Gmail から顧問先社長へ月次報告を送信する。
 * OAuth の refresh_token をユーザーごとに保存して送信時に使用する想定。
 *
 * 添付ファイル：PDF / Excel（最大 25MB まで）
 */

import { google } from 'googleapis'

export interface SendMailOptions {
  accessToken: string
  refreshToken?: string
  from: string
  to: string
  cc?: string
  subject: string
  bodyText: string
  attachments: Array<{ filename: string; mimeType: string; content: Buffer }>
}

export async function sendMail(opts: SendMailOptions): Promise<string> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('OAuth 環境変数が未設定')

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret)
  oauth2.setCredentials({
    access_token: opts.accessToken,
    refresh_token: opts.refreshToken,
  })
  const gmail = google.gmail({ version: 'v1', auth: oauth2 })

  const raw = buildRawMessage(opts)
  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw },
  })
  return res.data.id ?? ''
}

/**
 * RFC 2822 形式のメールを multipart/mixed で構築
 */
function buildRawMessage(opts: SendMailOptions): string {
  const boundary = `----=_Boundary_${Date.now()}`
  const lines: string[] = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    ...(opts.cc ? [`Cc: ${opts.cc}`] : []),
    `Subject: =?UTF-8?B?${Buffer.from(opts.subject, 'utf-8').toString('base64')}?=`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(opts.bodyText, 'utf-8').toString('base64'),
  ]

  for (const att of opts.attachments) {
    lines.push(
      '',
      `--${boundary}`,
      `Content-Type: ${att.mimeType}; name="${att.filename}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${att.filename}"`,
      '',
      att.content.toString('base64'),
    )
  }
  lines.push('', `--${boundary}--`)

  return Buffer.from(lines.join('\r\n'), 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}
