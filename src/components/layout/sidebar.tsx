'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import {
  Home, User, Users, LayoutList, MapPin, Building2, Banknote,
  TrendingUp, Shield, Gift, FileText, Calculator, Download, ChevronDown, ChevronRight,
  ArrowRightLeft, TrendingDown,
} from 'lucide-react';
import { useState } from 'react';
import { GoogleDrivePanel } from '@/components/google/GoogleDrivePanel';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  children?: NavItem[];
}

export function Sidebar({ caseId }: { caseId: string }) {
  const pathname = usePathname();
  const [assetsOpen, setAssetsOpen] = useState(true);
  const base = `/case/${caseId}`;

  const navItems: NavItem[] = [
    { label: 'ダッシュボード', href: base, icon: <Home size={18} /> },
    { label: '被相続人情報', href: `${base}/decedent`, icon: <User size={18} /> },
    { label: '相続人情報', href: `${base}/heirs`, icon: <Users size={18} /> },
  ];

  const assetItems: NavItem[] = [
    { label: '財産一覧', href: `${base}/assets`, icon: <LayoutList size={18} /> },
    { label: '土地', href: `${base}/assets/land`, icon: <MapPin size={18} /> },
    { label: '建物', href: `${base}/assets/building`, icon: <Building2 size={18} /> },
    { label: '現金預金', href: `${base}/assets/cash`, icon: <Banknote size={18} /> },
    { label: '上場株式', href: `${base}/assets/listed-stock`, icon: <TrendingUp size={18} /> },
    { label: '非上場株式', href: `${base}/assets/unlisted-stock`, icon: <TrendingUp size={18} /> },
    { label: '保険金', href: `${base}/assets/insurance`, icon: <Shield size={18} /> },
    { label: 'その他財産', href: `${base}/assets/other`, icon: <Gift size={18} /> },
    { label: '債務', href: `${base}/assets/debt`, icon: <FileText size={18} /> },
    { label: '葬式費用', href: `${base}/assets/funeral`, icon: <FileText size={18} /> },
    { label: '代償分割金', href: `${base}/assets/compensation`, icon: <Banknote size={18} /> },
  ];

  const bottomItems: NavItem[] = [
    { label: '遺産分割', href: `${base}/division`, icon: <LayoutList size={18} /> },
    { label: '相続税シミュレーション', href: `${base}/simulation`, icon: <Calculator size={18} /> },
    { label: '二次相続シミュレーション', href: `${base}/secondary-inheritance`, icon: <ArrowRightLeft size={18} /> },
    { label: '節税シミュレーション', href: `${base}/tax-saving`, icon: <TrendingDown size={18} /> },
    { label: '書類出力', href: `${base}/export`, icon: <Download size={18} /> },
  ];

  const renderNavItem = (item: NavItem) => (
    <Link
      key={item.href}
      href={item.href}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
        pathname === item.href
          ? 'bg-blue-50 text-blue-700 font-medium'
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
      )}
    >
      {item.icon}
      {item.label}
    </Link>
  );

  return (
    <aside className="w-64 border-r border-gray-200 bg-white h-full overflow-y-auto">
      <div className="p-4 space-y-1 flex flex-col h-full">
        <div className="flex-1 space-y-1">
          {navItems.map(renderNavItem)}

          {/* 財産セクション */}
          <button
            onClick={() => setAssetsOpen(!assetsOpen)}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 w-full"
          >
            {assetsOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            <span className="font-medium">財産情報</span>
          </button>
          {assetsOpen && (
            <div className="ml-2 space-y-1">
              {assetItems.map(renderNavItem)}
            </div>
          )}

          <div className="border-t border-gray-200 my-2" />
          {bottomItems.map(renderNavItem)}
        </div>

        {/* Googleドライブ連携 */}
        <div className="border-t border-gray-200 pt-3 mt-3">
          <GoogleDrivePanel />
        </div>
      </div>
    </aside>
  );
}
