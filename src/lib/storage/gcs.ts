/**
 * Google Cloud Storage クライアント
 *
 * アップロードされた CSV の原本・生成された PDF/Excel を保存する。
 * 保持期間は Cloud Storage のライフサイクルルールで制御（3ヶ月等）。
 */

import { Storage } from '@google-cloud/storage'

let storageInstance: Storage | null = null

function getStorage(): Storage {
  if (storageInstance) return storageInstance
  const saBase64 = process.env.GCP_SERVICE_ACCOUNT_BASE64
  if (saBase64) {
    const credentials = JSON.parse(Buffer.from(saBase64, 'base64').toString('utf-8'))
    storageInstance = new Storage({ projectId: process.env.GCP_PROJECT_ID, credentials })
  } else {
    storageInstance = new Storage({ projectId: process.env.GCP_PROJECT_ID })
  }
  return storageInstance
}

export function getUploadBucketName(): string {
  const name = process.env.GCS_UPLOAD_BUCKET
  if (!name) throw new Error('GCS_UPLOAD_BUCKET が未設定')
  return name
}

export async function uploadFile(
  path: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  const bucket = getStorage().bucket(getUploadBucketName())
  const file = bucket.file(path)
  await file.save(buffer, { contentType, resumable: false })
  return `gs://${bucket.name}/${path}`
}

export async function downloadFile(path: string): Promise<Buffer> {
  const bucket = getStorage().bucket(getUploadBucketName())
  const [data] = await bucket.file(path).download()
  return data
}
