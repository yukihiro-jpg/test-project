import { NextRequest, NextResponse } from 'next/server'
import { getClientDynamic, getAllClientsDynamic } from '@/lib/clients'
import { getFiscalYear, FISCAL_YEARS } from '@/lib/fiscal-year'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const yearId = searchParams.get('year')

  if (id && yearId) {
    const client = await getClientDynamic(yearId, id)
    if (!client) {
      return NextResponse.json({ error: '顧問先が見つかりません' }, { status: 404 })
    }

    const fiscalYear = getFiscalYear(yearId)
    return NextResponse.json({
      code: client.code,
      name: client.name,
      yearLabel: fiscalYear?.label ?? null,
    })
  }

  // 管理画面用: 年度指定で登録済み会社一覧を返す
  const fiscalYears = FISCAL_YEARS.map((fy) => ({ id: fy.id, label: fy.label }))

  if (yearId) {
    const clients = await getAllClientsDynamic(yearId)
    return NextResponse.json({
      clients: clients.map((c) => ({ code: c.code, name: c.name })),
      fiscalYears,
    })
  }

  return NextResponse.json({ clients: [], fiscalYears })
}
