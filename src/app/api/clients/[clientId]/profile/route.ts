/**
 * 社長プロファイル取得・更新 API
 */

import { NextRequest, NextResponse } from 'next/server'
import { getProfile, upsertProfile } from '@/lib/firestore/clients-repo'

export const runtime = 'nodejs'

export async function GET(_req: NextRequest, { params }: { params: { clientId: string } }) {
  const profile = await getProfile(params.clientId)
  return NextResponse.json({ profile })
}

export async function PUT(req: NextRequest, { params }: { params: { clientId: string } }) {
  const body = await req.json()
  await upsertProfile({ ...body, clientId: params.clientId })
  return NextResponse.json({ ok: true })
}
