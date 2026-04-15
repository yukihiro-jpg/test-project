/**
 * 顧問先 CRUD API
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, listClients } from '@/lib/firestore/clients-repo'

export const runtime = 'nodejs'

const CreateSchema = z.object({
  name: z.string().min(1),
  industryCode: z.string().min(1),
  capitalScale: z.enum([
    'less_than_10m',
    '10m_to_50m',
    '50m_to_100m',
    '100m_to_1b',
    'more_than_1b',
  ]),
  fiscalYearEndMonth: z.number().int().min(1).max(12),
  employeeCount: z.number().int().nonnegative().optional(),
})

export async function GET() {
  const clients = await listClients()
  return NextResponse.json({ clients })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const client = await createClient(parsed.data)
  return NextResponse.json({ client }, { status: 201 })
}
