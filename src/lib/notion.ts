/**
 * Notion API クライアント・ユーティリティ
 *
 * 税務業務管理用の4つのデータベース（顧客管理・進捗管理・依頼資料リスト・タスク管理）を操作する。
 * Google Drive/Sheets 連携とは完全に独立している。
 *
 * 必要な環境変数:
 *   NOTION_API_KEY         - Notion Integration のシークレットキー
 *   NOTION_DB_CLIENTS      - 顧客管理 DB の ID
 *   NOTION_DB_PROGRESS     - 進捗管理 DB の ID
 *   NOTION_DB_DOCUMENTS    - 依頼資料リスト DB の ID
 *   NOTION_DB_TASKS        - タスク管理 DB の ID
 */

import { Client, APIErrorCode } from '@notionhq/client'
import type {
  CreatePageParameters,
  QueryDatabaseParameters,
  UpdatePageParameters,
  PageObjectResponse,
} from '@notionhq/client/build/src/api-endpoints'

// ---------- クライアント ----------

let _client: Client | null = null

export function getNotionClient(): Client {
  if (!_client) {
    const apiKey = process.env.NOTION_API_KEY
    if (!apiKey) throw new Error('NOTION_API_KEY が設定されていません')
    _client = new Client({ auth: apiKey })
  }
  return _client
}

// ---------- レート制限対策 (Notion 無料プラン: 3 req/s) ----------

const RETRY_DELAYS = [500, 1000, 2000]

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      return await fn()
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code
      if (code === APIErrorCode.RateLimited && attempt < RETRY_DELAYS.length) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]))
        continue
      }
      throw err
    }
  }
  throw new Error('Notion API: リトライ上限に達しました')
}

// ---------- 型定義 ----------

export interface NotionClient {
  id: string
  顧客名: string
  顧客コード: string
  担当者: string
  電話番号: string
  メールアドレス: string
  ステータス: string
  備考: string
}

export interface NotionProgress {
  id: string
  業務名: string
  顧客id: string
  顧客名: string
  業務種別: string
  ステータス: string
  期限: string
  完了日: string
  備考: string
}

export interface NotionDocument {
  id: string
  資料名: string
  顧客id: string
  顧客名: string
  資料種別: string
  ステータス: string
  依頼日: string
  受取日: string
  備考: string
}

export interface NotionTask {
  id: string
  タスク名: string
  顧客id: string
  顧客名: string
  優先度: string
  ステータス: string
  期限: string
  備考: string
}

// ---------- プロパティ読み取りヘルパー ----------

type PageProps = PageObjectResponse['properties']

function getText(props: PageProps, key: string): string {
  const p = props[key]
  if (!p) return ''
  if (p.type === 'title') return p.title.map((t) => t.plain_text).join('')
  if (p.type === 'rich_text') return p.rich_text.map((t) => t.plain_text).join('')
  if (p.type === 'phone_number') return p.phone_number ?? ''
  if (p.type === 'email') return p.email ?? ''
  return ''
}

function getSelect(props: PageProps, key: string): string {
  const p = props[key]
  if (!p || p.type !== 'select') return ''
  return p.select?.name ?? ''
}

function getDate(props: PageProps, key: string): string {
  const p = props[key]
  if (!p || p.type !== 'date') return ''
  return p.date?.start ?? ''
}

function getRelationId(props: PageProps, key: string): string {
  const p = props[key]
  if (!p || p.type !== 'relation') return ''
  return p.relation[0]?.id ?? ''
}

// ---------- 顧客管理 ----------

function dbClients(): string {
  const id = process.env.NOTION_DB_CLIENTS
  if (!id) throw new Error('NOTION_DB_CLIENTS が設定されていません')
  return id
}

