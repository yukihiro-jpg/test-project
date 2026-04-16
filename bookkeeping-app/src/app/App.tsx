import { useState, useEffect } from 'react'
import type { AppConfig, PageType } from './lib/types'
import { hasConfig, readConfig } from './lib/ipc'
import Navigation from './components/Navigation'
import SetupWizard from './components/SetupWizard'
import DashboardPage from './pages/DashboardPage'
import CashLedgerPage from './pages/CashLedgerPage'
import BankBookPage from './pages/BankBookPage'
import SettingsPage from './pages/SettingsPage'
import HelpPage from './pages/HelpPage'

export default function App() {
  const [isLoading, setIsLoading] = useState(true)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [currentPage, setCurrentPage] = useState<PageType>('dashboard')

  useEffect(() => {
    async function init() {
      try {
        const configured = await hasConfig()
        if (configured) {
          const cfg = await readConfig()
          setConfig(cfg)
          setNeedsSetup(false)
        } else {
          setNeedsSetup(true)
        }
      } catch {
        setNeedsSetup(true)
      } finally {
        setIsLoading(false)
      }
    }
    init()
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500 text-lg">読み込み中...</div>
      </div>
    )
  }

  if (needsSetup || !config) {
    return (
      <SetupWizard
        onComplete={(cfg) => {
          setConfig(cfg)
          setNeedsSetup(false)
        }}
      />
    )
  }

  return (
    <div className="flex min-h-screen">
      <Navigation currentPage={currentPage} onNavigate={setCurrentPage} companyName={config.companyName} />
      <main className="flex-1 overflow-auto">
        {currentPage === 'dashboard' && (
          <DashboardPage config={config} onNavigate={setCurrentPage} />
        )}
        {currentPage === 'cash-ledger' && (
          <CashLedgerPage config={config} />
        )}
        {currentPage === 'bank-book' && (
          <BankBookPage config={config} />
        )}
        {currentPage === 'settings' && (
          <SettingsPage
            config={config}
            onConfigUpdate={(cfg) => setConfig(cfg)}
          />
        )}
        {currentPage === 'help' && (
          <HelpPage />
        )}
      </main>
    </div>
  )
}
