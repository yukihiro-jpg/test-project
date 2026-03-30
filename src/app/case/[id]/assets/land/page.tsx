'use client';

import { useCaseStore } from '@/lib/store/case-store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CurrencyInput, formatCurrency } from '@/components/common/currency-input';
import { calculateLandValue } from '@/lib/tax/asset-valuation';
import type { LandAsset, LandCategory, EvaluationMethod, SpecialLandUseType } from '@/types';
import { Plus, Trash2 } from 'lucide-react';

const LAND_CATEGORIES = ['宅地', '田', '畑', '山林', '原野', '牧場', '池沼', '鉱泉地', '雑種地']
  .map(v => ({ value: v, label: v }));

const defaultLandShape = () => ({
  frontageDistance: 0, depth: 0, depthCorrection: 1,
  irregularShape: false, irregularCorrection: 1,
  sideRoad: false, sideRoadCorrection: 0,
  twoRoads: false, twoRoadsCorrection: 0,
  setback: 0, borrowedLandRatio: 0,
});

const defaultSpecialUse = () => ({
  type: 'residence' as SpecialLandUseType,
  reductionRate: 0.8, applicableArea: 0, maxArea: 330,
});

export default function LandPage() {
  const currentCase = useCaseStore(s => s.getCurrentCase());
  const addAsset = useCaseStore(s => s.addAsset);
  const updateAsset = useCaseStore(s => s.updateAsset);
  const removeAsset = useCaseStore(s => s.removeAsset);

  if (!currentCase) return <p className="text-gray-500">案件を選択してください</p>;

  const lands = currentCase.assets.lands;

  const handleAdd = () => {
    addAsset('lands', {
      location: '', landNumber: '', landCategory: '宅地' as LandCategory,
      area: 0, evaluationMethod: 'rosenka' as EvaluationMethod,
      rosenkaPrice: 0, landShape: defaultLandShape(),
      fixedAssetTaxValue: 0, multiplier: 1,
      useSpecialLand: false, specialUse: defaultSpecialUse(),
      note: '',
    });
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">土地</h1>
        <Button onClick={handleAdd}>
          <Plus size={18} className="mr-2" />追加
        </Button>
      </div>

      {lands.map((land, i) => {
        const value = calculateLandValue(land);
        return (
          <Card key={land.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>土地 {i + 1}</CardTitle>
              <div className="flex items-center gap-3">
                <span className="text-lg font-semibold text-blue-700">{formatCurrency(value)}</span>
                <Button variant="danger" size="sm" onClick={() => removeAsset('lands', land.id)}>
                  <Trash2 size={16} />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="所在地" value={land.location}
                  onChange={e => updateAsset('lands', land.id, { location: e.target.value })} />
                <Input label="地番" value={land.landNumber}
                  onChange={e => updateAsset('lands', land.id, { landNumber: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Select label="地目" value={land.landCategory}
                  onChange={e => updateAsset('lands', land.id, { landCategory: e.target.value as LandCategory })}
                  options={LAND_CATEGORIES} />
                <Input label="地積" type="number" value={land.area || ''} suffix="㎡"
                  onChange={e => updateAsset('lands', land.id, { area: Number(e.target.value) })} />
                <Select label="評価方式" value={land.evaluationMethod}
                  onChange={e => updateAsset('lands', land.id, { evaluationMethod: e.target.value as EvaluationMethod })}
                  options={[
                    { value: 'rosenka', label: '路線価方式' },
                    { value: 'bairitsu', label: '倍率方式' },
                  ]} />
              </div>

              {land.evaluationMethod === 'rosenka' ? (
                <div className="border rounded-md p-4 space-y-4 bg-gray-50">
                  <h4 className="font-medium text-sm text-gray-700">路線価方式</h4>
                  <CurrencyInput label="路線価（円/㎡）" value={land.rosenkaPrice}
                    onChange={v => updateAsset('lands', land.id, { rosenkaPrice: v })} suffix="円/㎡" />
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="間口距離" type="number" value={land.landShape?.frontageDistance || ''} suffix="m"
                      onChange={e => updateAsset('lands', land.id, {
                        landShape: { ...land.landShape, frontageDistance: Number(e.target.value) }
                      })} />
                    <Input label="奥行距離" type="number" value={land.landShape?.depth || ''} suffix="m"
                      onChange={e => updateAsset('lands', land.id, {
                        landShape: { ...land.landShape, depth: Number(e.target.value) }
                      })} />
                  </div>
                  <Input label="奥行価格補正率" type="number" value={land.landShape?.depthCorrection || ''} step="0.01"
                    onChange={e => updateAsset('lands', land.id, {
                      landShape: { ...land.landShape, depthCorrection: Number(e.target.value) }
                    })} />
                  <div className="space-y-2">
                    <Checkbox label="不整形地" checked={land.landShape?.irregularShape}
                      onChange={e => updateAsset('lands', land.id, {
                        landShape: { ...land.landShape, irregularShape: (e.target as HTMLInputElement).checked }
                      })} />
                    {land.landShape?.irregularShape && (
                      <Input label="不整形地補正率" type="number" value={land.landShape.irregularCorrection || ''} step="0.01"
                        onChange={e => updateAsset('lands', land.id, {
                          landShape: { ...land.landShape, irregularCorrection: Number(e.target.value) }
                        })} />
                    )}
                    <Checkbox label="側方路線" checked={land.landShape?.sideRoad}
                      onChange={e => updateAsset('lands', land.id, {
                        landShape: { ...land.landShape, sideRoad: (e.target as HTMLInputElement).checked }
                      })} />
                    {land.landShape?.sideRoad && (
                      <Input label="側方路線影響加算率" type="number" value={land.landShape.sideRoadCorrection || ''} step="0.01"
                        onChange={e => updateAsset('lands', land.id, {
                          landShape: { ...land.landShape, sideRoadCorrection: Number(e.target.value) }
                        })} />
                    )}
                    <Checkbox label="二方路線" checked={land.landShape?.twoRoads}
                      onChange={e => updateAsset('lands', land.id, {
                        landShape: { ...land.landShape, twoRoads: (e.target as HTMLInputElement).checked }
                      })} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="セットバック面積" type="number" value={land.landShape?.setback || ''} suffix="㎡"
                      onChange={e => updateAsset('lands', land.id, {
                        landShape: { ...land.landShape, setback: Number(e.target.value) }
                      })} />
                    <Input label="借地権割合" type="number" value={land.landShape?.borrowedLandRatio || ''} step="0.1"
                      onChange={e => updateAsset('lands', land.id, {
                        landShape: { ...land.landShape, borrowedLandRatio: Number(e.target.value) }
                      })} />
                  </div>
                </div>
              ) : (
                <div className="border rounded-md p-4 space-y-4 bg-gray-50">
                  <h4 className="font-medium text-sm text-gray-700">倍率方式</h4>
                  <CurrencyInput label="固定資産税評価額" value={land.fixedAssetTaxValue}
                    onChange={v => updateAsset('lands', land.id, { fixedAssetTaxValue: v })} />
                  <Input label="倍率" type="number" value={land.multiplier || ''} step="0.1"
                    onChange={e => updateAsset('lands', land.id, { multiplier: Number(e.target.value) })} />
                </div>
              )}

              {/* 小規模宅地等の特例 */}
              <div className="border rounded-md p-4 space-y-4 bg-yellow-50">
                <Checkbox label="小規模宅地等の特例を適用" checked={land.useSpecialLand}
                  onChange={e => updateAsset('lands', land.id, { useSpecialLand: (e.target as HTMLInputElement).checked })} />
                {land.useSpecialLand && (
                  <div className="space-y-3">
                    <Select label="特例の種類" value={land.specialUse?.type || 'residence'}
                      onChange={e => {
                        const type = e.target.value as SpecialLandUseType;
                        const configs: Record<SpecialLandUseType, { rate: number; max: number }> = {
                          residence: { rate: 0.8, max: 330 },
                          business: { rate: 0.8, max: 400 },
                          rental: { rate: 0.5, max: 200 },
                        };
                        updateAsset('lands', land.id, {
                          specialUse: {
                            ...land.specialUse,
                            type,
                            reductionRate: configs[type].rate,
                            maxArea: configs[type].max,
                          },
                        });
                      }}
                      options={[
                        { value: 'residence', label: '特定居住用宅地等（80%減額, 330㎡）' },
                        { value: 'business', label: '特定事業用宅地等（80%減額, 400㎡）' },
                        { value: 'rental', label: '貸付事業用宅地等（50%減額, 200㎡）' },
                      ]} />
                    <Input label="適用面積" type="number" value={land.specialUse?.applicableArea || ''} suffix="㎡"
                      onChange={e => updateAsset('lands', land.id, {
                        specialUse: { ...land.specialUse, applicableArea: Number(e.target.value) },
                      })} />
                  </div>
                )}
              </div>

              <Input label="備考・確認論点" value={land.note}
                onChange={e => updateAsset('lands', land.id, { note: e.target.value })}
                placeholder="土地評価に関する確認事項をメモ" />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