export async function getClients(): Promise<NotionClient[]> {
  const notion = getNotionClient()
  const params: QueryDatabaseParameters = {
    database_id: dbClients(),
    sorts: [{ property: '顧客名', direction: 'ascending' }],
  }
  const res = await withRetry(() => notion.databases.query(params))
  return res.results.map((page) => {
    const p = (page as PageObjectResponse).properties
    return {
      id: page.id,
      顧客名: getText(p, '顧客名'),
      顧客コード: getText(p, '顧客コード'),
      担当者: getText(p, '担当者'),
      電話番号: getText(p, '電話番号'),
      メールアドレス: getText(p, 'メールアドレス'),
      ステータス: getSelect(p, 'ステータス'),
      備考: getText(p, '備考'),
    }
  })
}

export async function createClient(data: Omit<NotionClient, 'id'>): Promise<string> {
  const notion = getNotionClient()
  const params: CreatePageParameters = {
    parent: { database_id: dbClients() },
    properties: {
      顧客名: { title: [{ text: { content: data.顧客名 } }] },
      顧客コード: { rich_text: [{ text: { content: data.顧客コード } }] },
      担当者: { rich_text: [{ text: { content: data.担当者 } }] },
      電話番号: { phone_number: data.電話番号 || null },
      メールアドレス: { email: data.メールアドレス || null },
      ステータス: { select: data.ステータス ? { name: data.ステータス } : null },
      備考: { rich_text: [{ text: { content: data.備考 } }] },
    },
  }
  const res = await withRetry(() => notion.pages.create(params))
  return res.id
}

export async function updateClient(id: string, data: Partial<Omit<NotionClient, 'id'>>): Promise<void> {
  const notion = getNotionClient()
  const properties: UpdatePageParameters['properties'] = {}
  if (data.顧客名 !== undefined) properties['顧客名'] = { title: [{ text: { content: data.顧客名 } }] }
  if (data.顧客コード !== undefined) properties['顧客コード'] = { rich_text: [{ text: { content: data.顧客コード } }] }
  if (data.担当者 !== undefined) properties['担当者'] = { rich_text: [{ text: { content: data.担当者 } }] }
  if (data.電話番号 !== undefined) properties['電話番号'] = { phone_number: data.電話番号 || null }
  if (data.メールアドレス !== undefined) properties['メールアドレス'] = { email: data.メールアドレス || null }
  if (data.ステータス !== undefined) properties['ステータス'] = { select: data.ステータス ? { name: data.ステータス } : null }
  if (data.備考 !== undefined) properties['備考'] = { rich_text: [{ text: { content: data.備考 } }] }
  await withRetry(() => notion.pages.update({ page_id: id, properties }))
}

export async function deleteClient(id: string): Promise<void> {
  const notion = getNotionClient()
  await withRetry(() => notion.pages.update({ page_id: id, archived: true }))
}

// ---------- 進捗管理 ----------

function dbProgress(): string {
  const id = process.env.NOTION_DB_PROGRESS
  if (!id) throw new Error('NOTION_DB_PROGRESS が設定されていません')
  return id
}

export async function getProgressList(): Promise<NotionProgress[]> {
  const notion = getNotionClient()
  const res = await withRetry(() =>
    notion.databases.query({
      database_id: dbProgress(),
      sorts: [{ property: '期限', direction: 'ascending' }],
    })
  )
  return res.results.map((page) => {
    const p = (page as PageObjectResponse).properties
    return {
      id: page.id,
      業務名: getText(p, '業務名'),
      顧客id: getRelationId(p, '顧客'),
      顧客名: '',
      業務種別: getSelect(p, '業務種別'),
      ステータス: getSelect(p, 'ステータス'),
      期限: getDate(p, '期限'),
      完了日: getDate(p, '完了日'),
      備考: getText(p, '備考'),
    }
  })
}

export async function createProgress(data: Omit<NotionProgress, 'id' | '顧客名'>): Promise<string> {
  const notion = getNotionClient()
  const properties: CreatePageParameters['properties'] = {
    業務名: { title: [{ text: { content: data.業務名 } }] },
    業務種別: { select: data.業務種別 ? { name: data.業務種別 } : null },
    ステータス: { select: data.ステータス ? { name: data.ステータス } : null },
    備考: { rich_text: [{ text: { content: data.備考 } }] },
  }
  if (data.顧客id) properties['顧客'] = { relation: [{ id: data.顧客id }] }
  if (data.期限) properties['期限'] = { date: { start: data.期限 } }
  if (data.完了日) properties['完了日'] = { date: { start: data.完了日 } }
  const res = await withRetry(() =>
    notion.pages.create({ parent: { database_id: dbProgress() }, properties })
  )
  return res.id
}

