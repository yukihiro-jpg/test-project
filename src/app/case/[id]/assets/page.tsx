'use client';

import { useCaseStore } from '@/lib/store/case-store';
import { Card, CardContent } from '@/components/ui/card';
import { formatManyen } from '@/components/common/currency-input';
import {
  calculateTotalAssetValue,
} from '@/lib/tax/inheritance-tax';
import {
  calculateLandValue,
  calculateBuildingValue,
  calculateCashValue,
  calculateListedStockValue,
  calculateUnlistedStockValue,
  calculateOtherAssetValue,
  calculateInsuranceExemption,
  calculateDeductibleFuneralExpenses,
} from '@/lib/tax/asset-valuation';
import { countLegalHeirs } from '@/lib/tax/deductions';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function AssetsOverview() {
  const params = useParams();
  const caseId = params.id as string;
  const currentCase = useCaseStore(s => s.getCurrentCase());

  if (!currentCase) return <p className="text-gray-500">案件を選択してください</p>;

  const { assets, heirs } = currentCase;
  const legalHeirCount = countLegalHeirs(heirs);

  const categories = [
    {
      label: '土地',
      count: assets.lands.length,
      value: assets.lands.reduce((sum, l) => sum + calculateLandValue(l), 0),
      href: 'land',
    },
    {
      label: '建物',
      count: assets.buildings.length,
      value: assets.buildings.reduce((sum, b) => sum + calculateBuildingValue(b), 0),
      href: 'building',
    },
    {
      label: '現金預金',
      count: assets.cashDeposits.length,
      value: assets.cashDeposits.reduce((sum, c) => sum + calculateCashValue(c), 0),
      href: 'cash',
    },
    {
      label: '上場株式',
      count: assets.listedStocks.length,
      value: assets.listedStocks.reduce((sum, s) => sum + calculateListedStockValue(s).totalValue, 0),
      href: 'listed-stock',
    },
    {
      label: '非上場株式',
      count: assets.unlistedStocks.length,
      value: assets.unlistedStocks.reduce((sum, s) => sum + calculateUnlistedStockValue(s), 0),
      href: 'unlisted-stock',
    },
    {
      label: '保険金',
      count: assets.insurances.length,
      value: calculateInsuranceExemption(assets.insurances, legalHeirCount).totalAmount,
      href: 'insurance',
    },
    {
      label: 'その他財産',
      count: assets.others.length,
      value: assets.others.reduce((sum, o) => sum + calculateOtherAssetValue(o), 0),
      href: 'other',
    },
    {
      label: '債務',
      count: assets.debts.length,
      value: assets.debts.reduce((sum, d) => sum + d.amount, 0),
      href: 'debt',
      isNegative: true,
    },
    {
      label: '葬式費用',
      count: assets.funeralExpenses.length,
      value: calculateDeductibleFuneralExpenses(assets.funeralExpenses),
      href: 'funeral',
      isNegative: true,
    },
    {
      label: '代償分割金',
      count: assets.compensationPayments.length,
      value: assets.compensationPayments.reduce((sum, c) => sum + c.amount, 0),
      href: 'compensation',
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">財産一覧</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {categories.map(cat => (
          <Link key={cat.href} href={`/case/${caseId}/assets/${cat.href}`}>
            <Card className="hover:border-blue-300 transition-colors cursor-pointer">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">{cat.label}</p>
                    <p className="text-xs text-gray-400">{cat.count}件</p>
                  </div>
                  <p className={`text-lg font-semibold ${cat.isNegative ? 'text-red-600' : 'text-gray-900'}`}>
                    {cat.isNegative ? '▲ ' : ''}{formatManyen(cat.value)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
