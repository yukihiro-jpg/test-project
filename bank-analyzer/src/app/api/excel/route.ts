import { NextRequest, NextResponse } from 'next/server'
import { buildExcelWorkbook } from '@/lib/excel'
import type { AssetMovementTable, ParsedPassbook } from '@/types'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      passbooks: ParsedPassbook[]
      assetTable: AssetMovementTable
      summaryText?: string
    }
    if (!body.passbooks || !body.assetTable) {
      return NextResponse.json({ error: 'passbooks と assetTable が必要です' }, { status: 400 })
    }
    const buf = await buildExcelWorkbook(body.passbooks, body.assetTable, body.summaryText)
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="bank-analysis-${new Date().toISOString().slice(0, 10)}.xlsx"`
      }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '不明なエラー'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
