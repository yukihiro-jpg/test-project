'use client';

import { useCaseStore } from '@/lib/store/case-store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CurrencyInput, formatCurrency } from '@/components/common/currency-input';
import { calculateListedStockValue } from '@/lib/tax/asset-valuation';
import { Plus, Trash2 } from 'lucide-react';

export default function ListedStockPage() {
  const currentCase = useCaseStore(s => s.getCurrentCase());
  const addAsset = useCaseStore(s => s.addAsset);
  const updateAsset = useCaseStore(s => s.updateAsset);
  const removeAsset = useCaseStore(s => s.removeAsset);

  if (!currentCase) return <p className="text-gray-500">案件を選択してください</p>;
  const items = currentCase.assets.listedStocks;

  const handleAdd = () => {
    addAsset('listedStocks', {
      companyName: '', stockCode: '', shares: 0,
      deathDatePrice: 0, monthlyAvgDeath: 0,
      monthlyAvgPrev1: 0, monthlyAvgPrev2: 0, note: '',
    });
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">上場株式</h1>
        <Button onClick={handleAdd}><Plus size={18} className="mr-2" />追加</Button>
      </div>

      {items.map((item, i) => {
        const { selectedPrice, totalValue } = calculateListedStockValue(item);
        return (
          <Card key={item.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>上場株式 {i + 1}</CardTitle>
              <div className="flex items-center gap-3">
                <span className="text-lg font-semibold text-blue-700">{formatCurrency(totalValue)}</span>
                <Button variant="danger" size="sm" onClick={() => removeAsset('listedStocks', item.id)}>
                  <Trash2 size={16} />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input label="銘柄" value={item.companyName}
                  onChange={e => updateAsset('listedStocks', item.id, { companyName: e.target.value })} />
                <Input label="証券コード" value={item.stockCode}
                  onChange={e => updateAsset('listedStocks', item.id, { stockCode: e.target.value })} />
              </div>
              <Input label="株数" type="number" value={item.shares || ''}
                onChange={e => updateAsset('listedStocks', item.id, { shares: Number(e.target.value) })} suffix="株" />

              <div className="border rounded-md p-4 space-y-3 bg-gray-50">
                <h4 className="text-sm font-medium text-gray-700">4つの価格（最低額を自動選択）</h4>
                <CurrencyInput label="課税時期の終値" value={item.deathDatePrice}
                  onChange={v => updateAsset('listedStocks', item.id, { deathDatePrice: v })} />
                <CurrencyInput label="課税時期の月平均" value={item.monthlyAvgDeath}
                  onChange={v => updateAsset('listedStocks', item.id, { monthlyAvgDeath: v })} />
                <CurrencyInput label="前月の月平均" value={item.monthlyAvgPrev1}
                  onChange={v => updateAsset('listedStocks', item.id, { monthlyAvgPrev1: v })} />
                <CurrencyInput label="前々月の月平均" value={item.monthlyAvgPrev2}
                  onChange={v => updateAsset('listedStocks', item.id, { monthlyAvgPrev2: v })} />
                {selectedPrice > 0 && (
                  <div className="bg-blue-50 p-2 rounded text-sm">
                    採用単価: <span className="font-semibold text-blue-700">{formatCurrency(selectedPrice)}</span>
                  </div>
                )}
              </div>
              <Input label="備考" value={item.note}
                onChange={e => updateAsset('listedStocks', item.id, { note: e.target.value })} />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
