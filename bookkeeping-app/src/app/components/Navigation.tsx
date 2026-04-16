import type { PageType } from '../lib/types'

interface Props {
  currentPage: PageType
  onNavigate: (page: PageType) => void
  companyName: string
}

const NAV_ITEMS: { page: PageType; label: string; icon: string }[] = [
  { page: 'dashboard', label: 'ホーム', icon: '🏠' },
  { page: 'cash-ledger', label: '現金出納帳', icon: '💴' },
  { page: 'bank-book', label: '通帳記録', icon: '🏦' },
  { page: 'settings', label: '設定', icon: '⚙️' },
]

export default function Navigation({ currentPage, onNavigate, companyName }: Props) {
  return (
    <nav className="w-56 bg-gray-800 text-white flex flex-col min-h-screen">
      <div className="p-4 border-b border-gray-700">
        <div className="text-xs text-gray-400 mb-1">帳簿管理</div>
        <div className="font-bold text-sm truncate">{companyName}</div>
      </div>

      <ul className="flex-1 py-2">
        {NAV_ITEMS.map(({ page, label, icon }) => (
          <li key={page}>
            <button
              onClick={() => onNavigate(page)}
              className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
                currentPage === page
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`}
            >
              <span className="text-lg">{icon}</span>
              <span className="text-sm font-medium">{label}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="p-4 text-xs text-gray-500 border-t border-gray-700">
        v1.0.0
      </div>
    </nav>
  )
}
