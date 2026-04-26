import { NextRequest, NextResponse } from 'next/server'
import { analyzePassbook } from '@/lib/gemini'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  try {
    const ct = req.headers.get('content-type') || ''

    let passbookId: string
    let fileName: string
    let label: string
    let bankName: string
    let branchName: string
    let accountNumber: string
    let startDate: string
    let endDate: string
    let pdfBase64: string

    if (ct.includes('multipart/form-data')) {
      const form = await req.formData()
      const file = form.get('file')
      if (!(file instanceof Blob)) {
        return NextResponse.json({ error: 'file が含まれていません' }, { status: 400 })
      }
      const buf = Buffer.from(await file.arrayBuffer())
      pdfBase64 = buf.toString('base64')
      passbookId = String(form.get('passbookId') || '')
      fileName = String(form.get('fileName') || '')
      label = String(form.get('label') || '')
      bankName = String(form.get('bankName') || '')
      branchName = String(form.get('branchName') || '')
      accountNumber = String(form.get('accountNumber') || '')
      startDate = String(form.get('startDate') || '')
      endDate = String(form.get('endDate') || '')
    } else {
      const body = await req.json()
      passbookId = body.passbookId
      fileName = body.fileName
      label = body.label
      bankName = body.bankName
      branchName = body.branchName
      accountNumber = body.accountNumber
      startDate = body.startDate
      endDate = body.endDate
      pdfBase64 = body.pdfBase64
    }

    if (!pdfBase64 || !startDate || !endDate || !passbookId) {
      return NextResponse.json({ error: '必須パラメータが不足しています' }, { status: 400 })
    }

    const passbook = await analyzePassbook({
      passbookId,
      fileName: fileName || '',
      label: label || fileName || '',
      bankName,
      branchName,
      accountNumber,
      startDate,
      endDate,
      pdfBase64
    })

    return NextResponse.json({ passbook })
  } catch (err) {
    console.error('[api/analyze] error:', err)
    const message = err instanceof Error ? err.message : '不明なエラー'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
