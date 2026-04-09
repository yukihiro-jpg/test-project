/**
 * タスク管理 API
 *
 * GET    /api/notion/tasks          - タスク一覧を取得
 * POST   /api/notion/tasks          - タスクを新規作成
 * PATCH  /api/notion/tasks?id=xxx   - タスクを更新
 * DELETE /api/notion/tasks?id=xxx   - タスクをアーカイブ（削除）
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
} from '@/lib/notion'

export async function GET() {
  try {
    const tasks = await getTasks()
    return NextResponse.json({ tasks })
  } catch (err: unknown) {
    const message = (err as { message?: string })?.message ?? '取得に失敗しました'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { タスク名, 顧客id, 優先度, ステータス, 期限, 備考 } = body
    if (!タスク名) {
      return NextResponse.json({ error: 'タスク名は必須です' }, { status: 400 })
    }
    const id = await createTask({
      タスク名,
      顧客id: 顧客id ?? '',
      優先度: 優先度 ?? '中',
      ステータス: ステータス ?? '未着手',
      期限: 期限 ?? '',
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
    await updateTask(id, body)
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
    await deleteTask(id)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = (err as { message?: string })?.message ?? '削除に失敗しました'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
