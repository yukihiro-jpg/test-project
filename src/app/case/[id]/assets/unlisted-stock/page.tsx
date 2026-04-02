'use client';

import React, { useState } from 'react';
import { useCaseStore } from '@/lib/store/case-store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CurrencyInput, formatCurrency } from '@/components/common/currency-input';
import { calculateUnlistedStockValue } from '@/lib/tax/asset-valuation';
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';

export default function UnlistedStockPage() {
  const currentCase = useCaseStore(s => s.getCurrentCase());
  const addAsset = useCaseStore(s => s.addAsset);
  const updateAsset = useCaseStore(s => s.updateAsset);
  const removeAsset = useCaseStore(s => s.removeAsset);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!currentCase) return <p className="text-gray-500">案件を選択してください</p>;
  const items = currentCase.assets.unlistedStocks;
  const total = items.reduce((sum, item) => sum + calculateUnlistedStockValue(item), 0);

  const handleAdd = () => {
    const id = addAsset('unlistedStocks', {
      companyName: '', sharesOwned: 0, totalShares: 0, pricePerShare: 0, note: '',
    });
    setExpandedId(id);
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">非上場株式</h1>
        <Button onClick={handleAdd}><Plus size={18} className="mr-2" />追加</Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 border-b">
              <th className="p-2 text-left w-8"></th>
              <th className="p-2 text-left w-8">No</th>
              <th className="p-2 text-left">会社名</th>
              <th className="p-2 text-right">所有株数</th>
              <th className="p-2 text-right">1株評価額</th>
              <th className="p-2 text-right">評価額</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const value = calculateUnlistedStockValue(item);
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
                    <td className="p-2">{item.companyName || '（未入力）'}</td>
                    <td className="p-2 text-right">{item.sharesOwned ? `${item.sharesOwned}株` : '-'}</td>
                    <td className="p-2 text-right">{formatCurrency(item.pricePerShare)}</td>
                    <td className="p-2 text-right font-medium">{formatCurrency(value)}</td>
                  </tr>
                  {expandedId === item.id && (
                    <tr><td colSpan={6} className="p-0">
                      <div className="p-4 bg-white border-l-4 border-blue-400 space-y-4">
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
                        <div className="flex justify-end">
                          <Button variant="danger" size="sm" onClick={() => removeAsset('unlistedStocks', item.id)}>
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
