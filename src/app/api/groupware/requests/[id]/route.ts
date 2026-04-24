import { NextResponse } from 'next/server'
import { deleteRequest, updateRequest } from '@/lib/groupware/store'

export const runtime = 'nodejs'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json()
  const updated = await updateRequest(params.id, body)
  if (!updated) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ request: updated })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ok = await deleteRequest(params.id)
  if (!ok) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
