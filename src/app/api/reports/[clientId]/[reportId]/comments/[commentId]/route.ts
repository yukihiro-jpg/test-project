import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { updateComment } from '@/lib/firestore/reports-repo'

export const runtime = 'nodejs'

const PatchSchema = z.object({
  content: z.string().optional(),
  tags: z.array(z.enum(['important', 'next_month', 'continuing', 'completed'])).optional(),
  status: z.enum(['open', 'closed']).optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: { clientId: string; reportId: string; commentId: string } },
) {
  const body = await req.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const patch: Record<string, unknown> = { ...parsed.data }
  if (parsed.data.status === 'closed') patch.closedAt = new Date()

  await updateComment(params.clientId, params.reportId, params.commentId, patch)
  return NextResponse.json({ ok: true })
}
