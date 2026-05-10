import { NextRequest, NextResponse } from 'next/server'
import { uploadClientFile } from '@/lib/drive-report'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const yearLabel = formData.get('yearLabel') as string | null

    if (!file || !yearLabel) {
      return NextResponse.json({ error: 'file and yearLabel are required' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const mimeType = file.type || 'application/octet-stream'

    const uploaded = await uploadClientFile(params.id, yearLabel, file.name, buffer, mimeType)
    return NextResponse.json(uploaded, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
