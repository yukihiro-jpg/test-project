import { NextRequest, NextResponse } from 'next/server'
import { getClient, getAllClients } from '@/lib/clients'
import { getFiscalYear, FISCAL_YEARS } from '@/lib/fiscal-year'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const yearId = searchParams.get('year')

  if (id) {
    const client = getClient(id)
    if (!client) {
      return NextResponse.json({ error: '顧問先が見つかりません' }, { status: 404 })
    }

    const fiscalYear = yearId ? getFiscalYear(yearId) : null

    return NextResponse.json({
      id: client.id,
      name: client.name,
      yearLabel: fiscalYear?.label ?? null,
    })
  }

  const clients = getAllClients().map((c) => ({ id: c.id, name: c.name }))
  const fiscalYears = FISCAL_YEARS.map((fy) => ({ id: fy.id, label: fy.label }))
  return NextResponse.json({ clients, fiscalYears })
}
