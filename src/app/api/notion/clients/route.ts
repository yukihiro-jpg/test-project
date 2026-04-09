/**
 * 顧客管理 API
 *
 * GET    /api/notion/clients          - 顧客一覧を取得
 * POST   /api/notion/clients          - 顧客を新規作成
 * PATCH  /api/notion/clients?id=xxx   - 顧客情報を更新
 * DELETE /api/notion/clients?id=xxx   - 顧客をアーカイブ（削除）
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getClients,
  createClient,
  updateClient,
  deleteClient,
} from '@/lib/notion'

export async function GET() {
  try {
    const clients = await getClients()
    return NextResponse.json({ clients })
  } catch (err: unknown) {
    const message = (err as { message?: string })?.message ?? '取得に失敗しました'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { 顧客名, 顧客コード, 担当者, 電話番号, メールアドレス, ステータス, 備考 } = body
    if (!顧客名) {
      return NextResponse.json({ error: '顧客名は必須です' }, { status: 400 })
    }
    const id = await createClient({
      顧客名,
      顧客コード: 顧客コード ?? '',
      担当者: 担当者 ?? '',
      電話番号: 電話番号 ?? '',
      メールアドレス: メールアドレス ?? '',
      ステータス: ステータス ?? '顧問中',
      備考: 備考 ?? '',
    })
    return NextResponse.json({ id }, { status: 201 })
  } catch (err: unknown) {
    const message = (err as { message?: string })?.message ?? '作成に失敗しました'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id が必要です' }, { status: 400 })
    const body = await req.json()
    await updateClient(id, body)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = (err as { message?: string })?.message ?? '更新に失敗しました'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id が必要です' }, { status: 400 })
    await deleteClient(id)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = (err as { message?: string })?.message ?? '削除に失敗しました'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
