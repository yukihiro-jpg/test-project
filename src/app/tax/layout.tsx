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
  themeColor: '#F2F2F7',
}

export default function TaxLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen bg-[#F2F2F7] text-gray-900 antialiased"
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Yu Gothic Medium", "Meiryo", system-ui, sans-serif',
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      {children}
    </div>
  )
}
