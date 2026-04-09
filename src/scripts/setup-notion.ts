/**
 * Notion データベース初期化スクリプト
 *
 * 使い方:
 *   1. .env.local に NOTION_API_KEY と NOTION_PARENT_PAGE_ID を設定する
 *   2. npm run notion:setup を実行する
 *   3. 出力された DB ID を .env.local に追加する
 *
 * 必要な環境変数:
 *   NOTION_API_KEY         - Notion Integration のシークレットキー (secret_xxx)
 *   NOTION_PARENT_PAGE_ID  - データベースを作成する親ページの ID
 */

import { config } from 'dotenv'
import { Client } from '@notionhq/client'

// .env.local → .env の順に読み込む
config({ path: '.env.local' })
config({ path: '.env' })

const apiKey = process.env.NOTION_API_KEY
const parentPageId = process.env.NOTION_PARENT_PAGE_ID

if (!apiKey) {
  console.error('エラー: NOTION_API_KEY が設定されていません')
  console.error('  .env.local に NOTION_API_KEY=secret_xxx を追加してください')
  process.exit(1)
}

if (!parentPageId) {
  console.error('エラー: NOTION_PARENT_PAGE_ID が設定されていません')
  console.error('  Notion で親ページを作成し、そのページ ID を .env.local に追加してください')
  console.error('  ページ ID は URL の末尾 32 文字です (例: https://notion.so/xxx/.../[ここ])')
  process.exit(1)
}

const notion = new Client({ auth: apiKey })

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

// ---------- 顧客管理 DB ----------
async function createClientsDB(): Promise<string> {
  console.log('顧客管理 DB を作成中...')
  const res = await notion.databases.create({
    parent: { type: 'page_id', page_id: parentPageId! },
    title: [{ type: 'text', text: { content: '顧客管理' } }],
    properties: {
      顧客名: { title: {} },
      顧客コード: { rich_text: {} },
      担当者: { rich_text: {} },
      電話番号: { phone_number: {} },
      メールアドレス: { email: {} },
      ステータス: {
        select: {
          options: [
            { name: '顧問中', color: 'green' },
            { name: '見込み', color: 'yellow' },
            { name: '離脱', color: 'red' },
          ],
        },
      },
      備考: { rich_text: {} },
    },
  })
  console.log(`  ✓ 顧客管理 DB 作成完了: ${res.id}`)
  return res.id
}

// ---------- 進捗管理 DB ----------
async function createProgressDB(clientsDbId: string): Promise<string> {
  console.log('進捗管理 DB を作成中...')
  const res = await notion.databases.create({
    parent: { type: 'page_id', page_id: parentPageId! },
    title: [{ type: 'text', text: { content: '進捗管理' } }],
    properties: {
      業務名: { title: {} },
      顧客: { relation: { database_id: clientsDbId, single_property: {} } },
      業務種別: {
        select: {
          options: [
            { name: '年末調整', color: 'blue' },
            { name: '確定申告', color: 'purple' },
            { name: '記帳代行', color: 'orange' },
            { name: '決算', color: 'pink' },
            { name: 'その他', color: 'gray' },
          ],
        },
      },
      ステータス: {
        select: {
          options: [
            { name: '未着手', color: 'gray' },
            { name: '進行中', color: 'yellow' },
            { name: '完了', color: 'green' },
            { name: '保留', color: 'red' },
          ],
        },
      },
      期限: { date: {} },
      完了日: { date: {} },
      備考: { rich_text: {} },
    },
  })
  console.log(`  ✓ 進捗管理 DB 作成完了: ${res.id}`)
  return res.id
}

// ---------- 依頼資料リスト DB ----------
async function createDocumentsDB(clientsDbId: string): Promise<string> {
  console.log('依頼資料リスト DB を作成中...')
  const res = await notion.databases.create({
    parent: { type: 'page_id', page_id: parentPageId! },
    title: [{ type: 'text', text: { content: '依頼資料リスト' } }],
    properties: {
      資料名: { title: {} },
      顧客: { relation: { database_id: clientsDbId, single_property: {} } },
      資料種別: {
        select: {
          options: [
            { name: '証明書類', color: 'blue' },
            { name: '帳票', color: 'green' },
            { name: '契約書', color: 'orange' },
            { name: 'その他', color: 'gray' },
          ],
        },
      },
      ステータス: {
        select: {
          options: [
            { name: '依頼中', color: 'yellow' },
            { name: '受取済み', color: 'green' },
            { name: '不要', color: 'gray' },
          ],
        },
      },
      依頼日: { date: {} },
      受取日: { date: {} },
      備考: { rich_text: {} },
    },
  })
  console.log(`  ✓ 依頼資料リスト DB 作成完了: ${res.id}`)
  return res.id
}

// ---------- タスク管理 DB ----------
async function createTasksDB(clientsDbId: string): Promise<string> {
  console.log('タスク管理 DB を作成中...')
  const res = await notion.databases.create({
    parent: { type: 'page_id', page_id: parentPageId! },
    title: [{ type: 'text', text: { content: 'タスク管理' } }],
    properties: {
      タスク名: { title: {} },
      顧客: { relation: { database_id: clientsDbId, single_property: {} } },
      優先度: {
        select: {
          options: [
            { name: '高', color: 'red' },
            { name: '中', color: 'yellow' },
            { name: '低', color: 'gray' },
          ],
        },
      },
      ステータス: {
        select: {
          options: [
            { name: '未着手', color: 'gray' },
            { name: '進行中', color: 'yellow' },
            { name: '完了', color: 'green' },
          ],
        },
      },
      期限: { date: {} },
      備考: { rich_text: {} },
    },
  })
  console.log(`  ✓ タスク管理 DB 作成完了: ${res.id}`)
  return res.id
}

// ---------- メイン ----------
async function main() {
  console.log('=== Notion データベース セットアップ開始 ===\n')

  try {
    // まず顧客管理DBを作成（他のDBがRelationで参照する）
    const clientsDbId = await createClientsDB()
    await sleep(400)

    const progressDbId = await createProgressDB(clientsDbId)
    await sleep(400)

    const documentsDbId = await createDocumentsDB(clientsDbId)
    await sleep(400)

    const tasksDbId = await createTasksDB(clientsDbId)

    console.log('\n=== セットアップ完了 ===')
    console.log('\n以下を .env.local に追加してください:\n')
    console.log(`NOTION_DB_CLIENTS=${clientsDbId}`)
    console.log(`NOTION_DB_PROGRESS=${progressDbId}`)
    console.log(`NOTION_DB_DOCUMENTS=${documentsDbId}`)
    console.log(`NOTION_DB_TASKS=${tasksDbId}`)
    console.log('\nNotionのワークスペースを確認し、4つのデータベースが作成されたことを確認してください。')
  } catch (err: unknown) {
    const message = (err as { message?: string })?.message ?? String(err)
    const code = (err as { code?: string })?.code
    console.error('\nエラーが発生しました:', message)
    if (code === 'unauthorized') {
      console.error('  → NOTION_API_KEY が正しいか確認してください')
    } else if (code === 'object_not_found') {
      console.error('  → NOTION_PARENT_PAGE_ID が正しいか確認してください')
      console.error('  → 親ページにIntegrationのアクセス権が付与されているか確認してください')
      console.error('    (ページの「...」→「Connections」→ Integrationを追加)')
    }
    process.exit(1)
  }
}

main()