export async function updateProgress(id: string, data: Partial<Omit<NotionProgress, 'id' | '顧客名'>>): Promise<void> {
  const notion = getNotionClient()
  const properties: UpdatePageParameters['properties'] = {}
  if (data.業務名 !== undefined) properties['業務名'] = { title: [{ text: { content: data.業務名 } }] }
  if (data.顧客id !== undefined) properties['顧客'] = { relation: data.顧客id ? [{ id: data.顧客id }] : [] }
  if (data.業務種別 !== undefined) properties['業務種別'] = { select: data.業務種別 ? { name: data.業務種別 } : null }
  if (data.ステータス !== undefined) properties['ステータス'] = { select: data.ステータス ? { name: data.ステータス } : null }
  if (data.期限 !== undefined) properties['期限'] = data.期限 ? { date: { start: data.期限 } } : { date: null }
  if (data.完了日 !== undefined) properties['完了日'] = data.完了日 ? { date: { start: data.完了日 } } : { date: null }
  if (data.備考 !== undefined) properties['備考'] = { rich_text: [{ text: { content: data.備考 } }] }
  await withRetry(() => notion.pages.update({ page_id: id, properties }))
}

export async function deleteProgress(id: string): Promise<void> {
  const notion = getNotionClient()
  await withRetry(() => notion.pages.update({ page_id: id, archived: true }))
}

// ---------- 依頼資料リスト ----------

function dbDocuments(): string {
  const id = process.env.NOTION_DB_DOCUMENTS
  if (!id) throw new Error('NOTION_DB_DOCUMENTS が設定されていません')
  return id
}

export async function getDocumentRequests(): Promise<NotionDocument[]> {
  const notion = getNotionClient()
  const res = await withRetry(() =>
    notion.databases.query({
      database_id: dbDocuments(),
      sorts: [{ property: '依頼日', direction: 'descending' }],
    })
  )
  return res.results.map((page) => {
    const p = (page as PageObjectResponse).properties
    return {
      id: page.id,
      資料名: getText(p, '資料名'),
      顧客id: getRelationId(p, '顧客'),
      顧客名: '',
      資料種別: getSelect(p, '資料種別'),
      ステータス: getSelect(p, 'ステータス'),
      依頼日: getDate(p, '依頼日'),
      受取日: getDate(p, '受取日'),
      備考: getText(p, '備考'),
    }
  })
}

export async function createDocumentRequest(data: Omit<NotionDocument, 'id' | '顧客名'>): Promise<string> {
  const notion = getNotionClient()
  const properties: CreatePageParameters['properties'] = {
    資料名: { title: [{ text: { content: data.資料名 } }] },
    資料種別: { select: data.資料種別 ? { name: data.資料種別 } : null },
    ステータス: { select: data.ステータス ? { name: data.ステータス } : null },
    備考: { rich_text: [{ text: { content: data.備考 } }] },
  }
  if (data.顧客id) properties['顧客'] = { relation: [{ id: data.顧客id }] }
  if (data.依頼日) properties['依頼日'] = { date: { start: data.依頼日 } }
  if (data.受取日) properties['受取日'] = { date: { start: data.受取日 } }
  const res = await withRetry(() =>
    notion.pages.create({ parent: { database_id: dbDocuments() }, properties })
  )
  return res.id
}

