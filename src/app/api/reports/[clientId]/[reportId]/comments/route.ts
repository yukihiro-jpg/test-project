/**
 * コメント CRUD API
 *
 * GET: セクション別のコメント一覧
 * POST: 新規コメント作成（AI生成/手動入力）
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createComment, listComments } from '@/lib/firestore/reports-repo'

export const runtime = 'nodejs'

const CreateSchema = z.object({
  sectionType: z.enum([
    'executive_summary',
    'performance',
    'trend',
    'variance_analysis',
    'cash_flow',
    'segment',
    'advisories',
    'action_items',
  ]),
  pageNumber: z.number().int().nonnegative(),
  content: z.string().min(1),
  tags: z.array(z.enum(['important', 'next_month', 'continuing', 'completed'])).default([]),
  linkedCommentId: z.string().optional(),
  aiGenerated: z.boolean().default(false),
  aiOriginalContent: z.string().optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: { clientId: string; reportId: string } },
) {
  const comments = await listComments(params.clientId, params.reportId)
  return NextResponse.json({ comments })
}

export async function POST(
  req: NextRequest,
  { params }: { params: { clientId: string; reportId: string } },
) {
  const body = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const now = new Date()
  const comment = await createComment(params.clientId, params.reportId, {
    reportId: params.reportId,
    sectionType: parsed.data.sectionType,
    pageNumber: parsed.data.pageNumber,
    content: parsed.data.content,
    tags: parsed.data.tags,
    linkedCommentId: parsed.data.linkedCommentId,
    status: 'open',
    aiGenerated: parsed.data.aiGenerated,
    aiOriginalContent: parsed.data.aiOriginalContent,
    createdAt: now,
    updatedAt: now,
  })

  return NextResponse.json({ comment }, { status: 201 })
}
