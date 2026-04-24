/**
 * JSONファイルベースの簡易データストア。
 * 事務所2人運用かつデータ量が小さい前提のため、Next.jsサーバ内で直接読み書きする。
 * 将来Google Sheets / Supabase等に差し替えやすいように全アクセスをここに集約する。
 */
import { promises as fs } from 'fs'
import path from 'path'
import type {
  Client,
  Deadline,
  GroupwareData,
  LauncherApp,
  RequestItem,
} from './types'

const DATA_DIR = process.env.GROUPWARE_DATA_DIR
  ? path.resolve(process.env.GROUPWARE_DATA_DIR)
  : path.join(process.cwd(), 'data')
const DATA_FILE = path.join(DATA_DIR, 'groupware.json')

const DEFAULT_DATA: GroupwareData = {
  clients: [],
  deadlines: [],
  requests: [],
  launcherApps: [
    {
      id: 'nenmatsu-chosei',
      name: '年末調整書類アップロード',
      description: '従業員が控除証明書等をスマホで撮影・提出するアプリ',
      url: '/apps/nenmatsu-chosei',
      type: 'web',
      icon: '📄',
      color: '#34c759',
      openInNewTab: false,
      order: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
}

async function ensureFile(): Promise<void> {
  try {
    await fs.access(DATA_FILE)
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true })
    await fs.writeFile(DATA_FILE, JSON.stringify(DEFAULT_DATA, null, 2), 'utf8')
  }
}

export async function readData(): Promise<GroupwareData> {
  await ensureFile()
  const raw = await fs.readFile(DATA_FILE, 'utf8')
  try {
    const parsed = JSON.parse(raw) as Partial<GroupwareData>
    return {
      clients: parsed.clients ?? [],
      deadlines: parsed.deadlines ?? [],
      requests: parsed.requests ?? [],
      launcherApps: parsed.launcherApps ?? DEFAULT_DATA.launcherApps,
    }
  } catch {
    return { ...DEFAULT_DATA }
  }
}

let writeLock: Promise<void> = Promise.resolve()

async function writeData(data: GroupwareData): Promise<void> {
  const prev = writeLock
  let release!: () => void
  writeLock = new Promise((resolve) => {
    release = resolve
  })
  try {
    await prev
    await fs.mkdir(DATA_DIR, { recursive: true })
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf8')
  } finally {
    release()
  }
}

export async function mutate<T>(
  fn: (data: GroupwareData) => { data: GroupwareData; result: T },
): Promise<T> {
  const data = await readData()
  const { data: next, result } = fn(data)
  await writeData(next)
  return result
}

function newId(prefix: string): string {
  const t = Date.now().toString(36)
  const r = Math.random().toString(36).slice(2, 8)
  return `${prefix}_${t}${r}`
}

function now(): string {
  return new Date().toISOString()
}

// --- Clients ---

export async function listClients(): Promise<Client[]> {
  const data = await readData()
  return [...data.clients].sort((a, b) => a.name.localeCompare(b.name, 'ja'))
}

export async function getClient(id: string): Promise<Client | undefined> {
  const data = await readData()
  return data.clients.find((c) => c.id === id)
}

