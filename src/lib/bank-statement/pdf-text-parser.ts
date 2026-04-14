import type { RawTableRow } from './types'

// pdfjs-distは動的インポートで読み込む（webpack互換性のため）
async function getPdfjsLib() {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf')
  if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`
  }
  return pdfjsLib
}

interface TextItem {
  str: string
  transform: number[] // [scaleX, skewX, skewY, scaleY, translateX, translateY]
  width: number
  height: number
}

interface PdfPageResult {
  rows: RawTableRow[]
  pageWidth: number
  pageHeight: number
  hasText: boolean
}

export async function parsePdfText(
  file: File,
): Promise<{ pages: PdfPageResult[]; isTextPdf: boolean }> {
  const pdfjsLib = await getPdfjsLib()
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise

  const pages: PdfPageResult[] = []
  let totalTextItems = 0

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const viewport = page.getViewport({ scale: 1 })
    const textContent = await page.getTextContent()

    const textItems: TextItem[] = (textContent.items as TextItem[]).filter(
      (item) => item.str.trim(),
    )
    totalTextItems += textItems.length

    // テキストアイテムをY座標でグループ化（同じ行のアイテムをまとめる）
    const rows = groupTextItemsIntoRows(textItems, viewport.height)

    pages.push({
      rows,
      pageWidth: viewport.width,
      pageHeight: viewport.height,
      hasText: textItems.length > 0,
    })
  }

  return {
    pages,
    isTextPdf: totalTextItems > 5, // テキストがほとんどない場合はスキャンPDF
  }
}

function groupTextItemsIntoRows(
  items: TextItem[],
  pageHeight: number,
): RawTableRow[] {
  if (items.length === 0) return []

  // Y座標でソート（PDF座標は左下原点なので、上から順に並べるため逆順）
  const sorted = [...items].sort((a, b) => {
    const yDiff = b.transform[5] - a.transform[5]
    if (Math.abs(yDiff) > 3) return yDiff
    return a.transform[4] - b.transform[4] // 同じ行ならX座標順
  })

  // 同じY座標（近い値）のアイテムをグループ化
  const rowGroups: { items: TextItem[]; y: number }[] = []
  const Y_THRESHOLD = 5

  for (const item of sorted) {
    const y = item.transform[5]
    const existingRow = rowGroups.find(
      (row) => Math.abs(row.y - y) < Y_THRESHOLD,
    )

    if (existingRow) {
      existingRow.items.push(item)
    } else {
      rowGroups.push({ items: [item], y })
    }
  }

  // 各行内をX座標でソートし、セルに分割
  return rowGroups.map((group, idx) => {
    const sortedItems = group.items.sort(
      (a, b) => a.transform[4] - b.transform[4],
    )

    // X座標のギャップでセルを分割
    const cells: string[] = []
    let currentCell = ''
    let lastX = -Infinity

    for (const item of sortedItems) {
      const x = item.transform[4]
      const gap = x - lastX

      if (gap > 20 && currentCell) {
        cells.push(currentCell.trim())
        currentCell = item.str
      } else {
        currentCell += item.str
      }
      lastX = x + (item.width || 0)
    }
    if (currentCell.trim()) {
      cells.push(currentCell.trim())
    }

    // boundingBox計算
    const allX = sortedItems.map((i) => i.transform[4])
    const minX = Math.min(...allX)
    const maxX = Math.max(...allX.map((x, idx) => x + (sortedItems[idx].width || 0)))
    const y = pageHeight - group.y
    const height = Math.max(...sortedItems.map((i) => Math.abs(i.transform[3]))) || 12

    return {
      cells,
      rowIndex: idx,
      boundingBox: {
        x: minX,
        y: y - height,
        width: maxX - minX,
        height: height + 4,
      },
    }
  })
}

export async function renderPdfPageToImage(
  file: File,
  pageNum: number,
  scale: number = 2,
): Promise<string> {
  const pdfjsLib = await getPdfjsLib()
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise
  const page = await pdf.getPage(pageNum)
  const viewport = page.getViewport({ scale })

  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height

  const ctx = canvas.getContext('2d')!
  await page.render({ canvasContext: ctx, viewport }).promise

  return canvas.toDataURL('image/jpeg', 0.8)
}

export async function getPdfPageCount(file: File): Promise<number> {
  const pdfjsLib = await getPdfjsLib()
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise
  return pdf.numPages
}
