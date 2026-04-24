import { NextResponse } from 'next/server'
import { deleteLauncherApp, updateLauncherApp } from '@/lib/groupware/store'

export const runtime = 'nodejs'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json()
  const updated = await updateLauncherApp(params.id, body)
  if (!updated) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ app: updated })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ok = await deleteLauncherApp(params.id)
  if (!ok) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
