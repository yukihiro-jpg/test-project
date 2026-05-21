import { NextResponse } from 'next/server'
import { kv } from '@vercel/kv'

const KEY = 'tax-app:store:v1'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const data = await kv.get(KEY)
  return NextResponse.json(data ?? null)
}

export async function POST(req: Request) {
  const body = await req.json()
  await kv.set(KEY, body)
  return NextResponse.json({ ok: true })
}
