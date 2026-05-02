import type { IDBPDatabase } from 'idb'

const DB_NAME = 'invoice-registry'
const DB_VERSION = 1
const STORE_NAME = 'invoices'

interface InvoiceRecord {
  invoiceNumber: string
  businessName: string
}

async function openDB(): Promise<IDBPDatabase> {
  const { openDB: idbOpen } = await import('idb')
  return idbOpen(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'invoiceNumber' })
      }
    },
  })
}

export async function lookupInvoice(invoiceNumber: string): Promise<string | null> {
  try {
    const db = await openDB()
    const record = await db.get(STORE_NAME, invoiceNumber) as InvoiceRecord | undefined
    return record?.businessName || null
  } catch {
    return null
  }
}

export async function getInvoiceCount(): Promise<number> {
  try {
    const db = await openDB()
    return await db.count(STORE_NAME)
  } catch {
    return 0
  }
}

export async function importInvoiceCsv(
  file: File,
  onProgress?: (imported: number, total: number) => void,
): Promise<number> {
  // Shift-JIS / UTF-8 自動判定
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let text: string
  try {
    const utf8 = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    text = utf8.charCodeAt(0) === 0xFEFF ? utf8.slice(1) : utf8
  } catch {
    text = new TextDecoder('shift_jis').decode(bytes)
  }
  const lines = text.split('\n').filter((l) => l.trim())

  // ヘッダ行をスキップ（T+13桁で始まらない行）
  const dataLines = lines.filter((l) => /^"?T\d{13}/.test(l.trim()))
  const total = dataLines.length

  const db = await openDB()
  const BATCH_SIZE = 5000
  let imported = 0

  for (let i = 0; i < dataLines.length; i += BATCH_SIZE) {
    const batch = dataLines.slice(i, i + BATCH_SIZE)
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)

    for (const line of batch) {
      const cols = parseCsvLine(line)
      const invoiceNumber = (cols[0] || '').replace(/"/g, '').trim()
      // 事業者名は複数列にわたる場合がある。主要な名前列を取得
      const businessName = (cols[1] || cols[2] || '').replace(/"/g, '').trim()
      if (invoiceNumber && businessName) {
        await store.put({ invoiceNumber, businessName })
      }
    }
    await tx.done
    imported += batch.length
    onProgress?.(imported, total)
  }

  return imported
}

function parseCsvLine(line: string): string[] {
  const cols: string[] = []
  let field = ''
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQuote) {
      if (c === '"') {
        if (line[i + 1] === '"') { field += '"'; i++ }
        else inQuote = false
      } else {
        field += c
      }
    } else {
      if (c === '"') inQuote = true
      else if (c === ',') { cols.push(field); field = '' }
      else field += c
    }
  }
  cols.push(field)
  return cols
}

export async function clearInvoiceRegistry(): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  await tx.objectStore(STORE_NAME).clear()
  await tx.done
}
