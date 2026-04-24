import { NextResponse } from 'next/server'
import {
  bulkCreateDeadlines,
  deleteClient,
  getClient,
  listDeadlines,
  listRequests,
  updateClient,
} from '@/lib/groupware/store'
import { generateDeadlineDrafts } from '@/lib/groupware/deadlines'

export const runtime = 'nodejs'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const client = await getClient(params.id)
  if (!client) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const [deadlines, requests] = await Promise.all([
    listDeadlines(params.id),
    listRequests(params.id),
  ])
  return NextResponse.json({ client, deadlines, requests })
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json()
  const regenerate: boolean = body.regenerateDeadlines === true
  delete body.regenerateDeadlines

  const updated = await updateClient(params.id, body)
  if (!updated) return NextResponse.json({ error: 'not found' }, { status: 404 })

  let deadlinesCreated = 0
  if (regenerate) {
    const drafts = generateDeadlineDrafts(updated)
    if (drafts.length > 0) {
      const created = await bulkCreateDeadlines(drafts)
      deadlinesCreated = created.length
    }
  }
  return NextResponse.json({ client: updated, deadlinesCreated })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ok = await deleteClient(params.id)
  if (!ok) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
