import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '月次財務報告アプリ',
  description: '会計データから顧問先社長向けの月次報告資料を自動生成',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-gray-50 text-neutral font-sans">
        {children}
      </body>
    </html>
  )
}
