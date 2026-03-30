'use client';

import { useCaseStore } from '@/lib/store/case-store';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CurrencyInput, formatCurrency } from '@/components/common/currency-input';
import { Plus, Trash2 } from 'lucide-react';

export default function CompensationPage() {
  const currentCase = useCaseStore(s => s.getCurrentCase());
  const addAsset = useCaseStore(s => s.addAsset);
  const updateAsset = useCaseStore(s => s.updateAsset);
  const removeAsset = useCaseStore(s => s.removeAsset);

  if (!currentCase) return <p className="text-gray-500">案件を選択してください</p>;
  const items = currentCase.assets.compensationPayments;
  const heirs = currentCase.heirs;
  const heirOptions = heirs.map(h => ({ value: h.id, label: h.name || '（未入力）' }));

  const handleAdd = () => {
    addAsset('compensationPayments', {
      payerHeirId: '', receiverHeirId: '', amount: 0, note: '',
    });
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">代償分割金</h1>
        <Button onClick={handleAdd}><Plus size={18} className="mr-2" />追加</Button>
      </div>

      <Card className="bg-yellow-50 border-yellow-200">
        <CardContent className="py-4 text-sm text-gray-700">
          代償分割とは、特定の相続人が財産を取得する代わりに、他の相続人に金銭を支払う方法です。
          支払者の課税価格から減額、受取者の課税価格に加算されます。
        </CardContent>
      </Card>

      {items.map((item, i) => (
        <Card key={item.id}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>代償分割金 {i + 1}</CardTitle>
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold text-blue-700">{formatCurrency(item.amount)}</span>
              <Button variant="danger" size="sm" onClick={() => removeAsset('compensationPayments', item.id)}>
                <Trash2 size={16} />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Select label="支払者" value={item.payerHeirId}
                onChange={e => updateAsset('compensationPayments', item.id, { payerHeirId: e.target.value })}
                options={heirOptions} />
              <Select label="受取者" value={item.receiverHeirId}
                onChange={e => updateAsset('compensationPayments', item.id, { receiverHeirId: e.target.value })}
                options={heirOptions} />
            </div>
            <CurrencyInput label="金額" value={item.amount}
              onChange={v => updateAsset('compensationPayments', item.id, { amount: v })} />
            <Input label="備考" value={item.note}
              onChange={e => updateAsset('compensationPayments', item.id, { note: e.target.value })} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
