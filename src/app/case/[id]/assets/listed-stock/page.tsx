'use client';

import React, { useState } from 'react';
import { useCaseStore } from '@/lib/store/case-store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CurrencyInput, formatCurrency } from '@/components/common/currency-input';
import { calculateListedStockValue } from '@/lib/tax/asset-valuation';
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';

export default function ListedStockPage() {
  const currentCase = useCaseStore(s => s.getCurrentCase());
  const addAsset = useCaseStore(s => s.addAsset);
  const updateAsset = useCaseStore(s => s.updateAsset);
  const removeAsset = useCaseStore(s => s.removeAsset);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!currentCase) return <p className="text-gray-500">案件を選択してください</p>;
  const items = currentCase.assets.listedStocks;
  const total = items.reduce((sum, item) => sum + calculateListedStockValue(item).totalValue, 0);

  const handleAdd = () => {
    const id = addAsset('listedStocks', {
      companyName: '', stockCode: '', shares: 0,
      deathDatePrice: 0, monthlyAvgDeath: 0,
      monthlyAvgPrev1: 0, monthlyAvgPrev2: 0, note: '',
    });
    setExpandedId(id);
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">上場株式</h1>
        <Button onClick={handleAdd}><Plus size={18} className="mr-2" />追加</Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 border-b">
              <th className="p-2 text-left w-8"></th>
              <th className="p-2 text-left w-8">No</th>
              <th className="p-2 text-left">銘柄</th>
              <th className="p-2 text-right">株数</th>
              <th className="p-2 text-right">採用単価</th>
              <th className="p-2 text-right">評価額</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const { selectedPrice, totalValue } = calculateListedStockValue(item);
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
                    <td className="p-2 text-right">{item.shares ? `${item.shares}株` : '-'}</td>
                    <td className="p-2 text-right">{formatCurrency(selectedPrice)}</td>
                    <td className="p-2 text-right font-medium">{formatCurrency(totalValue)}</td>
                  </tr>
                  {expandedId === item.id && (
                    <tr><td colSpan={6} className="p-0">
                      <div className="p-4 bg-white border-l-4 border-blue-400 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <Input label="銘柄" value={item.companyName}
                            onChange={e => updateAsset('listedStocks', item.id, { companyName: e.target.value })} />
                          <Input label="証券コード" value={item.stockCode}
                            onChange={e => updateAsset('listedStocks', item.id, { stockCode: e.target.value })} />
                        </div>
                        <Input label="株数" type="number" value={item.shares || ''}
                          onChange={e => updateAsset('listedStocks', item.id, { shares: Number(e.target.value) })} suffix="株" />

                        <div className="border rounded-md p-4 space-y-3 bg-gray-50">
                          <h4 className="text-sm font-medium text-gray-700">4つの価格（最低額を自動選択）</h4>
                          <CurrencyInput label="課税時期の終値" value={item.deathDatePrice}
                            onChange={v => updateAsset('listedStocks', item.id, { deathDatePrice: v })} />
                          <CurrencyInput label="課税時期の月平均" value={item.monthlyAvgDeath}
                            onChange={v => updateAsset('listedStocks', item.id, { monthlyAvgDeath: v })} />
                          <CurrencyInput label="前月の月平均" value={item.monthlyAvgPrev1}
                            onChange={v => updateAsset('listedStocks', item.id, { monthlyAvgPrev1: v })} />
                          <CurrencyInput label="前々月の月平均" value={item.monthlyAvgPrev2}
                            onChange={v => updateAsset('listedStocks', item.id, { monthlyAvgPrev2: v })} />
                          {selectedPrice > 0 && (
                            <div className="bg-blue-50 p-2 rounded text-sm">
                              採用単価: <span className="font-semibold text-blue-700">{formatCurrency(selectedPrice)}</span>
                            </div>
                          )}
                        </div>
                        <Input label="備考" value={item.note}
                          onChange={e => updateAsset('listedStocks', item.id, { note: e.target.value })} />
                        <div className="flex justify-end">
                          <Button variant="danger" size="sm" onClick={() => removeAsset('listedStocks', item.id)}>
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
