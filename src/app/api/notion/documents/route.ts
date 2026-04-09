/**
 * 依頼資料リスト API
 *
 * GET    /api/notion/documents          - 依頼資料一覧を取得
 * POST   /api/notion/documents          - 依頼資料を新規作成
 * PATCH  /api/notion/documents?id=xxx   - 依頼資料を更新
 * DELETE /api/notion/documents?id=xxx   - 依頼資料をアーカイブ（削除）
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getDocumentRequests,
  createDocumentRequest,
  updateDocumentRequest,
  deleteDocumentRequest,
} from '@/lib/notion'

export async function GET() {
  try {
    const list = await getDocumentRequests()
    return NextResponse.json({ list })
  } catch (err: unknown) {
    const message = (err as { message?: string })?.message ?? '取得に失敗しました'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { 資料名, 顧客id, 資料種別, ステータス, 依頼日, 受取日, 備考 } = body
    if (!資料名) {
      return NextResponse.json({ error: '資料名は必須です' }, { status: 400 })
    }
    const id = await createDocumentRequest({
      資料名,
      顧客id: 顧客id ?? '',
      資料種別: 資料種別 ?? '',
      ステータス: ステータス ?? '依頼中',
      依頼日: 依頼日 ?? '',
      受取日: 受取日 ?? '',
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
    await updateDocumentRequest(id, body)
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
    await deleteDocumentRequest(id)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = (err as { message?: string })?.message ?? '削除に失敗しました'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
