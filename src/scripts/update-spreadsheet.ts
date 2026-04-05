/**
 * 進捗管理スプレッドシート更新スクリプト（日次バッチ）
 *
 * 全社分の進捗を一括でスプレッドシートに反映する。
 * リアルタイム更新は upload API 側で行われるため、
 * このスクリプトは日次の整合性チェック・補完として動作する。
 *
 * 実行: npm run cron:spreadsheet -- --year=R8
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { getFiscalYear, getCurrentFiscalYearId } from '../lib/fiscal-year'
import {
  getOrCreateYearFolder,
  loadClients,
} from '../lib/client-registry'
import { updateCompanyProgress } from '../lib/progress-tracker'

function parseYearArg(): string {
  const yearArg = process.argv.find((a) => a.startsWith('--year='))
  return yearArg ? yearArg.split('=')[1] : getCurrentFiscalYearId()
}

async function main() {
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID
  if (!spreadsheetId) {
    console.error('GOOGLE_SPREADSHEET_ID が設定されていません')
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

  if (clients.length === 0) {
    console.log('登録済みの顧問先がありません')
    return
  }

  console.log(`${clients.length}件の顧問先を処理します...`)

  for (const client of clients) {
    console.log(`\n処理中: ${client.name}`)
    try {
      const result = await updateCompanyProgress(spreadsheetId, fiscalYear.label, client)
      console.log(`  完了: ${result.submitted}/${result.total}名提出済み`)
    } catch (error) {
      console.error(`  エラー: ${error}`)
    }
  }

  console.log('\n=== 処理完了 ===')
}

main().catch((err) => {
  console.error('スクリプトエラー:', err)
  process.exit(1)
})
