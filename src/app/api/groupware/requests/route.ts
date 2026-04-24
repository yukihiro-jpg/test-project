import { NextResponse } from 'next/server'
import { bulkCreateRequests, createRequest, listRequests } from '@/lib/groupware/store'
import type { RequestItem } from '@/lib/groupware/types'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const clientId = url.searchParams.get('clientId') ?? undefined
  const requests = await listRequests(clientId)
  return NextResponse.json({ requests })
}

export async function POST(req: Request) {
  const body = (await req.json()) as
    | Partial<RequestItem>
    | { items: Array<Partial<RequestItem>> }

  if ('items' in body && Array.isArray(body.items)) {
    const inputs = body.items
      .filter((i): i is Partial<RequestItem> => !!i && !!i.clientId && !!i.title)
      .map((i) => ({
        clientId: i.clientId!,
        deadlineId: i.deadlineId,
        title: i.title!,
        description: i.description,
        status: (i.status ?? '未依頼') as RequestItem['status'],
        dueDate: i.dueDate,
        requestedAt: i.requestedAt,
        receivedAt: i.receivedAt,
        assignee: i.assignee,
      }))
    const created = await bulkCreateRequests(inputs)
    return NextResponse.json({ requests: created }, { status: 201 })
  }

  const single = body as Partial<RequestItem>
  if (!single.clientId || !single.title) {
    return NextResponse.json({ error: 'clientId and title are required' }, { status: 400 })
  }
  const created = await createRequest({
    clientId: single.clientId,
    deadlineId: single.deadlineId,
    title: single.title,
    description: single.description,
    status: (single.status ?? '未依頼') as RequestItem['status'],
    dueDate: single.dueDate,
    requestedAt: single.requestedAt,
    receivedAt: single.receivedAt,
    assignee: single.assignee,
  })
  return NextResponse.json({ request: created }, { status: 201 })
}
