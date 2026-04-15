/**
 * Google OAuth 2.0 クライアント
 *
 * Node.js ランタイム（API Routes）で動作。
 * ミドルウェア（Edge Runtime）では使わない。
 */

import { google } from 'googleapis'

const SCOPES = [
  'openid',
  'email',
  'profile',
  // Gmail 送信用
  'https://www.googleapis.com/auth/gmail.send',
  // Drive 保存用
  'https://www.googleapis.com/auth/drive.file',
]

export function getOAuthClient() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth の環境変数が未設定です')
  }

  return new google.auth.OAuth2(clientId, clientSecret, `${appUrl}/api/auth/callback`)
}

export function getAuthorizationUrl(state: string): string {
  const client = getOAuthClient()
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state,
  })
}

export async function exchangeCodeForTokens(code: string) {
  const client = getOAuthClient()
  const { tokens } = await client.getToken(code)
  return tokens
}

/**
 * アクセストークンからユーザーのメールアドレスを取得
 */
export async function getUserEmail(accessToken: string): Promise<string | null> {
  const client = getOAuthClient()
  client.setCredentials({ access_token: accessToken })
  const oauth2 = google.oauth2({ version: 'v2', auth: client })
  const { data } = await oauth2.userinfo.get()
  return data.email || null
}
