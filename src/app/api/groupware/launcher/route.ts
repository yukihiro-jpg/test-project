import { NextResponse } from 'next/server'
import { createLauncherApp, listLauncherApps } from '@/lib/groupware/store'
import type { LauncherApp } from '@/lib/groupware/types'

export const runtime = 'nodejs'

export async function GET() {
  const apps = await listLauncherApps()
  return NextResponse.json({ apps })
}

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<LauncherApp>
  if (!body.name || !body.url || !body.type) {
    return NextResponse.json({ error: 'name, url, type are required' }, { status: 400 })
  }
  const app = await createLauncherApp({
    name: body.name,
    description: body.description,
    url: body.url,
    type: body.type,
    icon: body.icon,
    color: body.color,
    openInNewTab: body.openInNewTab ?? true,
    order: body.order ?? 99,
  })
  return NextResponse.json({ app }, { status: 201 })
}
