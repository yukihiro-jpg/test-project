'use client'

// CSV生成（Excel互換のためUTF-8 BOM付き）
export function toCsv(rows: (string | number)[][]): string {
  const escape = (v: string | number) => {
    const s = String(v ?? '')
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
    return s
  }
  return rows.map(r => r.map(escape).join(',')).join('\r\n')
}

export function csvBlob(csv: string): Blob {
  const bom = new Uint8Array([0xef, 0xbb, 0xbf])
  return new Blob([bom, csv], { type: 'text/csv;charset=utf-8' })
}

export function downloadFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function shareFiles(files: File[], title: string): Promise<boolean> {
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean }
  if (nav.canShare && nav.canShare({ files })) {
    try {
      await nav.share({ files, title })
      return true
    } catch {
      return false
    }
  }
  return false
}