export async function createClient(
  input: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<Client> {
  return mutate((data) => {
    const client: Client = {
      ...input,
      id: newId('cli'),
      createdAt: now(),
      updatedAt: now(),
    }
    return {
      data: { ...data, clients: [...data.clients, client] },
      result: client,
    }
  })
}

export async function updateClient(
  id: string,
  patch: Partial<Omit<Client, 'id' | 'createdAt'>>,
): Promise<Client | undefined> {
  return mutate((data) => {
    const idx = data.clients.findIndex((c) => c.id === id)
    if (idx < 0) return { data, result: undefined }
    const updated: Client = { ...data.clients[idx], ...patch, id, updatedAt: now() }
    const next = [...data.clients]
    next[idx] = updated
    return { data: { ...data, clients: next }, result: updated }
  })
}

export async function deleteClient(id: string): Promise<boolean> {
  return mutate((data) => {
    const exists = data.clients.some((c) => c.id === id)
    if (!exists) return { data, result: false }
    return {
      data: {
        ...data,
        clients: data.clients.filter((c) => c.id !== id),
        deadlines: data.deadlines.filter((d) => d.clientId !== id),
        requests: data.requests.filter((r) => r.clientId !== id),
      },
      result: true,
    }
  })
}

// --- Deadlines ---

export async function listDeadlines(clientId?: string): Promise<Deadline[]> {
  const data = await readData()
  const list = clientId ? data.deadlines.filter((d) => d.clientId === clientId) : data.deadlines
  return [...list].sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}

export async function getDeadline(id: string): Promise<Deadline | undefined> {
  const data = await readData()
  return data.deadlines.find((d) => d.id === id)
}

export async function createDeadline(
  input: Omit<Deadline, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<Deadline> {
  return mutate((data) => {
    const d: Deadline = {
      ...input,
      id: newId('dl'),
      createdAt: now(),
      updatedAt: now(),
    }
    return { data: { ...data, deadlines: [...data.deadlines, d] }, result: d }
  })
}

export async function bulkCreateDeadlines(
  inputs: Array<Omit<Deadline, 'id' | 'createdAt' | 'updatedAt'>>,
): Promise<Deadline[]> {
  return mutate((data) => {
    const created = inputs.map((input) => ({
      ...input,
      id: newId('dl'),
      createdAt: now(),
      updatedAt: now(),
    }))
    return {
      data: { ...data, deadlines: [...data.deadlines, ...created] },
      result: created,
    }
  })
}

export async function updateDeadline(
  id: string,
  patch: Partial<Omit<Deadline, 'id' | 'createdAt'>>,
): Promise<Deadline | undefined> {
  return mutate((data) => {
    const idx = data.deadlines.findIndex((d) => d.id === id)
    if (idx < 0) return { data, result: undefined }
    const updated: Deadline = { ...data.deadlines[idx], ...patch, id, updatedAt: now() }
    const next = [...data.deadlines]
    next[idx] = updated
    return { data: { ...data, deadlines: next }, result: updated }
  })
}

export async function deleteDeadline(id: string): Promise<boolean> {
  return mutate((data) => {
    const exists = data.deadlines.some((d) => d.id === id)
    if (!exists) return { data, result: false }
    return {
      data: { ...data, deadlines: data.deadlines.filter((d) => d.id !== id) },
      result: true,
    }
  })
}

// --- Requests ---

export async function listRequests(clientId?: string): Promise<RequestItem[]> {
  const data = await readData()
  const list = clientId ? data.requests.filter((r) => r.clientId === clientId) : data.requests
  return [...list].sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'))
}

export async function createRequest(
  input: Omit<RequestItem, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<RequestItem> {
  return mutate((data) => {
    const r: RequestItem = {
      ...input,
      id: newId('req'),
      createdAt: now(),
      updatedAt: now(),
    }
    return { data: { ...data, requests: [...data.requests, r] }, result: r }
  })
}

export async function bulkCreateRequests(
  inputs: Array<Omit<RequestItem, 'id' | 'createdAt' | 'updatedAt'>>,
): Promise<RequestItem[]> {
  return mutate((data) => {
    const created = inputs.map((input) => ({
      ...input,
      id: newId('req'),
      createdAt: now(),
      updatedAt: now(),
    }))
    return {
      data: { ...data, requests: [...data.requests, ...created] },
      result: created,
    }
  })
}

export async function updateRequest(
  id: string,
  patch: Partial<Omit<RequestItem, 'id' | 'createdAt'>>,
): Promise<RequestItem | undefined> {
  return mutate((data) => {
    const idx = data.requests.findIndex((r) => r.id === id)
    if (idx < 0) return { data, result: undefined }
    const updated: RequestItem = { ...data.requests[idx], ...patch, id, updatedAt: now() }
    const next = [...data.requests]
    next[idx] = updated
    return { data: { ...data, requests: next }, result: updated }
  })
}

export async function deleteRequest(id: string): Promise<boolean> {
  return mutate((data) => {
    const exists = data.requests.some((r) => r.id === id)
    if (!exists) return { data, result: false }
    return {
      data: { ...data, requests: data.requests.filter((r) => r.id !== id) },
      result: true,
    }
  })
}

// --- Launcher ---

export async function listLauncherApps(): Promise<LauncherApp[]> {
  const data = await readData()
  return [...data.launcherApps].sort((a, b) => a.order - b.order)
}

export async function createLauncherApp(
  input: Omit<LauncherApp, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<LauncherApp> {
  return mutate((data) => {
    const app: LauncherApp = {
      ...input,
      id: newId('app'),
      createdAt: now(),
      updatedAt: now(),
    }
    return {
      data: { ...data, launcherApps: [...data.launcherApps, app] },
      result: app,
    }
  })
}

export async function updateLauncherApp(
  id: string,
  patch: Partial<Omit<LauncherApp, 'id' | 'createdAt'>>,
): Promise<LauncherApp | undefined> {
  return mutate((data) => {
    const idx = data.launcherApps.findIndex((a) => a.id === id)
    if (idx < 0) return { data, result: undefined }
    const updated: LauncherApp = {
      ...data.launcherApps[idx],
      ...patch,
      id,
      updatedAt: now(),
    }
    const next = [...data.launcherApps]
    next[idx] = updated
    return { data: { ...data, launcherApps: next }, result: updated }
  })
}

export async function deleteLauncherApp(id: string): Promise<boolean> {
  return mutate((data) => {
    const exists = data.launcherApps.some((a) => a.id === id)
    if (!exists) return { data, result: false }
    return {
      data: {
        ...data,
        launcherApps: data.launcherApps.filter((a) => a.id !== id),
      },
      result: true,
    }
  })
}
