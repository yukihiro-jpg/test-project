'use client';

import React from 'react';
import { useCaseStore } from '@/lib/store/case-store';
import { Button } from '@/components/ui/button';
import { calculateListedStockValue } from '@/lib/tax/asset-valuation';
import { Plus, Trash2 } from 'lucide-react';

const inputClass =
  'w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500';

function formatNum(n: number | undefined | null): string {
  if (!n) return '';
  return n.toLocaleString('ja-JP');
}

function parseNum(s: string): number {
  return Number(s.replace(/,/g, '')) || 0;
}

export default function ListedStockPage() {
  const currentCase = useCaseStore(s => s.getCurrentCase());
  const addAsset = useCaseStore(s => s.addAsset);
  const updateAsset = useCaseStore(s => s.updateAsset);
  const removeAsset = useCaseStore(s => s.removeAsset);

  if (!currentCase) return <p className="text-gray-500">案件を選択してください</p>;
  const items = currentCase.assets.listedStocks;
  const total = items.reduce((sum, item) => sum + calculateListedStockValue(item).totalValue, 0);

  const handleAdd = () => {
    addAsset('listedStocks', {
      companyName: '', stockCode: '', shares: 0,
      deathDatePrice: 0, monthlyAvgDeath: 0,
      monthlyAvgPrev1: 0, monthlyAvgPrev2: 0, note: '',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">上場株式</h1>
        <Button onClick={handleAdd}><Plus size={18} className="mr-2" />追加</Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100 border-b">
              <th className="p-2 text-center border border-gray-300">No</th>
              <th className="p-2 text-center border border-gray-300">銘柄</th>
              <th className="p-2 text-center border border-gray-300">証券コード</th>
              <th className="p-2 text-center border border-gray-300">株数</th>
              <th className="p-2 text-center border border-gray-300">終値</th>
              <th className="p-2 text-center border border-gray-300">月平均(当月)</th>
              <th className="p-2 text-center border border-gray-300">月平均(前月)</th>
              <th className="p-2 text-center border border-gray-300">月平均(前々月)</th>
              <th className="p-2 text-center border border-gray-300">採用単価</th>
              <th className="p-2 text-center border border-gray-300">評価額</th>
              <th className="p-2 text-center border border-gray-300">備考</th>
              <th className="p-2 text-center border border-gray-300 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const { selectedPrice, totalValue } = calculateListedStockValue(item);
              return (
                <tr key={item.id} className={i % 2 === 0 ? '' : 'bg-gray-50'}>
                  <td className="p-2 border border-gray-300 text-center">{i + 1}</td>
                  <td className="p-2 border border-gray-300">
                    <input
                      type="text"
                      value={item.companyName}
                      onChange={e => updateAsset('listedStocks', item.id, { companyName: e.target.value })}
                      className={inputClass}
                    />
                  </td>
                  <td className="p-2 border border-gray-300">
                    <input
                      type="text"
                      value={item.stockCode}
                      onChange={e => updateAsset('listedStocks', item.id, { stockCode: e.target.value })}
                      className={inputClass}
                    />
                  </td>
                  <td className="p-2 border border-gray-300">
                    <input
                      type="text"
                      value={formatNum(item.shares)}
                      onChange={e => updateAsset('listedStocks', item.id, { shares: parseNum(e.target.value) })}
                      className={`${inputClass} text-right`}
                    />
                  </td>
                  <td className="p-2 border border-gray-300">
                    <input
                      type="text"
                      value={formatNum(item.deathDatePrice)}
                      onChange={e => updateAsset('listedStocks', item.id, { deathDatePrice: parseNum(e.target.value) })}
                      className={`${inputClass} text-right`}
                    />
                  </td>
                  <td className="p-2 border border-gray-300">
                    <input
                      type="text"
                      value={formatNum(item.monthlyAvgDeath)}
                      onChange={e => updateAsset('listedStocks', item.id, { monthlyAvgDeath: parseNum(e.target.value) })}
                      className={`${inputClass} text-right`}
                    />
                  </td>
                  <td className="p-2 border border-gray-300">
                    <input
                      type="text"
                      value={formatNum(item.monthlyAvgPrev1)}
                      onChange={e => updateAsset('listedStocks', item.id, { monthlyAvgPrev1: parseNum(e.target.value) })}
                      className={`${inputClass} text-right`}
                    />
                  </td>
                  <td className="p-2 border border-gray-300">
                    <input
                      type="text"
                      value={formatNum(item.monthlyAvgPrev2)}
                      onChange={e => updateAsset('listedStocks', item.id, { monthlyAvgPrev2: parseNum(e.target.value) })}
                      className={`${inputClass} text-right`}
                    />
                  </td>
                  <td className="p-2 border border-gray-300 text-right">
                    {formatNum(selectedPrice)}
                  </td>
                  <td className="p-2 border border-gray-300 text-right font-medium">
                    {formatNum(totalValue)}
                  </td>
                  <td className="p-2 border border-gray-300">
                    <input
                      type="text"
                      value={item.note}
                      onChange={e => updateAsset('listedStocks', item.id, { note: e.target.value })}
                      className={inputClass}
                    />
                  </td>
                  <td className="p-2 border border-gray-300 text-center">
                    <button
                      type="button"
                      onClick={() => removeAsset('listedStocks', item.id)}
                      className="text-red-600 hover:text-red-800"
                      aria-label="削除"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gray-100 font-semibold border-t-2">
              <td colSpan={9} className="p-2 text-right border border-gray-300">合計</td>
              <td className="p-2 text-right border border-gray-300">{formatNum(total)}</td>
              <td className="border border-gray-300" colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
