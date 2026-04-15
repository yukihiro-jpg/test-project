/**
 * Puppeteer による HTML → PDF 変換
 *
 * Cloud Run 環境では /usr/bin/chromium を使用。
 * ローカル開発では puppeteer バンドルの Chromium を使用。
 */

import puppeteer, { type Browser } from 'puppeteer'

let browserPromise: Promise<Browser> | null = null

function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      headless: true,
    })
  }
  return browserPromise
}

export async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await getBrowser()
  const page = await browser.newPage()
  try {
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' },
      displayHeaderFooter: true,
      footerTemplate: `
        <div style="width: 100%; font-size: 8pt; text-align: right; padding-right: 15mm; color: #6b7280;">
          <span class="pageNumber"></span> / <span class="totalPages"></span>
        </div>`,
      headerTemplate: '<div></div>',
    })
    return Buffer.from(pdf)
  } finally {
    await page.close()
  }
}
