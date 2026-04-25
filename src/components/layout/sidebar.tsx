'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import {
  Home, User, Users, LayoutList, MapPin, Building2, Banknote,
  TrendingUp, Shield, Gift, FileText, Calculator, Download, ChevronDown, ChevronRight,
  ArrowRightLeft, TrendingDown, ClipboardList, FileCheck, Calendar, X,
} from 'lucide-react';
import { useState } from 'react';
import { GoogleDrivePanel } from '@/components/google/GoogleDrivePanel';
import { useCaseStore } from '@/lib/store/case-store';
import {
  calculateLandValue, calculateBuildingValue, calculateCashValue,
  calculateListedStockValue, calculateUnlistedStockValue, calculateOtherAssetValue,
} from '@/lib/tax/asset-valuation';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  count?: number;
  total?: number;
}

function formatShort(n: number): string {
  if (!n) return '';
  if (n >= 100_000_000) return (n / 100_000_000).toFixed(1) + '億円';
  if (n >= 10_000) return Math.floor(n / 10_000).toLocaleString() + '万円';
  return n.toLocaleString() + '円';
}

export function Sidebar({ caseId, onClose }: { caseId: string; onClose?: () => void }) {
  const pathname = usePathname();
  const [assetsOpen, setAssetsOpen] = useState(true);
  const base = `/case/${caseId}`;
  const currentCase = useCaseStore(s => s.getCurrentCase());
  const a = currentCase?.assets;

  const navItems: NavItem[] = [
    { label: 'ダッシュボード', href: base, icon: <Home size={18} /> },
    { label: '業務フロー', href: `${base}/workflow`, icon: <ClipboardList size={18} /> },
    { label: '資料チェックリスト', href: `${base}/documents`, icon: <FileCheck size={18} /> },
    { label: 'スケジュール', href: `${base}/schedule`, icon: <Calendar size={18} /> },
    { label: '被相続人情報', href: `${base}/decedent`, icon: <User size={18} /> },
    { label: '相続人情報', href: `${base}/heirs`, icon: <Users size={18} /> },
  ];

  // 財産区分ごとの件数と合計金額を計算
  const landCount = a?.lands.length || 0;
  const landTotal = a ? a.lands.reduce((s, l) => s + calculateLandValue(l), 0) : 0;
  const bldCount = a?.buildings.length || 0;
  const bldTotal = a ? a.buildings.reduce((s, b) => s + calculateBuildingValue(b), 0) : 0;
  const cashCount = a?.cashDeposits.length || 0;
  const cashTotal = a ? a.cashDeposits.reduce((s, c) => s + calculateCashValue(c), 0) : 0;
  const listedCount = a?.listedStocks.length || 0;
  const listedTotal = a ? a.listedStocks.reduce((s, st) => s + calculateListedStockValue(st).totalValue, 0) : 0;
  const unlistedCount = a?.unlistedStocks.length || 0;
  const unlistedTotal = a ? a.unlistedStocks.reduce((s, st) => s + calculateUnlistedStockValue(st), 0) : 0;
  const insCount = a?.insurances.length || 0;
  const insTotal = a ? a.insurances.reduce((s, ins) => s + ins.amount, 0) : 0;
  const retCount = a?.retirementBenefits?.length || 0;
  const retTotal = a?.retirementBenefits ? a.retirementBenefits.reduce((s, r) => s + r.amount, 0) : 0;
  const otherCount = a?.others.length || 0;
  const otherTotal = a ? a.others.reduce((s, o) => s + calculateOtherAssetValue(o), 0) : 0;
  const debtCount = a?.debts.length || 0;
  const debtTotal = a ? a.debts.reduce((s, d) => s + d.amount, 0) : 0;
  const funeralCount = a?.funeralExpenses.length || 0;
  const funeralTotal = a ? a.funeralExpenses.reduce((s, f) => s + (f.amount || 0), 0) : 0;
  const compCount = a?.compensationPayments.length || 0;
  const compTotal = a ? a.compensationPayments.reduce((s, c) => s + c.amount, 0) : 0;

  // 財産一覧の総合計
  const assetGrandTotal = landTotal + bldTotal + cashTotal + listedTotal + unlistedTotal + insTotal + retTotal + otherTotal;
  const assetGrandCount = landCount + bldCount + cashCount + listedCount + unlistedCount + insCount + retCount + otherCount;

  const assetItems: NavItem[] = [
    { label: '財産一覧', href: `${base}/assets`, icon: <LayoutList size={18} />, count: assetGrandCount, total: assetGrandTotal },
    { label: '土地', href: `${base}/assets/land`, icon: <MapPin size={18} />, count: landCount, total: landTotal },
    { label: '建物', href: `${base}/assets/building`, icon: <Building2 size={18} />, count: bldCount, total: bldTotal },
    { label: '現金預金', href: `${base}/assets/cash`, icon: <Banknote size={18} />, count: cashCount, total: cashTotal },
    { label: '預金移動表', href: `${base}/funds-movement`, icon: <ArrowRightLeft size={18} /> },
    { label: '上場株式', href: `${base}/assets/listed-stock`, icon: <TrendingUp size={18} />, count: listedCount, total: listedTotal },
    { label: '非上場株式', href: `${base}/assets/unlisted-stock`, icon: <TrendingUp size={18} />, count: unlistedCount, total: unlistedTotal },
    { label: '保険金', href: `${base}/assets/insurance`, icon: <Shield size={18} />, count: insCount, total: insTotal },
    { label: '退職金', href: `${base}/assets/retirement`, icon: <Banknote size={18} />, count: retCount, total: retTotal },
    { label: 'その他財産', href: `${base}/assets/other`, icon: <Gift size={18} />, count: otherCount, total: otherTotal },
    { label: '債務', href: `${base}/assets/debt`, icon: <FileText size={18} />, count: debtCount, total: debtTotal },
    { label: '葬式費用', href: `${base}/assets/funeral`, icon: <FileText size={18} />, count: funeralCount, total: funeralTotal },
    { label: '代償分割金', href: `${base}/assets/compensation`, icon: <Banknote size={18} />, count: compCount, total: compTotal },
  ];

  const bottomItems: NavItem[] = [
    { label: '遺産分割', href: `${base}/division`, icon: <LayoutList size={18} /> },
    { label: '相続税シミュレーション', href: `${base}/simulation`, icon: <Calculator size={18} /> },
    { label: '二次相続シミュレーション', href: `${base}/secondary-inheritance`, icon: <ArrowRightLeft size={18} /> },
    { label: '節税シミュレーション', href: `${base}/tax-saving`, icon: <TrendingDown size={18} /> },
    { label: '報告書プレビュー', href: `${base}/report`, icon: <FileText size={18} /> },
    { label: '書類出力', href: `${base}/export`, icon: <Download size={18} /> },
  ];

  const renderNavItem = (item: NavItem) => {
    const isActive = pathname === item.href;
    const showStats = item.count !== undefined;
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          'flex items-start gap-3 rounded-md px-3 py-2 text-sm transition-colors',
          isActive
            ? 'bg-blue-50 text-blue-700 font-medium'
            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
        )}
      >
        <span className="mt-0.5 shrink-0">{item.icon}</span>
        <div className="flex-1 min-w-0">
          <div>{item.label}</div>
          {showStats && item.count! > 0 && (
            <div className={cn('text-[10px] leading-tight', isActive ? 'text-blue-600' : 'text-gray-400')}>
              {item.count}件 / {formatShort(item.total || 0)}
            </div>
          )}
        </div>
      </Link>
    );
  };

  return (
    <aside className="w-64 border-r border-gray-200 bg-white h-full overflow-y-auto flex-shrink-0">
      <div className="p-4 space-y-1 flex flex-col h-full">
        {onClose && (
          <div className="flex justify-end mb-2">
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded"
              aria-label="サイドバーを閉じる"
            >
              <X size={18} />
            </button>
          </div>
        )}
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
