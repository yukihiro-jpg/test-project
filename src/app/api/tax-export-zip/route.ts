import { NextResponse } from 'next/server'
import archiver from 'archiver'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type FileSpec = { name: string; content: string }

export async function POST(req: Request) {
  const body = (await req.json()) as { files: FileSpec[]; zipName?: string }
  if (!body?.files?.length) {
    return NextResponse.json({ error: 'files required' }, { status: 400 })
  }

  const archive = archiver('zip', { zlib: { level: 9 } })
  const bom = Buffer.from([0xef, 0xbb, 0xbf])

  const chunks: Buffer[] = []
  archive.on('data', (chunk: Buffer) => chunks.push(chunk))
  const done = new Promise<void>((resolve, reject) => {
    archive.on('end', () => resolve())
    archive.on('error', err => reject(err))
  })

  for (const f of body.files) {
    archive.append(Buffer.concat([bom, Buffer.from(f.content, 'utf-8')]), { name: f.name })
  }
  await archive.finalize()
  await done

  const zip = Buffer.concat(chunks)
  const zipName = body.zipName || 'export.zip'
  return new NextResponse(new Uint8Array(zip), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(zipName)}`,
    },
  })
}
