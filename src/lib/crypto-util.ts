/**
 * マイナンバー等の機密情報を暗号化・復号する
 *
 * AES-256-GCM を使用。
 * 暗号化キーは環境変数 ENCRYPTION_KEY (32バイトのhex文字列=64文字)で設定。
 *
 * 保存形式: "enc:" + base64(iv[12] + tag[16] + ciphertext)
 *
 * プレフィックス "enc:" がない値は未暗号化の平文として扱う（後方互換）。
 */

import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const TAG_LENGTH = 16
const PREFIX = 'enc:'

function getKey(): Buffer | null {
  const hex = process.env.ENCRYPTION_KEY
  if (!hex) return null
  try {
    const key = Buffer.from(hex, 'hex')
    if (key.length !== 32) return null
    return key
  } catch {
    return null
  }
}

/**
 * 平文を暗号化する。キー未設定時は平文のまま返す。
 */
export function encryptSensitive(plaintext: string): string {
  if (!plaintext) return plaintext
  if (plaintext.startsWith(PREFIX)) return plaintext // 既に暗号化済み

  const key = getKey()
  if (!key) return plaintext

  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  const combined = Buffer.concat([iv, tag, encrypted])
  return PREFIX + combined.toString('base64')
}

/**
 * 暗号文を復号する。プレフィックスなしはそのまま返す（後方互換）。
 */
export function decryptSensitive(ciphertext: string): string {
  if (!ciphertext) return ciphertext
  if (!ciphertext.startsWith(PREFIX)) return ciphertext // 平文

  const key = getKey()
  if (!key) return ciphertext // キーなしでは復号不可

  try {
    const combined = Buffer.from(ciphertext.slice(PREFIX.length), 'base64')
    const iv = combined.subarray(0, IV_LENGTH)
    const tag = combined.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
    const encrypted = combined.subarray(IV_LENGTH + TAG_LENGTH)

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
    return decrypted.toString('utf8')
  } catch {
    return '[復号エラー]'
  }
}

/**
 * マイナンバーをマスキング表示（末尾4桁のみ見える）
 * 例: "123456789012" → "********9012"
 */
export function maskMyNumber(plainOrEncrypted: string): string {
  const plain = decryptSensitive(plainOrEncrypted)
  if (!plain || plain.length < 4) return ''
  if (plain.startsWith('[')) return plain // エラー表示
  return '*'.repeat(Math.max(0, plain.length - 4)) + plain.slice(-4)
}
