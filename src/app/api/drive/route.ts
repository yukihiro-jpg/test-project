import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { cookies } from 'next/headers'

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/auth/callback/google`,
  )
}

async function getAuthedDrive() {
  const cookieStore = await cookies()
  const tokensCookie = cookieStore.get('google_tokens')
  if (!tokensCookie) throw new Error('NOT_AUTHENTICATED')

  const tokens = JSON.parse(tokensCookie.value)
  const oauth2Client = getOAuth2Client()
  oauth2Client.setCredentials(tokens)

  // トークン更新時にクッキーを更新
  oauth2Client.on('tokens', async (newTokens) => {
    const merged = { ...tokens, ...newTokens }
    const cs = await cookies()
    cs.set('google_tokens', JSON.stringify(merged), {
      httpOnly: true, secure: false, sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365, path: '/',
    })
  })

  return google.drive({ version: 'v3', auth: oauth2Client })
}

const ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || ''

async function findOrCreateFolder(drive: ReturnType<typeof google.drive>, name: string, parentId: string): Promise<string> {
  const res = await drive.files.list({
    q: `name='${name}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })
  if (res.data.files && res.data.files.length > 0) return res.data.files[0].id!

  const folder = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
    supportsAllDrives: true,
  })
  return folder.data.id!
}

async function readFile(drive: ReturnType<typeof google.drive>, fileName: string, folderId: string): Promise<string | null> {
  const res = await drive.files.list({
    q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
    fields: 'files(id)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })
  if (!res.data.files || res.data.files.length === 0) return null

  const fileId = res.data.files[0].id!
  const content = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'text' },
  )
  return content.data as string
}

async function writeFile(drive: ReturnType<typeof google.drive>, fileName: string, folderId: string, content: string): Promise<void> {
  const res = await drive.files.list({
    q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
    fields: 'files(id)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })

  const media = { mimeType: 'application/json', body: content }

  if (res.data.files && res.data.files.length > 0) {
    await drive.files.update({
      fileId: res.data.files[0].id!,
      media,
      supportsAllDrives: true,
    })
  } else {
    await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId],
      },
      media,
      fields: 'id',
      supportsAllDrives: true,
    })
  }
}

// GET: Drive からデータ読み込み
export async function GET(request: NextRequest) {
  try {
    const drive = await getAuthedDrive()
    const clientId = request.nextUrl.searchParams.get('clientId') || '_global'
    const key = request.nextUrl.searchParams.get('key')
    if (!key) return NextResponse.json({ error: 'key is required' }, { status: 400 })

    const appFolder = await findOrCreateFolder(drive, 'accounting-app-data', ROOT_FOLDER_ID)
    const clientFolder = await findOrCreateFolder(drive, clientId, appFolder)
    const data = await readFile(drive, `${key}.json`, clientFolder)

    return NextResponse.json({ data: data ? JSON.parse(data) : null })
  } catch (err) {
    if (err instanceof Error && err.message === 'NOT_AUTHENTICATED') {
      return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 })
    }
    console.error('Drive read error:', err)
    return NextResponse.json({ error: 'Drive read failed' }, { status: 500 })
  }
}

// POST: Drive にデータ書き込み
export async function POST(request: NextRequest) {
  try {
    const drive = await getAuthedDrive()
    const { clientId = '_global', key, data } = await request.json()
    if (!key) return NextResponse.json({ error: 'key is required' }, { status: 400 })

    const appFolder = await findOrCreateFolder(drive, 'accounting-app-data', ROOT_FOLDER_ID)
    const clientFolder = await findOrCreateFolder(drive, clientId, appFolder)
    await writeFile(drive, `${key}.json`, clientFolder, JSON.stringify(data))

    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof Error && err.message === 'NOT_AUTHENTICATED') {
      return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 })
    }
    console.error('Drive write error:', err)
    return NextResponse.json({ error: 'Drive write failed' }, { status: 500 })
  }
}

// PUT: localStorageの全データをDriveに一括アップロード
export async function PUT(request: NextRequest) {
  try {
    const drive = await getAuthedDrive()
    const { items } = await request.json() as { items: { clientId: string; key: string; data: unknown }[] }

    const appFolder = await findOrCreateFolder(drive, 'accounting-app-data', ROOT_FOLDER_ID)
    const folderCache: Record<string, string> = {}

    for (const item of items) {
      const cid = item.clientId || '_global'
      if (!folderCache[cid]) {
        folderCache[cid] = await findOrCreateFolder(drive, cid, appFolder)
      }
      await writeFile(drive, `${item.key}.json`, folderCache[cid], JSON.stringify(item.data))
    }

    return NextResponse.json({ success: true, count: items.length })
  } catch (err) {
    if (err instanceof Error && err.message === 'NOT_AUTHENTICATED') {
      return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 })
    }
    console.error('Drive bulk write error:', err)
    return NextResponse.json({ error: 'Drive bulk write failed' }, { status: 500 })
  }
}
