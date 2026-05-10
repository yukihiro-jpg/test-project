import { google } from 'googleapis'
import { Readable } from 'stream'
import type { Client, ClientsStore, UploadedFile, ClientDetail } from '@/types/report'

const ROOT_FOLDER_ID = process.env.REPORT_APP_FOLDER_ID || ''
const CLIENTS_JSON_NAME = 'clients.json'

function getAuth() {
  const saBase64 = process.env.GCP_SERVICE_ACCOUNT_BASE64
  if (saBase64) {
    const credentials = JSON.parse(Buffer.from(saBase64, 'base64').toString('utf-8'))
    return new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive'],
    })
  }
  return new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/drive'],
  })
}

function getDrive() {
  return google.drive({ version: 'v3', auth: getAuth() })
}

// ファイルをJSONとして読み込む
async function readJsonFile<T>(fileId: string): Promise<T | null> {
  const drive = getDrive()
  try {
    const res = await drive.files.get({ fileId, alt: 'media' })
    return res.data as T
  } catch {
    return null
  }
}

// ファイルをテキストとして読み込む
async function readFileAsBuffer(fileId: string): Promise<Buffer> {
  const drive = getDrive()
  const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'arraybuffer' })
  return Buffer.from(res.data as ArrayBuffer)
}

// フォルダ内でファイルを検索
async function findFile(folderId: string, name: string): Promise<string | null> {
  const drive = getDrive()
  const res = await drive.files.list({
    q: `'${folderId}' in parents and name = '${name}' and trashed = false`,
    fields: 'files(id)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })
  return res.data.files?.[0]?.id ?? null
}

// JSONファイルをDriveに保存（上書き）
async function saveJsonFile(folderId: string, name: string, data: unknown): Promise<string> {
  const drive = getDrive()
  const body = JSON.stringify(data, null, 2)
  const stream = Readable.from([body])

  const existingId = await findFile(folderId, name)
  if (existingId) {
    await drive.files.update({
      fileId: existingId,
      media: { mimeType: 'application/json', body: stream },
      supportsAllDrives: true,
    })
    return existingId
  }

  const res = await drive.files.create({
    requestBody: { name, parents: [folderId] },
    media: { mimeType: 'application/json', body: stream },
    fields: 'id',
    supportsAllDrives: true,
  })
  return res.data.id!
}

// フォルダを作成（または既存を返す）
async function findOrCreateFolder(parentId: string, name: string): Promise<string> {
  const drive = getDrive()
  const res = await drive.files.list({
    q: `'${parentId}' in parents and name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })
  if (res.data.files?.[0]?.id) return res.data.files[0].id

  const created = await drive.files.create({
    requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
    fields: 'id',
    supportsAllDrives: true,
  })
  return created.data.id!
}

// clients.json を読み込む
async function loadClientsStore(): Promise<ClientsStore> {
  const fileId = await findFile(ROOT_FOLDER_ID, CLIENTS_JSON_NAME)
  if (!fileId) return { clients: [], updatedAt: new Date().toISOString() }
  const data = await readJsonFile<ClientsStore>(fileId)
  return data ?? { clients: [], updatedAt: new Date().toISOString() }
}

// clients.json を保存
async function saveClientsStore(store: ClientsStore): Promise<void> {
  store.updatedAt = new Date().toISOString()
  await saveJsonFile(ROOT_FOLDER_ID, CLIENTS_JSON_NAME, store)
}

// ---- 公開API ----

export async function listClients(): Promise<Client[]> {
  const store = await loadClientsStore()
  return store.clients
}

export async function getClient(id: string): Promise<Client | null> {
  const store = await loadClientsStore()
  return store.clients.find(c => c.id === id) ?? null
}

export async function createClient(client: Client): Promise<Client> {
  // 顧問先専用フォルダをDriveに作成
  const folderName = `${client.id}_${client.name}`
  const folderId = await findOrCreateFolder(ROOT_FOLDER_ID, folderName)
  client.folderId = folderId

  const store = await loadClientsStore()
  store.clients.push(client)
  await saveClientsStore(store)
  return client
}

export async function updateClient(id: string, updates: Partial<Client>): Promise<Client | null> {
  const store = await loadClientsStore()
  const idx = store.clients.findIndex(c => c.id === id)
  if (idx < 0) return null
  store.clients[idx] = { ...store.clients[idx], ...updates }
  await saveClientsStore(store)
  return store.clients[idx]
}

export async function deleteClient(id: string): Promise<void> {
  const store = await loadClientsStore()
  store.clients = store.clients.filter(c => c.id !== id)
  await saveClientsStore(store)
}

// クライアントのアップロード済みファイル一覧を取得
async function getClientFiles(client: Client): Promise<UploadedFile[]> {
  if (!client.folderId) return []
  const fileId = await findFile(client.folderId, 'files.json')
  if (!fileId) return []
  const data = await readJsonFile<{ files: UploadedFile[] }>(fileId)
  return data?.files ?? []
}

// クライアント詳細（ファイル情報含む）を取得
export async function getClientDetail(id: string): Promise<ClientDetail | null> {
  const client = await getClient(id)
  if (!client) return null
  const files = await getClientFiles(client)
  return { ...client, files }
}

// ファイルをクライアントフォルダにアップロード
export async function uploadClientFile(
  clientId: string,
  yearLabel: string,
  filename: string,
  buffer: Buffer,
  mimeType: string
): Promise<UploadedFile> {
  const client = await getClient(clientId)
  if (!client?.folderId) throw new Error('Client folder not found')

  const drive = getDrive()

  // 既存の同じ期のファイルを削除
  const existingFiles = await getClientFiles(client)
  const existing = existingFiles.find(f => f.yearLabel === yearLabel)
  if (existing) {
    try {
      await drive.files.delete({ fileId: existing.fileId, supportsAllDrives: true })
    } catch {}
  }

  // 新しいファイルをアップロード
  const stream = Readable.from([buffer])
  const res = await drive.files.create({
    requestBody: { name: filename, parents: [client.folderId] },
    media: { mimeType, body: stream },
    fields: 'id, name',
    supportsAllDrives: true,
  })

  const uploaded: UploadedFile = {
    fileId: res.data.id!,
    fileName: filename,
    yearLabel,
    uploadedAt: new Date().toISOString(),
  }

  // files.json を更新
  const updatedFiles = existingFiles.filter(f => f.yearLabel !== yearLabel)
  updatedFiles.push(uploaded)
  await saveJsonFile(client.folderId, 'files.json', { files: updatedFiles })

  return uploaded
}

// クライアントのファイルをBufferとして読み込む
export async function downloadClientFile(fileId: string): Promise<Buffer> {
  return readFileAsBuffer(fileId)
}
