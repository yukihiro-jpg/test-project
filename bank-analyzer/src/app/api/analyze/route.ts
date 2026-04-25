import { NextRequest, NextResponse } from 'next/server'
import { analyzePassbook } from '@/lib/gemini'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      passbookId,
      fileName,
      label,
      bankName,
      branchName,
      accountNumber,
      startDate,
      endDate,
      pdfBase64
    } = body

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
    const message = err instanceof Error ? err.message : '不明なエラー'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
