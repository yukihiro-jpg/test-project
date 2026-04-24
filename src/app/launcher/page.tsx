import { AppShell } from '@/components/groupware/AppShell'
import { LauncherManager } from '@/components/groupware/LauncherManager'
import { listLauncherApps } from '@/lib/groupware/store'

export const dynamic = 'force-dynamic'

export default async function LauncherPage() {
  const apps = await listLauncherApps()
  return (
    <AppShell>
      <div className="mb-8">
        <p className="gw-label mb-2">アプリランチャー</p>
        <h1 className="text-[36px] font-semibold tracking-tight">ツール連携</h1>
        <p className="text-ink-soft mt-1">
          Claude Codeで作った他アプリの起動ボタンを登録します。ダッシュボードから一括で呼び出せます。
        </p>
      </div>
      <LauncherManager apps={apps} />
    </AppShell>
  )
}
