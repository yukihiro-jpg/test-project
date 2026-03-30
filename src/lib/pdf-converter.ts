import { PDFDocument } from 'pdf-lib'
import sharp from 'sharp'

const MAX_WIDTH = 1600
const MAX_HEIGHT = 2200
const JPEG_QUALITY = 85

/**
 * 画像バッファをPDFに変換する
 * 画像はA4比率にリサイズされ、1ページのPDFとして出力される
 */
export async function imageToPdf(imageBuffer: Buffer): Promise<Buffer> {
  // 画像をリサイズ・JPEG変換
  const resized = await sharp(imageBuffer)
    .resize(MAX_WIDTH, MAX_HEIGHT, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer()

  const metadata = await sharp(resized).metadata()
  const imgWidth = metadata.width!
  const imgHeight = metadata.height!

  // PDF作成（画像サイズに合わせたページ）
  const pdfDoc = await PDFDocument.create()
  const jpgImage = await pdfDoc.embedJpg(resized)

  // A4比率を基準にページサイズを決定（ポイント単位: 1pt = 1/72 inch）
  const A4_WIDTH = 595.28
  const A4_HEIGHT = 841.89

  let pageWidth: number
  let pageHeight: number

  const imgAspect = imgWidth / imgHeight
  const a4Aspect = A4_WIDTH / A4_HEIGHT

  if (imgAspect > a4Aspect) {
    // 横長の画像
    pageWidth = A4_WIDTH
    pageHeight = A4_WIDTH / imgAspect
  } else {
    // 縦長の画像
    pageHeight = A4_HEIGHT
    pageWidth = A4_HEIGHT * imgAspect
  }

  const page = pdfDoc.addPage([pageWidth, pageHeight])
  page.drawImage(jpgImage, {
    x: 0,
    y: 0,
    width: pageWidth,
    height: pageHeight,
  })

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}

/**
 * 複数画像を1つのPDFにまとめる
 */
export async function imagesToPdf(imageBuffers: Buffer[]): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create()

  for (const imageBuffer of imageBuffers) {
    const resized = await sharp(imageBuffer)
      .resize(MAX_WIDTH, MAX_HEIGHT, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer()

    const metadata = await sharp(resized).metadata()
    const imgWidth = metadata.width!
    const imgHeight = metadata.height!

    const jpgImage = await pdfDoc.embedJpg(resized)

    const A4_WIDTH = 595.28
    const A4_HEIGHT = 841.89
    const imgAspect = imgWidth / imgHeight
    const a4Aspect = A4_WIDTH / A4_HEIGHT

    let pageWidth: number
    let pageHeight: number

    if (imgAspect > a4Aspect) {
      pageWidth = A4_WIDTH
      pageHeight = A4_WIDTH / imgAspect
    } else {
      pageHeight = A4_HEIGHT
      pageWidth = A4_HEIGHT * imgAspect
    }

    const page = pdfDoc.addPage([pageWidth, pageHeight])
    page.drawImage(jpgImage, {
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
    })
  }

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}