export async function updateDocumentRequest(id: string, data: Partial<Omit<NotionDocument, 'id' | '顧客名'>>): Promise<void> {
  const notion = getNotionClient()
  const properties: UpdatePageParameters['properties'] = {}
  if (data.資料名 !== undefined) properties['資料名'] = { title: [{ text: { content: data.資料名 } }] }
  if (data.顧客id !== undefined) properties['顧客'] = { relation: data.顧客id ? [{ id: data.顧客id }] : [] }
  if (data.資料種別 !== undefined) properties['資料種別'] = { select: data.資料種別 ? { name: data.資料種別 } : null }
  if (data.ステータス !== undefined) properties['ステータス'] = { select: data.ステータス ? { name: data.ステータス } : null }
  if (data.依頼日 !== undefined) properties['依頼日'] = data.依頼日 ? { date: { start: data.依頼日 } } : { date: null }
  if (data.受取日 !== undefined) properties['受取日'] = data.受取日 ? { date: { start: data.受取日 } } : { date: null }
  if (data.備考 !== undefined) properties['備考'] = { rich_text: [{ text: { content: data.備考 } }] }
  await withRetry(() => notion.pages.update({ page_id: id, properties }))
}

export async function deleteDocumentRequest(id: string): Promise<void> {
  const notion = getNotionClient()
  await withRetry(() => notion.pages.update({ page_id: id, archived: true }))
}

// ---------- タスク管理 ----------

function dbTasks(): string {
  const id = process.env.NOTION_DB_TASKS
  if (!id) throw new Error('NOTION_DB_TASKS が設定されていません')
  return id
}

export async function getTasks(): Promise<NotionTask[]> {
  const notion = getNotionClient()
  const res = await withRetry(() =>
    notion.databases.query({
      database_id: dbTasks(),
      sorts: [{ property: '期限', direction: 'ascending' }],
    })
  )
  return res.results.map((page) => {
    const p = (page as PageObjectResponse).properties
    return {
      id: page.id,
      タスク名: getText(p, 'タスク名'),
      顧客id: getRelationId(p, '顧客'),
      顧客名: '',
      優先度: getSelect(p, '優先度'),
      ステータス: getSelect(p, 'ステータス'),
      期限: getDate(p, '期限'),
      備考: getText(p, '備考'),
    }
  })
}

export async function createTask(data: Omit<NotionTask, 'id' | '顧客名'>): Promise<string> {
  const notion = getNotionClient()
  const properties: CreatePageParameters['properties'] = {
    タスク名: { title: [{ text: { content: data.タスク名 } }] },
    優先度: { select: data.優先度 ? { name: data.優先度 } : null },
    ステータス: { select: data.ステータス ? { name: data.ステータス } : null },
    備考: { rich_text: [{ text: { content: data.備考 } }] },
  }
  if (data.顧客id) properties['顧客'] = { relation: [{ id: data.顧客id }] }
  if (data.期限) properties['期限'] = { date: { start: data.期限 } }
  const res = await withRetry(() =>
    notion.pages.create({ parent: { database_id: dbTasks() }, properties })
  )
  return res.id
}

export async function updateTask(id: string, data: Partial<Omit<NotionTask, 'id' | '顧客名'>>): Promise<void> {
  const notion = getNotionClient()
  const properties: UpdatePageParameters['properties'] = {}
  if (data.タスク名 !== undefined) properties['タスク名'] = { title: [{ text: { content: data.タスク名 } }] }
  if (data.顧客id !== undefined) properties['顧客'] = { relation: data.顧客id ? [{ id: data.顧客id }] : [] }
  if (data.優先度 !== undefined) properties['優先度'] = { select: data.優先度 ? { name: data.優先度 } : null }
  if (data.ステータス !== undefined) properties['ステータス'] = { select: data.ステータス ? { name: data.ステータス } : null }
  if (data.期限 !== undefined) properties['期限'] = data.期限 ? { date: { start: data.期限 } } : { date: null }
  if (data.備考 !== undefined) properties['備考'] = { rich_text: [{ text: { content: data.備考 } }] }
  await withRetry(() => notion.pages.update({ page_id: id, properties }))
}

export async function deleteTask(id: string): Promise<void> {
  const notion = getNotionClient()
  await withRetry(() => notion.pages.update({ page_id: id, archived: true }))
}
