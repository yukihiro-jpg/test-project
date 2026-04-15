/**
 * Firestore クライアント（シングルトン）
 *
 * サーバーサイド（API Routes）からのみ利用する。
 * 認証はサービスアカウント（Cloud Run の場合はデフォルト認証）を使用。
 */

import { Firestore } from '@google-cloud/firestore'

let firestoreInstance: Firestore | null = null

export function getFirestore(): Firestore {
  if (firestoreInstance) return firestoreInstance

  const projectId = process.env.GCP_PROJECT_ID
  if (!projectId) {
    throw new Error('GCP_PROJECT_ID が設定されていません')
  }

  // ローカル開発環境では base64 エンコードされたサービスアカウント JSON を使用
  const saBase64 = process.env.GCP_SERVICE_ACCOUNT_BASE64
  if (saBase64) {
    const credentials = JSON.parse(Buffer.from(saBase64, 'base64').toString('utf-8'))
    firestoreInstance = new Firestore({
      projectId,
      credentials,
      databaseId: process.env.FIRESTORE_DATABASE_ID || '(default)',
    })
  } else {
    // Cloud Run 等の GCP 環境ではメタデータサーバー経由の認証
    firestoreInstance = new Firestore({
      projectId,
      databaseId: process.env.FIRESTORE_DATABASE_ID || '(default)',
    })
  }

  return firestoreInstance
}

/**
 * コレクションを再帰的に削除する（テストデータ削除時に使用）
 */
export async function deleteCollection(
  collectionPath: string,
  batchSize = 100,
): Promise<void> {
  const firestore = getFirestore()
  const collectionRef = firestore.collection(collectionPath)
  const query = collectionRef.orderBy('__name__').limit(batchSize)

  return new Promise<void>((resolve, reject) => {
    deleteQueryBatch(query, resolve).catch(reject)
  })
}

async function deleteQueryBatch(
  query: FirebaseFirestore.Query,
  resolve: () => void,
): Promise<void> {
  const firestore = getFirestore()
  const snapshot = await query.get()
  if (snapshot.size === 0) {
    resolve()
    return
  }

  const batch = firestore.batch()
  snapshot.docs.forEach((doc) => batch.delete(doc.ref))
  await batch.commit()

  process.nextTick(() => deleteQueryBatch(query, resolve))
}
