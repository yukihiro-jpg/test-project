'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/', label: 'ホーム' },
  { href: '/clients', label: '顧問先' },
  { href: '/deadlines', label: '期限管理' },
  { href: '/launcher', label: 'アプリ' },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-white/75 border-b border-black/5">
        <div className="max-w-[1200px] mx-auto px-5 h-12 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-ink">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-ink text-white text-[11px]">税</span>
            税理士事務所 グループウェア
          </Link>
          <nav className="flex items-center gap-1">
            {NAV.map((n) => {
              const active =
                n.href === '/' ? pathname === '/' : pathname?.startsWith(n.href)
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={
                    'px-3 py-1.5 rounded-full text-[13px] transition-colors ' +
                    (active
                      ? 'bg-ink text-white'
                      : 'text-ink-soft hover:bg-surface-muted')
                  }
                >
                  {n.label}
                </Link>
              )
            })}
          </nav>
        </div>
      </header>
      <main className="max-w-[1200px] mx-auto px-5 py-10">{children}</main>
      <footer className="max-w-[1200px] mx-auto px-5 py-10 text-center text-xs text-ink-mute">
        事務所内利用 · データは本サーバーのJSONファイルに保存されます
      </footer>
    </div>
  )
}
