'use client';

import { useCaseStore } from '@/lib/store/case-store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CurrencyInput, formatCurrency } from '@/components/common/currency-input';
import { calculateOtherAssetValue } from '@/lib/tax/asset-valuation';
import { Plus, Trash2 } from 'lucide-react';

export default function OtherAssetPage() {
  const currentCase = useCaseStore(s => s.getCurrentCase());
  const addAsset = useCaseStore(s => s.addAsset);
  const updateAsset = useCaseStore(s => s.updateAsset);
  const removeAsset = useCaseStore(s => s.removeAsset);

  if (!currentCase) return <p className="text-gray-500">案件を選択してください</p>;
  const items = currentCase.assets.others;

  const handleAdd = () => {
    addAsset('others', {
      category: '', description: '', quantity: 1, unitPrice: 0, note: '',
    });
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">その他財産</h1>
        <Button onClick={handleAdd}><Plus size={18} className="mr-2" />追加</Button>
      </div>

      {items.map((item, i) => {
        const value = calculateOtherAssetValue(item);
        return (
          <Card key={item.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>その他財産 {i + 1}</CardTitle>
              <div className="flex items-center gap-3">
                <span className="text-lg font-semibold text-blue-700">{formatCurrency(value)}</span>
                <Button variant="danger" size="sm" onClick={() => removeAsset('others', item.id)}>
                  <Trash2 size={16} />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input label="分類" value={item.category} placeholder="家庭用財産/自動車/退職金等"
                  onChange={e => updateAsset('others', item.id, { category: e.target.value })} />
                <Input label="内容" value={item.description}
                  onChange={e => updateAsset('others', item.id, { description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="数量" type="number" value={item.quantity || ''}
                  onChange={e => updateAsset('others', item.id, { quantity: Number(e.target.value) })} />
                <CurrencyInput label="単価" value={item.unitPrice}
                  onChange={v => updateAsset('others', item.id, { unitPrice: v })} />
              </div>
              <Input label="備考" value={item.note}
                onChange={e => updateAsset('others', item.id, { note: e.target.value })} />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
