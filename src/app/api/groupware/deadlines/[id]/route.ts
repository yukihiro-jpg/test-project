import { NextResponse } from 'next/server'
import { deleteDeadline, updateDeadline } from '@/lib/groupware/store'

export const runtime = 'nodejs'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json()
  const updated = await updateDeadline(params.id, body)
  if (!updated) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ deadline: updated })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ok = await deleteDeadline(params.id)
  if (!ok) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
