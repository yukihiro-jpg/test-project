import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '税理士事務所 グループウェア',
  description: '顧問先管理・申告期限管理・ツールランチャー',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body className="bg-canvas min-h-screen text-ink">{children}</body>
    </html>
  )
}
