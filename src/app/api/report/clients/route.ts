import { NextRequest, NextResponse } from 'next/server'
import { listClients, createClient } from '@/lib/drive-report'
import type { Client } from '@/types/report'
import { v4 as uuidv4 } from 'uuid'

export async function GET() {
  try {
    const clients = await listClients()
    return NextResponse.json(clients)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to load clients' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, fiscalYearEndMonth, fiscalYearLabel } = body
    if (!name || !fiscalYearEndMonth || !fiscalYearLabel) {
      return NextResponse.json({ error: 'name, fiscalYearEndMonth, fiscalYearLabel are required' }, { status: 400 })
    }
    const client: Client = {
      id: uuidv4(),
      name,
      fiscalYearEndMonth: Number(fiscalYearEndMonth),
      fiscalYearLabel,
      createdAt: new Date().toISOString(),
    }
    const created = await createClient(client)
    return NextResponse.json(created, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to create client' }, { status: 500 })
  }
}
