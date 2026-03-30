import { NextRequest, NextResponse } from 'next/server'
import { getClient, getAllClients } from '@/lib/clients'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (id) {
    const client = getClient(id)
    if (!client) {
      return NextResponse.json({ error: '顧問先が見つかりません' }, { status: 404 })
    }
    return NextResponse.json({ id: client.id, name: client.name })
  }

  const clients = getAllClients().map((c) => ({ id: c.id, name: c.name }))
  return NextResponse.json(clients)
}
