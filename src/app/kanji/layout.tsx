import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: '漢字ドリル｜小4',
  description: '小学4年生（上・新学社）の漢字ドリル学習アプリ',
  manifest: '/kanji/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: '漢字ドリル',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: '/kanji/icon.svg',
    apple: '/kanji/icon.svg',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#fff7ed',
}

export default function KanjiLayout({ children }: { children: React.ReactNode }) {
  return <div className="kanji-app">{children}</div>
}
