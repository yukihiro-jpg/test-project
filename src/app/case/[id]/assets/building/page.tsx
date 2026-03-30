'use client';

import { useCaseStore } from '@/lib/store/case-store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CurrencyInput, formatCurrency } from '@/components/common/currency-input';
import { calculateBuildingValue } from '@/lib/tax/asset-valuation';
import { Plus, Trash2 } from 'lucide-react';

export default function BuildingPage() {
  const currentCase = useCaseStore(s => s.getCurrentCase());
  const addAsset = useCaseStore(s => s.addAsset);
  const updateAsset = useCaseStore(s => s.updateAsset);
  const removeAsset = useCaseStore(s => s.removeAsset);

  if (!currentCase) return <p className="text-gray-500">案件を選択してください</p>;
  const buildings = currentCase.assets.buildings;

  const handleAdd = () => {
    addAsset('buildings', {
      location: '', structureType: '', usage: '自用',
      fixedAssetTaxValue: 0, rentalReduction: false,
      borrowedHouseRatio: 0.3, note: '',
    });
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">建物</h1>
        <Button onClick={handleAdd}><Plus size={18} className="mr-2" />追加</Button>
      </div>

      {buildings.map((b, i) => {
        const value = calculateBuildingValue(b);
        return (
          <Card key={b.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>建物 {i + 1}</CardTitle>
              <div className="flex items-center gap-3">
                <span className="text-lg font-semibold text-blue-700">{formatCurrency(value)}</span>
                <Button variant="danger" size="sm" onClick={() => removeAsset('buildings', b.id)}>
                  <Trash2 size={16} />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
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
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
