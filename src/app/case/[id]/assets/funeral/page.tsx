'use client';

import React, { useState } from 'react';
import { useCaseStore } from '@/lib/store/case-store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { CurrencyInput, formatCurrency, formatManyen } from '@/components/common/currency-input';
import { calculateDeductibleFuneralExpenses } from '@/lib/tax/asset-valuation';
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';

export default function FuneralPage() {
  const currentCase = useCaseStore(s => s.getCurrentCase());
  const addAsset = useCaseStore(s => s.addAsset);
  const updateAsset = useCaseStore(s => s.updateAsset);
  const removeAsset = useCaseStore(s => s.removeAsset);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!currentCase) return <p className="text-gray-500">案件を選択してください</p>;
  const items = currentCase.assets.funeralExpenses;
  const deductibleTotal = calculateDeductibleFuneralExpenses(items);
  const nonDeductibleTotal = items.filter(e => !e.isDeductible).reduce((s, e) => s + e.amount, 0);
  const total = items.reduce((sum, item) => sum + item.amount, 0);

  const handleAdd = () => {
    const id = addAsset('funeralExpenses', { description: '', amount: 0, isDeductible: true, note: '' });
    setExpandedId(id);
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

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 border-b">
              <th className="p-2 text-left w-8"></th>
              <th className="p-2 text-left w-8">No</th>
              <th className="p-2 text-left">内容</th>
              <th className="p-2 text-right">金額</th>
              <th className="p-2 text-center">控除対象</th>
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
                  <td className="p-2">{item.description || '（未入力）'}</td>
                  <td className="p-2 text-right font-medium">{formatCurrency(item.amount)}</td>
                  <td className="p-2 text-center">{item.isDeductible ? '○' : '×'}</td>
                </tr>
                {expandedId === item.id && (
                  <tr><td colSpan={5} className="p-0">
                    <div className="p-4 bg-white border-l-4 border-blue-400 space-y-4">
                      <Input label="内容" value={item.description}
                        onChange={e => updateAsset('funeralExpenses', item.id, { description: e.target.value })}
                        placeholder="通夜・告別式費用、火葬費用等" />
                      <CurrencyInput label="金額" value={item.amount}
                        onChange={v => updateAsset('funeralExpenses', item.id, { amount: v })} />
                      <Checkbox label="控除対象" checked={item.isDeductible}
                        onChange={e => updateAsset('funeralExpenses', item.id, { isDeductible: (e.target as HTMLInputElement).checked })} />
                      <Input label="備考" value={item.note}
                        onChange={e => updateAsset('funeralExpenses', item.id, { note: e.target.value })} />
                      <div className="flex justify-end">
                        <Button variant="danger" size="sm" onClick={() => removeAsset('funeralExpenses', item.id)}>
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
              <td colSpan={3} className="p-2 text-right">合計</td>
              <td className="p-2 text-right">{formatCurrency(total)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
