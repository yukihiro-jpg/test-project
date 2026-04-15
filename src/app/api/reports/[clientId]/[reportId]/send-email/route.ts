/**
 * 月次報告メール送信 API
 *
 * PDF/Excel を生成して添付し、社長へメール送信する。
 * 送信完了後、レポートのステータスを "sent" に更新する。
 *
 * 注意：
 *   OAuth の access_token は UI 側で取得したものを POST ボディで渡す。
 *   本格運用時は refresh_token をサーバー側で永続化する。
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getClient, getProfile } from '@/lib/firestore/clients-repo'
import { listComments, listSections, updateReportStatus } from '@/lib/firestore/reports-repo'
import { renderReportExcel } from '@/lib/excel/renderer'
import { sendMail } from '@/lib/gmail/client'
import { renderReportHtml } from '@/lib/pdf/html-renderer'
import { htmlToPdf } from '@/lib/pdf/renderer'
import type { Comment } from '@/lib/types'

export const runtime = 'nodejs'
export const maxDuration = 120

const Schema = z.object({
  accessToken: z.string(),
  subject: z.string().optional(),
  bodyText: z.string().optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: { clientId: string; reportId: string } },
) {
  const body = await req.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const client = await getClient(params.clientId)
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const profile = await getProfile(params.clientId)
  if (!profile?.presidentEmail) {
    return NextResponse.json(
      { error: '社長プロファイルにメールアドレスが未設定です' },
      { status: 400 },
    )
  }

  const [yearStr, monthStr] = params.reportId.split('_')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)

  const [sections, comments] = await Promise.all([
    listSections(params.clientId, params.reportId),
    listComments(params.clientId, params.reportId),
  ])
  const commentsBySection: Record<string, Comment[]> = {}
  for (const c of comments) {
    if (!commentsBySection[c.sectionType]) commentsBySection[c.sectionType] = []
    commentsBySection[c.sectionType].push(c)
  }

  const [pdf, excel] = await Promise.all([
    htmlToPdf(
      renderReportHtml({
        clientName: client.name,
        year,
        month,
        sections,
        commentsBySection,
        fontSize: profile.fontSize,
      }),
    ),
    renderReportExcel({ clientName: client.name, year, month, sections }),
  ])

  const from = process.env.GMAIL_SENDER_EMAIL ?? ''
  const subject = parsed.data.subject ?? `${year}年${month}月 月次財務報告`
  const bodyText =
    parsed.data.bodyText ??
    `${profile.presidentName ?? ''} 様\n\nお世話になっております。\n${year}年${month}月分の月次財務報告をお送りします。\n添付のPDFとExcelをご確認ください。\n\n何卒よろしくお願いいたします。`

  const baseFilename = `${client.name}_${year}_${String(month).padStart(2, '0')}`

  const messageId = await sendMail({
    accessToken: parsed.data.accessToken,
    from,
    to: profile.presidentEmail,
    subject,
    bodyText,
    attachments: [
      { filename: `${baseFilename}.pdf`, mimeType: 'application/pdf', content: pdf },
      {
        filename: `${baseFilename}.xlsx`,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        content: excel,
      },
    ],
  })

  await updateReportStatus(params.clientId, year, month, 'sent')

  return NextResponse.json({ ok: true, messageId })
}
