'use client';

import React, { useState } from 'react';
import { useCaseStore } from '@/lib/store/case-store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { CurrencyInput, formatCurrency } from '@/components/common/currency-input';
import { calculateBuildingValue } from '@/lib/tax/asset-valuation';
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';

export default function BuildingPage() {
  const currentCase = useCaseStore(s => s.getCurrentCase());
  const addAsset = useCaseStore(s => s.addAsset);
  const updateAsset = useCaseStore(s => s.updateAsset);
  const removeAsset = useCaseStore(s => s.removeAsset);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!currentCase) return <p className="text-gray-500">案件を選択してください</p>;
  const buildings = currentCase.assets.buildings;
  const total = buildings.reduce((sum, b) => sum + calculateBuildingValue(b), 0);

  const handleAdd = () => {
    const id = addAsset('buildings', {
      location: '', structureType: '', usage: '自用',
      fixedAssetTaxValue: 0, rentalReduction: false,
      borrowedHouseRatio: 0.3, note: '',
    });
    setExpandedId(id);
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">建物</h1>
        <Button onClick={handleAdd}><Plus size={18} className="mr-2" />追加</Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 border-b">
              <th className="p-2 text-left w-8"></th>
              <th className="p-2 text-left w-8">No</th>
              <th className="p-2 text-left">所在地</th>
              <th className="p-2 text-left">用途</th>
              <th className="p-2 text-right">固定資産税評価額</th>
              <th className="p-2 text-right">評価額</th>
            </tr>
          </thead>
          <tbody>
            {buildings.map((b, i) => {
              const value = calculateBuildingValue(b);
              return (
                <React.Fragment key={b.id}>
                  <tr
                    className={`border-b cursor-pointer hover:bg-blue-50 ${i % 2 === 0 ? '' : 'bg-gray-50'} ${expandedId === b.id ? 'bg-blue-50' : ''}`}
                    onClick={() => setExpandedId(expandedId === b.id ? null : b.id)}
                  >
                    <td className="p-2">
                      {expandedId === b.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </td>
                    <td className="p-2">{i + 1}</td>
                    <td className="p-2">{b.location || '（未入力）'}</td>
                    <td className="p-2">{b.usage || '-'}</td>
                    <td className="p-2 text-right">{formatCurrency(b.fixedAssetTaxValue)}</td>
                    <td className="p-2 text-right font-medium">{formatCurrency(value)}</td>
                  </tr>
                  {expandedId === b.id && (
                    <tr><td colSpan={6} className="p-0">
                      <div className="p-4 bg-white border-l-4 border-blue-400 space-y-4">
                        <Input label="所在地" value={b.location}
                          onChange={e => updateAsset('buildings', b.id, { location: e.target.value })} />
                        <div className="grid grid-cols-2 gap-4">
                          <Input label="構造" value={b.structureType} placeholder="木造/RC等"
                            onChange={e => updateAsset('buildings', b.id, { structureType: e.target.value })} />
                          <Input label="用途" value={b.usage} placeholder="自用/貸家等"
                            onChange={e => updateAsset('buildings', b.id, { usage: e.target.value })} />
                        </div>
                        <CurrencyInput label="固定資産税評価額" value={b.fixedAssetTaxValue}
                          onChange={v => updateAsset('buildings', b.id, { fixedAssetTaxValue: v })} />
                        <Checkbox label="貸家（借家権割合30%減額）" checked={b.rentalReduction}
                          onChange={e => updateAsset('buildings', b.id, { rentalReduction: (e.target as HTMLInputElement).checked })} />
                        {b.rentalReduction && (
                          <Input label="借家権割合" type="number" value={b.borrowedHouseRatio} step="0.1"
                            onChange={e => updateAsset('buildings', b.id, { borrowedHouseRatio: Number(e.target.value) })} />
                        )}
                        <Input label="備考" value={b.note}
                          onChange={e => updateAsset('buildings', b.id, { note: e.target.value })} />
                        <div className="flex justify-end">
                          <Button variant="danger" size="sm" onClick={() => removeAsset('buildings', b.id)}>
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
