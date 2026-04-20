import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET() {
  const cookieStore = await cookies()
  const tokensCookie = cookieStore.get('google_tokens')
  return NextResponse.json({ connected: !!tokensCookie })
}

export async function DELETE() {
  const cookieStore = await cookies()
  cookieStore.delete('google_tokens')
  return NextResponse.json({ success: true })
}
