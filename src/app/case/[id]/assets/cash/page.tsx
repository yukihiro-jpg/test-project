'use client';

import { useCaseStore } from '@/lib/store/case-store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CurrencyInput, formatCurrency } from '@/components/common/currency-input';
import { calculateCashValue } from '@/lib/tax/asset-valuation';
import { Plus, Trash2 } from 'lucide-react';

export default function CashPage() {
  const currentCase = useCaseStore(s => s.getCurrentCase());
  const addAsset = useCaseStore(s => s.addAsset);
  const updateAsset = useCaseStore(s => s.updateAsset);
  const removeAsset = useCaseStore(s => s.removeAsset);

  if (!currentCase) return <p className="text-gray-500">案件を選択してください</p>;
  const items = currentCase.assets.cashDeposits;

  const handleAdd = () => {
    addAsset('cashDeposits', {
      institutionName: '', accountType: '普通預金',
      balance: 0, accruedInterest: 0, note: '',
    });
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">現金預金</h1>
        <Button onClick={handleAdd}><Plus size={18} className="mr-2" />追加</Button>
      </div>

      {items.map((item, i) => {
        const value = calculateCashValue(item);
        return (
          <Card key={item.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>現金預金 {i + 1}</CardTitle>
              <div className="flex items-center gap-3">
                <span className="text-lg font-semibold text-blue-700">{formatCurrency(value)}</span>
                <Button variant="danger" size="sm" onClick={() => removeAsset('cashDeposits', item.id)}>
                  <Trash2 size={16} />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input label="金融機関名" value={item.institutionName}
                  onChange={e => updateAsset('cashDeposits', item.id, { institutionName: e.target.value })} />
                <Input label="口座種別" value={item.accountType} placeholder="普通預金/定期預金等"
                  onChange={e => updateAsset('cashDeposits', item.id, { accountType: e.target.value })} />
              </div>
              <CurrencyInput label="残高" value={item.balance}
                onChange={v => updateAsset('cashDeposits', item.id, { balance: v })} />
              <CurrencyInput label="既経過利息" value={item.accruedInterest}
                onChange={v => updateAsset('cashDeposits', item.id, { accruedInterest: v })} />
              <Input label="備考" value={item.note}
                onChange={e => updateAsset('cashDeposits', item.id, { note: e.target.value })} />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
