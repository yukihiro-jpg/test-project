'use client';

import React, { useState } from 'react';
import { useCaseStore } from '@/lib/store/case-store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CurrencyInput, formatCurrency } from '@/components/common/currency-input';
import { calculateOtherAssetValue } from '@/lib/tax/asset-valuation';
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';

export default function OtherAssetPage() {
  const currentCase = useCaseStore(s => s.getCurrentCase());
  const addAsset = useCaseStore(s => s.addAsset);
  const updateAsset = useCaseStore(s => s.updateAsset);
  const removeAsset = useCaseStore(s => s.removeAsset);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!currentCase) return <p className="text-gray-500">案件を選択してください</p>;
  const items = currentCase.assets.others;
  const total = items.reduce((sum, item) => sum + calculateOtherAssetValue(item), 0);

  const handleAdd = () => {
    const id = addAsset('others', {
      category: '', description: '', quantity: 1, unitPrice: 0, note: '',
    });
    setExpandedId(id);
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">その他財産</h1>
        <Button onClick={handleAdd}><Plus size={18} className="mr-2" />追加</Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 border-b">
              <th className="p-2 text-left w-8"></th>
              <th className="p-2 text-left w-8">No</th>
              <th className="p-2 text-left">分類</th>
              <th className="p-2 text-left">内容</th>
              <th className="p-2 text-right">数量×単価</th>
              <th className="p-2 text-right">評価額</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const value = calculateOtherAssetValue(item);
              return (
                <React.Fragment key={item.id}>
                  <tr
                    className={`border-b cursor-pointer hover:bg-blue-50 ${i % 2 === 0 ? '' : 'bg-gray-50'} ${expandedId === item.id ? 'bg-blue-50' : ''}`}
                    onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  >
                    <td className="p-2">
                      {expandedId === item.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </td>
                    <td className="p-2">{i + 1}</td>
                    <td className="p-2">{item.category || '（未入力）'}</td>
                    <td className="p-2">{item.description || '-'}</td>
                    <td className="p-2 text-right">{item.quantity}×{formatCurrency(item.unitPrice)}</td>
                    <td className="p-2 text-right font-medium">{formatCurrency(value)}</td>
                  </tr>
                  {expandedId === item.id && (
                    <tr><td colSpan={6} className="p-0">
                      <div className="p-4 bg-white border-l-4 border-blue-400 space-y-4">
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
                        <div className="flex justify-end">
                          <Button variant="danger" size="sm" onClick={() => removeAsset('others', item.id)}>
                            <Trash2 size={16} className="mr-1" />削除
                          </Button>
                        </div>
                      </div>
                    </td></tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 font-semibold bg-gray-100">
              <td colSpan={5} className="p-2 text-right">合計</td>
              <td className="p-2 text-right">{formatCurrency(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
