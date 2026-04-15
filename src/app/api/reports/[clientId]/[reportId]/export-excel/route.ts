import { NextRequest, NextResponse } from 'next/server'
import { getClient } from '@/lib/firestore/clients-repo'
import { listSections } from '@/lib/firestore/reports-repo'
import { renderReportExcel } from '@/lib/excel/renderer'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(
  _req: NextRequest,
  { params }: { params: { clientId: string; reportId: string } },
) {
  const client = await getClient(params.clientId)
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const [yearStr, monthStr] = params.reportId.split('_')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)

  const sections = await listSections(params.clientId, params.reportId)
  const buffer = await renderReportExcel({
    clientName: client.name,
    year,
    month,
    sections,
  })

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(client.name)}_${year}_${String(month).padStart(2, '0')}.xlsx"`,
    },
  })
}
