import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: '源泉所得税 納付書アシスタント',
  description: '従業員の給与から源泉所得税を計算し、納付書のイメージを表示します。',
  manifest: '/tax/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '源泉納付書',
  },
  icons: {
    icon: '/tax/icon.svg',
    apple: '/tax/icon.svg',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#1f2937',
}

export default function TaxLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-gray-50 text-gray-800">{children}</div>
}
