import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '通帳解析アプリ',
  description: '相続税申告における現金預金評価のための通帳解析ツール'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="bg-slate-50 text-slate-900 min-h-screen">
        <header className="bg-slate-900 text-white py-4 px-6 shadow">
          <h1 className="text-xl font-bold">通帳解析アプリ</h1>
          <p className="text-xs text-slate-300">相続税申告 現金預金評価ツール</p>
        </header>
        <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  )
}
