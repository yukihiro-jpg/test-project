import { copyFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs'
import { dirname, join } from 'path'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
const root = dirname(here)

function copyFile(src, dest) {
  if (!existsSync(dirname(dest))) mkdirSync(dirname(dest), { recursive: true })
  copyFileSync(src, dest)
}

function copyDir(srcDir, destDir) {
  if (!existsSync(srcDir)) return 0
  if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true })
  let count = 0
  for (const name of readdirSync(srcDir)) {
    const s = join(srcDir, name)
    const d = join(destDir, name)
    const st = statSync(s)
    if (st.isDirectory()) {
      count += copyDir(s, d)
    } else {
      copyFileSync(s, d)
      count++
    }
  }
  return count
}

try {
  // 1) Worker 本体
  const workerSrc = require.resolve('pdfjs-dist/build/pdf.worker.min.mjs')
  const workerDest = join(root, 'public', 'pdf.worker.min.mjs')
  copyFile(workerSrc, workerDest)
  console.log(`[copy-pdf-worker] ${workerSrc} -> ${workerDest}`)

  // 2) CMap（CJK フォント）— テキストベース日本語PDFの描画に必須
  const pkgRoot = dirname(dirname(workerSrc)) // pdfjs-dist root
  const cmapsSrc = join(pkgRoot, 'cmaps')
  const cmapsDest = join(root, 'public', 'cmaps')
  const cmapsCount = copyDir(cmapsSrc, cmapsDest)
  if (cmapsCount > 0) console.log(`[copy-pdf-worker] cmaps: ${cmapsCount} files copied to ${cmapsDest}`)

  // 3) Standard Fonts — フォント未埋め込みPDFのフォールバック用
  const fontsSrc = join(pkgRoot, 'standard_fonts')
  const fontsDest = join(root, 'public', 'standard_fonts')
  const fontsCount = copyDir(fontsSrc, fontsDest)
  if (fontsCount > 0)
    console.log(`[copy-pdf-worker] standard_fonts: ${fontsCount} files copied to ${fontsDest}`)
} catch (e) {
  console.warn('[copy-pdf-worker] skip:', e.message)
}
