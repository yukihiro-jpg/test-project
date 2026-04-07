import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { getClientDynamic } from '@/lib/clients'
import { getFiscalYear } from '@/lib/fiscal-year'

/**
 * 会社別のQRコードをA4 PDFで生成してダウンロードする。
 *
 * GET /api/qrcode-pdf?client=712&year=R8
 *
 * PDF内容:
 *   - 年度・会社名
 *   - 大きなQRコード画像（中央）
 *   - アップロードURL（下部）
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const clientCode = searchParams.get('client')
  const yearId = searchParams.get('year')

  if (!clientCode || !yearId) {
    return NextResponse.json(
      { error: 'client と year は必須です' },
      { status: 400 }
    )
  }

  const client = await getClientDynamic(yearId, clientCode)
  if (!client) {
    return NextResponse.json({ error: '会社が見つかりません' }, { status: 404 })
  }

  const fiscalYear = getFiscalYear(yearId)
  if (!fiscalYear) {
    return NextResponse.json({ error: '無効な年度です' }, { status: 400 })
  }

  // アップロードURLを構築
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || ''
  const uploadUrl = `${appUrl}/upload?client=${client.code}&year=${yearId}`

  // QRコードをPNGバッファとして生成
  const qrBuffer = await QRCode.toBuffer(uploadUrl, {
    type: 'png',
    width: 800,
    margin: 2,
    errorCorrectionLevel: 'M',
  })

  // PDFを作成
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595.28, 841.89]) // A4

  // フォントを埋め込む（日本語は非対応のため Helvetica を使用）
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  // QRコード画像を埋め込み
  const qrImage = await pdfDoc.embedPng(qrBuffer)
  const qrSize = 380
  const qrX = (page.getWidth() - qrSize) / 2
  const qrY = (page.getHeight() - qrSize) / 2 - 20

  page.drawImage(qrImage, {
    x: qrX,
    y: qrY,
    width: qrSize,
    height: qrSize,
  })

  // ヘッダー（英数字のみ：pdf-lib標準フォントは日本語非対応のため）
  const yearCode = `Reiwa ${fiscalYear.reiwaYear}`
  const titleText = 'Nenmatsu Chosei Upload QR Code'
  page.drawText(titleText, {
    x: 50,
    y: page.getHeight() - 70,
    size: 16,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.1),
  })

  const headerText = `${yearCode} / Company Code: ${client.code}`
  page.drawText(headerText, {
    x: 50,
    y: page.getHeight() - 95,
    size: 12,
    font,
    color: rgb(0.3, 0.3, 0.3),
  })

  // QRコード下のキャプション
  const captionY = qrY - 30
  page.drawText('Scan with your smartphone camera', {
    x: (page.getWidth() - 240) / 2,
    y: captionY,
    size: 12,
    font,
    color: rgb(0.4, 0.4, 0.4),
  })

  // URLを下部に表示（長い場合は折り返し）
  const urlY = 60
  const urlFontSize = 9
  page.drawText('URL:', {
    x: 50,
    y: urlY + 15,
    size: 10,
    font: boldFont,
    color: rgb(0.2, 0.2, 0.2),
  })
  page.drawText(uploadUrl, {
    x: 50,
    y: urlY,
    size: urlFontSize,
    font,
    color: rgb(0.2, 0.2, 0.7),
  })

  // PDF を Buffer として出力
  const pdfBytes = await pdfDoc.save()

  const fileName = `${client.code}_${client.name}_${fiscalYear.label}_QR.pdf`

  return new NextResponse(new Uint8Array(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  })
}
