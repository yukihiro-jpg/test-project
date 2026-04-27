import { NextRequest, NextResponse } from 'next/server'
import { analyzeBalanceCertificate } from '@/lib/balance-cert'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  try {
    const ct = req.headers.get('content-type') || ''
    let certId: string
    let fileName: string
    let pdfBase64: string

    if (ct.includes('multipart/form-data')) {
      const form = await req.formData()
      const file = form.get('file')
      if (!(file instanceof Blob)) {
        return NextResponse.json({ error: 'file が含まれていません' }, { status: 400 })
      }
      const buf = Buffer.from(await file.arrayBuffer())
      pdfBase64 = buf.toString('base64')
      certId = String(form.get('certId') || '')
      fileName = String(form.get('fileName') || '')
    } else {
      const body = await req.json()
      certId = body.certId
      fileName = body.fileName
      pdfBase64 = body.pdfBase64
    }

    if (!pdfBase64 || !certId) {
      return NextResponse.json({ error: '必須パラメータが不足しています' }, { status: 400 })
    }

    const cert = await analyzeBalanceCertificate({
      certId,
      fileName: fileName || '',
      pdfBase64
    })

    return NextResponse.json({ cert })
  } catch (err) {
    console.error('[api/analyze-balance] error:', err)
    const message = err instanceof Error ? err.message : '不明なエラー'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
