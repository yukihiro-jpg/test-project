'use client';

import { useCaseStore } from '@/lib/store/case-store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CurrencyInput, formatCurrency, formatManyen } from '@/components/common/currency-input';
import { calculateDeductibleFuneralExpenses } from '@/lib/tax/asset-valuation';
import { Plus, Trash2 } from 'lucide-react';

export default function FuneralPage() {
  const currentCase = useCaseStore(s => s.getCurrentCase());
  const addAsset = useCaseStore(s => s.addAsset);
  const updateAsset = useCaseStore(s => s.updateAsset);
  const removeAsset = useCaseStore(s => s.removeAsset);

  if (!currentCase) return <p className="text-gray-500">案件を選択してください</p>;
  const items = currentCase.assets.funeralExpenses;
  const deductibleTotal = calculateDeductibleFuneralExpenses(items);
  const nonDeductibleTotal = items.filter(e => !e.isDeductible).reduce((s, e) => s + e.amount, 0);

  const handleAdd = () => {
    addAsset('funeralExpenses', { description: '', amount: 0, isDeductible: true, note: '' });
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">葬式費用</h1>
        <Button onClick={handleAdd}><Plus size={18} className="mr-2" />追加</Button>
      </div>

      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="py-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600">控除対象合計</p>
              <p className="font-semibold text-green-700">▲{formatManyen(deductibleTotal)}</p>
            </div>
            <div>
              <p className="text-gray-600">控除対象外合計</p>
              <p className="font-semibold text-gray-500">{formatManyen(nonDeductibleTotal)}</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            ※ 香典返し、墓地・仏壇の購入費用等は控除対象外です
          </p>
        </CardContent>
      </Card>

      {items.map((item, i) => (
        <Card key={item.id}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>葬式費用 {i + 1}</CardTitle>
            <div className="flex items-center gap-3">
              <span className={`text-lg font-semibold ${item.isDeductible ? 'text-green-700' : 'text-gray-500'}`}>
                {item.isDeductible ? '▲' : ''}{formatCurrency(item.amount)}
              </span>
              <Button variant="danger" size="sm" onClick={() => removeAsset('funeralExpenses', item.id)}>
                <Trash2 size={16} />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input label="内容" value={item.description}
              onChange={e => updateAsset('funeralExpenses', item.id, { description: e.target.value })}
              placeholder="通夜・告別式費用、火葬費用等" />
            <CurrencyInput label="金額" value={item.amount}
              onChange={v => updateAsset('funeralExpenses', item.id, { amount: v })} />
            <Checkbox label="控除対象" checked={item.isDeductible}
              onChange={e => updateAsset('funeralExpenses', item.id, { isDeductible: (e.target as HTMLInputElement).checked })} />
            <Input label="備考" value={item.note}
              onChange={e => updateAsset('funeralExpenses', item.id, { note: e.target.value })} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
