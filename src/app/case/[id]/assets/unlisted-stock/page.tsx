'use client';

import { useCaseStore } from '@/lib/store/case-store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CurrencyInput, formatCurrency } from '@/components/common/currency-input';
import { calculateUnlistedStockValue } from '@/lib/tax/asset-valuation';
import { Plus, Trash2 } from 'lucide-react';

export default function UnlistedStockPage() {
  const currentCase = useCaseStore(s => s.getCurrentCase());
  const addAsset = useCaseStore(s => s.addAsset);
  const updateAsset = useCaseStore(s => s.updateAsset);
  const removeAsset = useCaseStore(s => s.removeAsset);

  if (!currentCase) return <p className="text-gray-500">案件を選択してください</p>;
  const items = currentCase.assets.unlistedStocks;

  const handleAdd = () => {
    addAsset('unlistedStocks', {
      companyName: '', sharesOwned: 0, totalShares: 0, pricePerShare: 0, note: '',
    });
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">非上場株式</h1>
        <Button onClick={handleAdd}><Plus size={18} className="mr-2" />追加</Button>
      </div>

      {items.map((item, i) => {
        const value = calculateUnlistedStockValue(item);
        return (
          <Card key={item.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>非上場株式 {i + 1}</CardTitle>
              <div className="flex items-center gap-3">
                <span className="text-lg font-semibold text-blue-700">{formatCurrency(value)}</span>
                <Button variant="danger" size="sm" onClick={() => removeAsset('unlistedStocks', item.id)}>
                  <Trash2 size={16} />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input label="会社名" value={item.companyName}
                onChange={e => updateAsset('unlistedStocks', item.id, { companyName: e.target.value })} />
              <div className="grid grid-cols-2 gap-4">
                <Input label="所有株数" type="number" value={item.sharesOwned || ''} suffix="株"
                  onChange={e => updateAsset('unlistedStocks', item.id, { sharesOwned: Number(e.target.value) })} />
                <Input label="発行済株式総数" type="number" value={item.totalShares || ''} suffix="株"
                  onChange={e => updateAsset('unlistedStocks', item.id, { totalShares: Number(e.target.value) })} />
              </div>
              <CurrencyInput label="1株あたり評価額" value={item.pricePerShare}
                onChange={v => updateAsset('unlistedStocks', item.id, { pricePerShare: v })} />
              <Input label="備考（評価方法・会社規模区分等）" value={item.note}
                onChange={e => updateAsset('unlistedStocks', item.id, { note: e.target.value })}
                placeholder="類似業種比準方式、大会社等" />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
