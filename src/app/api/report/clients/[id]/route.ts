import { NextRequest, NextResponse } from 'next/server'
import { getClientDetail, updateClient, deleteClient } from '@/lib/drive-report'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const detail = await getClientDetail(params.id)
    if (!detail) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(detail)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to load client' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const updated = await updateClient(params.id, body)
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(updated)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to update client' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await deleteClient(params.id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to delete client' }, { status: 500 })
  }
}
