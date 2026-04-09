/**
 * 進捗管理 API
 *
 * GET    /api/notion/progress          - 進捗一覧を取得
 * POST   /api/notion/progress          - 進捗を新規作成
 * PATCH  /api/notion/progress?id=xxx   - 進捗を更新
 * DELETE /api/notion/progress?id=xxx   - 進捗をアーカイブ（削除）
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getProgressList,
  createProgress,
  updateProgress,
  deleteProgress,
} from '@/lib/notion'

export async function GET() {
  try {
    const list = await getProgressList()
    return NextResponse.json({ list })
  } catch (err: unknown) {
    const message = (err as { message?: string })?.message ?? '取得に失敗しました'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { 業務名, 顧客id, 業務種別, ステータス, 期限, 完了日, 備考 } = body
    if (!業務名) {
      return NextResponse.json({ error: '業務名は必須です' }, { status: 400 })
    }
    const id = await createProgress({
      業務名,
      顧客id: 顧客id ?? '',
      業務種別: 業務種別 ?? '',
      ステータス: ステータス ?? '未着手',
      期限: 期限 ?? '',
      完了日: 完了日 ?? '',
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
    await updateProgress(id, body)
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
    await deleteProgress(id)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = (err as { message?: string })?.message ?? '削除に失敗しました'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
