import { NextRequest, NextResponse } from 'next/server'
import { getClient } from '@/lib/firestore/clients-repo'
import { getProfile } from '@/lib/firestore/clients-repo'
import { listComments, listSections } from '@/lib/firestore/reports-repo'
import { renderReportHtml } from '@/lib/pdf/html-renderer'
import { htmlToPdf } from '@/lib/pdf/renderer'
import type { Comment } from '@/lib/types'

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

  const [sections, comments, profile] = await Promise.all([
    listSections(params.clientId, params.reportId),
    listComments(params.clientId, params.reportId),
    getProfile(params.clientId),
  ])

  const commentsBySection: Record<string, Comment[]> = {}
  for (const c of comments) {
    if (!commentsBySection[c.sectionType]) commentsBySection[c.sectionType] = []
    commentsBySection[c.sectionType].push(c)
  }

  const html = renderReportHtml({
    clientName: client.name,
    year,
    month,
    sections,
    commentsBySection,
    fontSize: profile?.fontSize ?? 'normal',
  })

  const pdf = await htmlToPdf(html)
  return new NextResponse(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(client.name)}_${year}_${String(month).padStart(2, '0')}.pdf"`,
    },
  })
}
