import { useEffect, useMemo, useState } from 'react';
import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import CustomersPage from './pages/CustomersPage';
import SuppliersPage from './pages/SuppliersPage';
import ProductsPage from './pages/ProductsPage';
import DeliveriesPage from './pages/DeliveriesPage';
import SalesInvoicesPage from './pages/SalesInvoicesPage';
import PurchaseInvoicesPage from './pages/PurchaseInvoicesPage';
import PaymentsPage from './pages/PaymentsPage';
import CashflowPage from './pages/CashflowPage';
import ARAgingPage from './pages/ARAgingPage';
import APAgingPage from './pages/APAgingPage';
import StocktakePage from './pages/StocktakePage';
import SettingsPage from './pages/SettingsPage';

interface NavItem { to: string; label: string; }
interface NavGroup { key: string; label: string; items: NavItem[]; }
type NavNode = NavItem | NavGroup;

const navTree: NavNode[] = [
  { to: '/dashboard', label: 'ダッシュボード' },
  {
    key: 'sales',
    label: '売上管理',
    items: [
      { to: '/customers', label: '取引先（顧客）' },
      { to: '/products', label: '商品マスタ' },
      { to: '/deliveries', label: '納品書' },
      { to: '/sales-invoices', label: '売上請求書' },
      { to: '/ar-aging', label: '売掛金残高一覧' }
    ]
  },
  {
    key: 'purchase',
    label: '仕入管理',
    items: [
      { to: '/suppliers', label: '取引先（仕入先）' },
      { to: '/purchase-invoices', label: '買掛・仕入請求書' },
      { to: '/ap-aging', label: '買掛金残高一覧' },
      { to: '/stocktake', label: '棚卸表' }
    ]
  },
  {
    key: 'cash',
    label: '入出金管理',
    items: [
      { to: '/payments', label: '入出金 / 消込' },
      { to: '/cashflow', label: '資金繰り表' }
    ]
  },
  { to: '/settings', label: '設定' }
];

function isGroup(n: NavNode): n is NavGroup {
  return (n as NavGroup).items !== undefined;
}

function Sidebar() {
  const location = useLocation();
  const initialOpen = useMemo(() => {
    const o: Record<string, boolean> = {};
    for (const n of navTree) if (isGroup(n)) o[n.key] = true;
    return o;
  }, []);
  const [open, setOpen] = useState<Record<string, boolean>>(initialOpen);

  // Ensure group containing the active route is expanded.
  useEffect(() => {
    for (const n of navTree) {
      if (isGroup(n) && n.items.some(it => location.pathname.startsWith(it.to))) {
        setOpen(prev => prev[n.key] ? prev : { ...prev, [n.key]: true });
      }
    }
  }, [location.pathname]);

  const toggle = (key: string) => setOpen(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <aside className="w-56 bg-slate-800 text-slate-100 flex flex-col">
      <div className="p-4 text-lg font-bold border-b border-slate-700">販売管理</div>
      <nav className="flex-1 overflow-y-auto py-2">
        {navTree.map(n => {
          if (!isGroup(n)) {
            return (
              <NavLink key={n.to} to={n.to}
                className={({ isActive }) =>
                  `block px-4 py-2 text-sm font-semibold hover:bg-slate-700 ${isActive ? 'bg-slate-700' : ''}`}>
                {n.label}
              </NavLink>
            );
          }
          const hasActive = n.items.some(it => location.pathname.startsWith(it.to));
          const isOpen = open[n.key] || hasActive;
          return (
            <div key={n.key} className="mt-1">
              <button
                onClick={() => toggle(n.key)}
                className="w-full flex items-center justify-between px-4 py-2 text-sm font-bold text-slate-50 hover:bg-slate-700"
              >
                <span>{n.label}</span>
                <span className="text-xs">{isOpen ? '▾' : '▸'}</span>
              </button>
              {isOpen && (
                <div>
                  {n.items.map(it => (
                    <NavLink key={it.to} to={it.to}
                      className={({ isActive }) =>
                        `block pl-8 pr-4 py-1.5 text-sm hover:bg-slate-700 ${isActive ? 'bg-slate-700 font-semibold' : 'text-slate-200'}`}>
                      {it.label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

export default function App() {
  return (
    <div className="flex h-full">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/suppliers" element={<SuppliersPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/deliveries" element={<DeliveriesPage />} />
          <Route path="/sales-invoices" element={<SalesInvoicesPage />} />
          <Route path="/purchase-invoices" element={<PurchaseInvoicesPage />} />
          <Route path="/payments" element={<PaymentsPage />} />
          <Route path="/cashflow" element={<CashflowPage />} />
          <Route path="/ar-aging" element={<ARAgingPage />} />
          <Route path="/ap-aging" element={<APAgingPage />} />
          <Route path="/stocktake" element={<StocktakePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}
