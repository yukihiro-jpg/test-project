'use client';

import { useCaseStore } from '@/lib/store/case-store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CurrencyInput, formatCurrency } from '@/components/common/currency-input';
import { Plus, Trash2 } from 'lucide-react';

export default function DebtPage() {
  const currentCase = useCaseStore(s => s.getCurrentCase());
  const addAsset = useCaseStore(s => s.addAsset);
  const updateAsset = useCaseStore(s => s.updateAsset);
  const removeAsset = useCaseStore(s => s.removeAsset);

  if (!currentCase) return <p className="text-gray-500">案件を選択してください</p>;
  const items = currentCase.assets.debts;

  const handleAdd = () => {
    addAsset('debts', { creditor: '', description: '', amount: 0, note: '' });
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">債務</h1>
        <Button onClick={handleAdd}><Plus size={18} className="mr-2" />追加</Button>
      </div>

      {items.map((item, i) => (
        <Card key={item.id}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>債務 {i + 1}</CardTitle>
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold text-red-600">▲{formatCurrency(item.amount)}</span>
              <Button variant="danger" size="sm" onClick={() => removeAsset('debts', item.id)}>
                <Trash2 size={16} />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="債権者" value={item.creditor}
                onChange={e => updateAsset('debts', item.id, { creditor: e.target.value })} />
              <Input label="内容" value={item.description}
                onChange={e => updateAsset('debts', item.id, { description: e.target.value })} />
            </div>
            <CurrencyInput label="金額" value={item.amount}
              onChange={v => updateAsset('debts', item.id, { amount: v })} />
            <Input label="備考" value={item.note}
              onChange={e => updateAsset('debts', item.id, { note: e.target.value })} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
