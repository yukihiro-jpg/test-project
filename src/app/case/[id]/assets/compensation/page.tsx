'use client';

import React, { useState } from 'react';
import { useCaseStore } from '@/lib/store/case-store';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { CurrencyInput, formatCurrency } from '@/components/common/currency-input';
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';

export default function CompensationPage() {
  const currentCase = useCaseStore(s => s.getCurrentCase());
  const addAsset = useCaseStore(s => s.addAsset);
  const updateAsset = useCaseStore(s => s.updateAsset);
  const removeAsset = useCaseStore(s => s.removeAsset);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!currentCase) return <p className="text-gray-500">案件を選択してください</p>;
  const items = currentCase.assets.compensationPayments;
  const heirs = currentCase.heirs;
  const heirOptions = heirs.map(h => ({ value: h.id, label: h.name || '（未入力）' }));
  const total = items.reduce((sum, item) => sum + item.amount, 0);

  const getHeirName = (heirId: string) => {
    const heir = heirs.find(h => h.id === heirId);
    return heir?.name || '（未選択）';
  };

  const handleAdd = () => {
    const id = addAsset('compensationPayments', {
      payerHeirId: '', receiverHeirId: '', amount: 0, note: '',
    });
    setExpandedId(id);
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

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 border-b">
              <th className="p-2 text-left w-8"></th>
              <th className="p-2 text-left w-8">No</th>
              <th className="p-2 text-left">支払者</th>
              <th className="p-2 text-left">受取者</th>
              <th className="p-2 text-right">金額</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <React.Fragment key={item.id}>
                <tr
                  className={`border-b cursor-pointer hover:bg-blue-50 ${i % 2 === 0 ? '' : 'bg-gray-50'} ${expandedId === item.id ? 'bg-blue-50' : ''}`}
                  onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                >
                  <td className="p-2">
                    {expandedId === item.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </td>
                  <td className="p-2">{i + 1}</td>
                  <td className="p-2">{getHeirName(item.payerHeirId)}</td>
                  <td className="p-2">{getHeirName(item.receiverHeirId)}</td>
                  <td className="p-2 text-right font-medium">{formatCurrency(item.amount)}</td>
                </tr>
                {expandedId === item.id && (
                  <tr><td colSpan={5} className="p-0">
                    <div className="p-4 bg-white border-l-4 border-blue-400 space-y-4">
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
                      <div className="flex justify-end">
                        <Button variant="danger" size="sm" onClick={() => removeAsset('compensationPayments', item.id)}>
                          <Trash2 size={16} className="mr-1" />削除
                        </Button>
                      </div>
                    </div>
                  </td></tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 font-semibold bg-gray-100">
              <td colSpan={4} className="p-2 text-right">合計</td>
              <td className="p-2 text-right">{formatCurrency(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
