import { NextRequest, NextResponse } from 'next/server'
import { deleteClient, getClient, updateClient } from '@/lib/firestore/clients-repo'

export const runtime = 'nodejs'

export async function GET(_req: NextRequest, { params }: { params: { clientId: string } }) {
  const client = await getClient(params.clientId)
  if (!client) return NextResponse.json({ error: 'Not Found' }, { status: 404 })
  return NextResponse.json({ client })
}

export async function PATCH(req: NextRequest, { params }: { params: { clientId: string } }) {
  const body = await req.json()
  await updateClient(params.clientId, body)
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: { clientId: string } }) {
  await deleteClient(params.clientId)
  return NextResponse.json({ ok: true })
}
