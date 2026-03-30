'use client';

import { useState, useMemo } from 'react';
import { useCaseStore } from '@/lib/store/case-store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CurrencyInput, formatCurrency, formatManyen } from '@/components/common/currency-input';
import { calculateInheritanceTax } from '@/lib/tax/inheritance-tax';
import { simulateGiftTax } from '@/lib/tax/gift-tax';
import { RELATIONSHIP_LABELS, type GiftPlanEntry, type GiftTaxSystem } from '@/types';
import { Plus, Trash2, Calculator } from 'lucide-react';

export default function GiftPage() {
  const currentCase = useCaseStore(s => s.getCurrentCase());
  const updateGiftPlan = useCaseStore(s => s.updateGiftPlan);

  const [entries, setEntries] = useState<GiftPlanEntry[]>(
    currentCase?.giftSimulation?.entries || []
  );
  const [showResult, setShowResult] = useState(false);

  if (!currentCase) return <p className="text-gray-500">案件を選択してください</p>;
  if (currentCase.heirs.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">相続人を登録してからシミュレーションを実行してください</p>
      </div>
    );
  }

  const heirs = currentCase.heirs;
  const heirOptions = heirs.map(h => ({ value: h.id, label: `${h.name || '（未入力）'}（${RELATIONSHIP_LABELS[h.relationship]}）` }));

  const currentYear = new Date(currentCase.referenceDate).getFullYear() || new Date().getFullYear();

  const handleAdd = () => {
    setEntries(prev => [...prev, {
      heirId: heirs[0]?.id || '',
      annualAmount: 1_100_000,
      years: 10,
      startYear: currentYear,
      taxSystem: 'calendar' as GiftTaxSystem,
    }]);
    setShowResult(false);
  };

  const handleRemove = (index: number) => {
    setEntries(prev => prev.filter((_, i) => i !== index));
    setShowResult(false);
  };

  const handleUpdate = (index: number, updates: Partial<GiftPlanEntry>) => {
    setEntries(prev => prev.map((e, i) => i === index ? { ...e, ...updates } : e));
    setShowResult(false);
  };

  const handleSimulate = () => {
    updateGiftPlan({ entries });
    setShowResult(true);
  };

  const originalTaxResult = useMemo(() => calculateInheritanceTax(currentCase), [currentCase]);
  const originalTotalTax = originalTaxResult.heirTaxDetails.reduce((s, h) => s + h.finalTax, 0);

  const giftResult = useMemo(() => {
    if (!showResult || entries.length === 0) return null;
    return simulateGiftTax(
      { entries },
      currentCase.heirs,
      currentCase.referenceDate,
      originalTaxResult
    );
  }, [showResult, entries, currentCase.heirs, currentCase.referenceDate, originalTaxResult]);

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">贈与シミュレーション</h1>
        <div className="flex gap-2">
          <Button onClick={handleAdd} variant="secondary">
            <Plus size={18} className="mr-2" />贈与計画追加
          </Button>
          <Button onClick={handleSimulate} disabled={entries.length === 0}>
            <Calculator size={18} className="mr-2" />シミュレーション実行
          </Button>
        </div>
      </div>

      <Card className="bg-gray-50">
        <CardContent className="py-4 text-sm">
          <p>現在の相続税（贈与なし）: <span className="font-semibold text-blue-700">{formatCurrency(originalTotalTax)}</span></p>
        </CardContent>
      </Card>

      {/* 贈与計画入力 */}
      {entries.map((entry, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>贈与計画 {i + 1}</CardTitle>
            <Button variant="danger" size="sm" onClick={() => handleRemove(i)}>
              <Trash2 size={16} />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Select label="受贈者" value={entry.heirId}
                onChange={e => handleUpdate(i, { heirId: e.target.value })}
                options={heirOptions} />
              <Select label="課税方式" value={entry.taxSystem}
                onChange={e => handleUpdate(i, { taxSystem: e.target.value as GiftTaxSystem })}
                options={[
                  { value: 'calendar', label: '暦年課税' },
                  { value: 'settlement', label: '相続時精算課税' },
                ]} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <CurrencyInput label="年間贈与額" value={entry.annualAmount}
                onChange={v => handleUpdate(i, { annualAmount: v })} />
              <Input label="贈与年数" type="number" value={entry.years}
                onChange={e => handleUpdate(i, { years: Number(e.target.value) })} suffix="年" />
              <Input label="開始年" type="number" value={entry.startYear}
                onChange={e => handleUpdate(i, { startYear: Number(e.target.value) })} suffix="年" />
            </div>
            {entry.taxSystem === 'settlement' && (
              <p className="text-xs text-gray-500">
                ※ 相続時精算課税：年間110万円の基礎控除（2024年改正後）＋累計2,500万円の特別控除、超過分は一律20%
              </p>
            )}
          </CardContent>
        </Card>
      ))}

      {/* シミュレーション結果 */}
      {giftResult && (
        <>
          <Card className="border-blue-300 bg-blue-50">
            <CardHeader><CardTitle>シミュレーション結果</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">贈与税合計</p>
                  <p className="font-semibold text-lg">{formatManyen(giftResult.totalGiftTax)}</p>
                </div>
                <div>
                  <p className="text-gray-600">贈与後の相続税（推定）</p>
                  <p className="font-semibold text-lg">{formatManyen(giftResult.inheritanceTaxWithGift)}</p>
                </div>
                <div>
                  <p className="text-gray-600">税負担合計</p>
                  <p className="font-semibold text-lg">{formatManyen(giftResult.totalTaxBurden)}</p>
                </div>
                <div>
                  <p className="text-gray-600">節税効果</p>
                  <p className={`font-semibold text-lg ${giftResult.taxSaving > 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {giftResult.taxSaving > 0 ? '▲' : ''}{formatManyen(giftResult.taxSaving)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>年次贈与税明細</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="py-2 px-3 text-left">年</th>
                      <th className="py-2 px-3 text-left">受贈者</th>
                      <th className="py-2 px-3 text-left">方式</th>
                      <th className="py-2 px-3 text-right">贈与額</th>
                      <th className="py-2 px-3 text-right">贈与税</th>
                      <th className="py-2 px-3 text-right">累計贈与額</th>
                      <th className="py-2 px-3 text-right">累計贈与税</th>
                    </tr>
                  </thead>
                  <tbody>
                    {giftResult.entries.map((e, i) => {
                      const heir = heirs.find(h => h.id === e.heirId);
                      return (
                        <tr key={i} className="border-b hover:bg-gray-50">
                          <td className="py-2 px-3">{e.year}</td>
                          <td className="py-2 px-3">{heir?.name || ''}</td>
                          <td className="py-2 px-3">{e.taxSystem === 'calendar' ? '暦年' : '精算'}</td>
                          <td className="py-2 px-3 text-right font-mono">{formatManyen(e.giftAmount)}</td>
                          <td className="py-2 px-3 text-right font-mono">{formatCurrency(e.giftTax)}</td>
                          <td className="py-2 px-3 text-right font-mono">{formatManyen(e.cumulativeGift)}</td>
                          <td className="py-2 px-3 text-right font-mono">{formatCurrency(e.cumulativeGiftTax)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
