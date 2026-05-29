import { NextResponse } from 'next/server'
import { createClient, RedisClientType } from 'redis'

const KEY = 'tax-app:store:v1'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

let client: RedisClientType | null = null

async function getClient(): Promise<RedisClientType> {
  if (client && client.isOpen) return client
  const url = process.env.REDIS_URL
  if (!url) throw new Error('REDIS_URL is not set')
  client = createClient({ url })
  client.on('error', err => console.error('Redis error', err))
  await client.connect()
  return client
}

export async function GET() {
  const c = await getClient()
  const raw = await c.get(KEY)
  return NextResponse.json(raw ? JSON.parse(raw) : null)
}

export async function POST(req: Request) {
  const body = await req.json()
  const c = await getClient()
  await c.set(KEY, JSON.stringify(body))
  return NextResponse.json({ ok: true })
}
