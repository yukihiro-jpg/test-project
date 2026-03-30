'use client';

import { useCaseStore } from '@/lib/store/case-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { calculateTotalAssetValue } from '@/lib/tax/inheritance-tax';
import { calculateInsuranceExemption, calculateDeductibleFuneralExpenses } from '@/lib/tax/asset-valuation';
import { countLegalHeirs } from '@/lib/tax/deductions';
import { formatManyen } from '@/components/common/currency-input';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function CaseDashboard() {
  const params = useParams();
  const caseId = params.id as string;
  const currentCase = useCaseStore(s => s.getCurrentCase());

  if (!currentCase) {
    return <p className="text-gray-500">案件が見つかりません</p>;
  }

  const { assets, heirs } = currentCase;
  const totalAsset = calculateTotalAssetValue(assets);
  const legalHeirCount = countLegalHeirs(heirs);
  const insurance = calculateInsuranceExemption(assets.insurances, legalHeirCount);
  const totalDebt = assets.debts.reduce((sum, d) => sum + d.amount, 0);
  const funeralCost = calculateDeductibleFuneralExpenses(assets.funeralExpenses);

  const summaryItems = [
    { label: '被相続人', value: currentCase.decedent.name || '未入力', href: `decedent` },
    { label: '相続人数', value: `${heirs.length}人`, href: `heirs` },
    { label: '財産総額', value: formatManyen(totalAsset + insurance.totalAmount), href: `assets` },
    { label: '債務・葬式費用', value: formatManyen(totalDebt + funeralCost), href: `assets/debt` },
    { label: '保険金非課税枠', value: formatManyen(insurance.exemption), href: `assets/insurance` },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">案件ダッシュボード</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {summaryItems.map(item => (
          <Link key={item.label} href={`/case/${caseId}/${item.href}`}>
            <Card className="hover:border-blue-300 transition-colors cursor-pointer">
              <CardContent className="py-4">
                <p className="text-sm text-gray-500">{item.label}</p>
                <p className="text-xl font-semibold text-gray-900 mt-1">{item.value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>クイックリンク</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: '相続税計算', href: 'simulation' },
              { label: '贈与シミュレーション', href: 'gift' },
              { label: '遺産分割', href: 'division' },
              { label: '書類出力', href: 'export' },
            ].map(link => (
              <Link
                key={link.href}
                href={`/case/${caseId}/${link.href}`}
                className="block rounded-lg border border-gray-200 p-4 text-center hover:bg-blue-50 hover:border-blue-300 transition-colors"
              >
                <span className="text-sm font-medium text-gray-700">{link.label}</span>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
