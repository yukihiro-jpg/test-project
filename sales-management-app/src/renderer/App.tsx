import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
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

const nav = [
  { to: '/dashboard', label: 'ダッシュボード' },
  { to: '/customers', label: '取引先（顧客）' },
  { to: '/suppliers', label: '取引先（仕入先）' },
  { to: '/products', label: '商品マスタ' },
  { to: '/deliveries', label: '納品書' },
  { to: '/sales-invoices', label: '売上請求書' },
  { to: '/purchase-invoices', label: '買掛・仕入請求書' },
  { to: '/payments', label: '入出金 / 消込' },
  { to: '/cashflow', label: '資金繰り表' },
  { to: '/ar-aging', label: '売掛金残高一覧' },
  { to: '/ap-aging', label: '買掛金残高一覧' },
  { to: '/stocktake', label: '棚卸表' },
  { to: '/settings', label: '設定' }
];

export default function App() {
  return (
    <div className="flex h-full">
      <aside className="w-56 bg-slate-800 text-slate-100 flex flex-col">
        <div className="p-4 text-lg font-bold border-b border-slate-700">販売管理</div>
        <nav className="flex-1 overflow-y-auto">
          {nav.map(n => (
            <NavLink key={n.to} to={n.to}
              className={({ isActive }) =>
                `block px-4 py-2 text-sm hover:bg-slate-700 ${isActive ? 'bg-slate-700 font-semibold' : ''}`}>
              {n.label}
            </NavLink>
          ))}
        </nav>
      </aside>
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
