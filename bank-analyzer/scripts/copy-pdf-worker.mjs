import { copyFileSync, mkdirSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
const root = dirname(here)

try {
  const src = require.resolve('pdfjs-dist/build/pdf.worker.min.mjs')
  const dest = join(root, 'public', 'pdf.worker.min.mjs')
  if (!existsSync(dirname(dest))) mkdirSync(dirname(dest), { recursive: true })
  copyFileSync(src, dest)
  console.log(`[copy-pdf-worker] ${src} -> ${dest}`)
} catch (e) {
  console.warn('[copy-pdf-worker] skip:', e.message)
}
