'use client';

import { useState, useEffect } from 'react';
import { useCaseStore } from '@/lib/store/case-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CurrencyInput, formatCurrency, formatManyen } from '@/components/common/currency-input';
import { calculateTotalAssetValue } from '@/lib/tax/inheritance-tax';
import { calculateInsuranceExemption, calculateDeductibleFuneralExpenses } from '@/lib/tax/asset-valuation';
import { calculateLegalShareRatios, countLegalHeirs } from '@/lib/tax/deductions';
import { RELATIONSHIP_LABELS } from '@/types';
import type { DivisionEntry } from '@/types';

export default function DivisionPage() {
  const currentCase = useCaseStore(s => s.getCurrentCase());
  const updateDivision = useCaseStore(s => s.updateDivision);

  const [heirAmounts, setHeirAmounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!currentCase) return;
    const amounts: Record<string, number> = {};
    for (const entry of currentCase.division.entries) {
      amounts[entry.heirId] = (amounts[entry.heirId] || 0) + (entry.amount || 0);
    }
    // 初期値がなければ法定相続分で設定
    if (Object.keys(amounts).length === 0) {
      const { assets, heirs } = currentCase;
      const total = calculateNetValue(currentCase);
      const ratios = calculateLegalShareRatios(heirs);
      heirs.forEach(h => {
        amounts[h.id] = Math.floor(total * (ratios.get(h.id) || 0));
      });
    }
    setHeirAmounts(amounts);
  }, [currentCase?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!currentCase) return <p className="text-gray-500">案件を選択してください</p>;

  const { heirs, assets } = currentCase;
  const netValue = calculateNetValue(currentCase);
  const totalAllocated = Object.values(heirAmounts).reduce((s, v) => s + v, 0);
  const remaining = netValue - totalAllocated;

  function calculateNetValue(c: typeof currentCase) {
    if (!c) return 0;
    const totalAsset = calculateTotalAssetValue(c.assets);
    const legalHeirCount = countLegalHeirs(c.heirs);
    const insurance = calculateInsuranceExemption(c.assets.insurances, legalHeirCount);
    const totalDebt = c.assets.debts.reduce((s, d) => s + d.amount, 0);
    const funeral = calculateDeductibleFuneralExpenses(c.assets.funeralExpenses);
    return totalAsset + insurance.taxableAmount - totalDebt - funeral;
  }

  const handleSave = () => {
    const entries: DivisionEntry[] = Object.entries(heirAmounts).map(([heirId, amount]) => ({
      heirId,
      assetId: 'total',
      assetType: 'lands' as const,
      ratio: netValue > 0 ? amount / netValue : 0,
      amount,
    }));
    updateDivision(entries);
  };

  const handleLegalShare = () => {
    const ratios = calculateLegalShareRatios(heirs);
    const amounts: Record<string, number> = {};
    heirs.forEach(h => {
      amounts[h.id] = Math.floor(netValue * (ratios.get(h.id) || 0));
    });
    setHeirAmounts(amounts);
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">遺産分割</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleLegalShare}>法定相続分で設定</Button>
          <Button onClick={handleSave}>保存</Button>
        </div>
      </div>

      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="py-4">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-600">正味遺産額</p>
              <p className="font-semibold">{formatManyen(netValue)}</p>
            </div>
            <div>
              <p className="text-gray-600">分割済み</p>
              <p className="font-semibold">{formatManyen(totalAllocated)}</p>
            </div>
            <div>
              <p className="text-gray-600">未分割</p>
              <p className={`font-semibold ${remaining !== 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatManyen(remaining)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {heirs.map(heir => (
        <Card key={heir.id}>
          <CardHeader>
            <CardTitle>
              {heir.name || '（未入力）'}
              <span className="ml-2 text-sm font-normal text-gray-500">
                （{RELATIONSHIP_LABELS[heir.relationship]}）
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <CurrencyInput
              label="取得額"
              value={heirAmounts[heir.id] || 0}
              onChange={v => setHeirAmounts(prev => ({ ...prev, [heir.id]: v }))}
            />
            {netValue > 0 && (
              <p className="text-sm text-gray-500">
                割合: {((heirAmounts[heir.id] || 0) / netValue * 100).toFixed(1)}%
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
