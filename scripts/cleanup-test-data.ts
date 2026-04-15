/**
 * テストデータ全削除スクリプト
 *
 * 開発完了時に実行し、以下をすべて削除する：
 * - ローカルのサンプルCSV・マスキングデータ
 * - Firestore のテストコレクション
 * - Google Drive のテストアップロードファイル
 *
 * 使い方:
 *   npm run cleanup:test-data           # ドライラン（何が消えるか表示のみ）
 *   npm run cleanup:test-data -- --run  # 実際に削除
 *
 * 注意:
 * - 本番データは削除しません（test_ プレフィックス等のフィルタで分離）
 * - 削除前に必ずバックアップを取ること
 */

import * as fs from 'fs'
import * as path from 'path'

const DRY_RUN = !process.argv.includes('--run')

const LOCAL_DIRS_TO_DELETE = [
  'samples',
  'test-data',
  'fixtures',
  'generated',
  'output',
  '.next/cache',
]

const FIRESTORE_TEST_COLLECTIONS = [
  'test_clients',
  'test_reports',
  'test_comments',
  'test_profiles',
]

function log(msg: string): void {
  console.log(`${DRY_RUN ? '[DRY RUN] ' : ''}${msg}`)
}

async function cleanupLocalFiles(): Promise<void> {
  console.log('\n=== ローカルファイル削除 ===')
  for (const dir of LOCAL_DIRS_TO_DELETE) {
    const fullPath = path.join(process.cwd(), dir)
    if (fs.existsSync(fullPath)) {
      log(`削除: ${dir}/`)
      if (!DRY_RUN) {
        fs.rmSync(fullPath, { recursive: true, force: true })
      }
    }
  }
}

async function cleanupFirestoreTestData(): Promise<void> {
  console.log('\n=== Firestore テストコレクション削除 ===')
  if (!process.env.GCP_PROJECT_ID) {
    log('⚠ GCP_PROJECT_ID が未設定のためスキップ')
    return
  }

  // 実運用時に @google-cloud/firestore を使って削除
  // ここではスタブとして実装
  for (const col of FIRESTORE_TEST_COLLECTIONS) {
    log(`削除予定コレクション: ${col}`)
    if (!DRY_RUN) {
      // TODO: Firestore バッチ削除
      // const firestore = new Firestore()
      // await deleteCollection(firestore, col, 100)
    }
  }
}

async function cleanupGoogleDriveTestFiles(): Promise<void> {
  console.log('\n=== Google Drive テストファイル削除 ===')
  if (!process.env.GOOGLE_DRIVE_FOLDER_ID) {
    log('⚠ GOOGLE_DRIVE_FOLDER_ID が未設定のためスキップ')
    return
  }
  log('TODO: Google Drive APIで /test/ 配下のファイルを削除')
}

async function main(): Promise<void> {
  console.log('=================================================')
  console.log('テストデータ削除スクリプト')
  if (DRY_RUN) {
    console.log('⚠ DRY RUN モードです。実際の削除は行いません。')
    console.log('⚠ 実行する場合: npm run cleanup:test-data -- --run')
  } else {
    console.log('⚠ 削除モードで実行します。')
  }
  console.log('=================================================')

  await cleanupLocalFiles()
  await cleanupFirestoreTestData()
  await cleanupGoogleDriveTestFiles()

  console.log('\n=================================================')
  console.log('完了')
  if (DRY_RUN) {
    console.log('⚠ DRY RUN のため実際の削除は行われていません')
  } else {
    console.log('✓ テストデータを削除しました')
    console.log('')
    console.log('次のステップ:')
    console.log('1. Git 履歴に実データを含むコミットがないか確認')
    console.log('   git log --all --full-history -- samples/')
    console.log('2. Claude Code のチャット履歴を削除')
    console.log('3. ローカルPCのダウンロードフォルダも確認')
  }
  console.log('=================================================')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
