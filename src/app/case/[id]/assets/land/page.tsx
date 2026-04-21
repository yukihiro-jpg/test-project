'use client';

import React, { useState } from 'react';
import { useCaseStore } from '@/lib/store/case-store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { CurrencyInput, formatCurrency } from '@/components/common/currency-input';
import { calculateLandValue } from '@/lib/tax/asset-valuation';
import type { LandCategory, EvaluationMethod, SpecialLandUseType } from '@/types';
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';

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
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!currentCase) return <p className="text-gray-500">案件を選択してください</p>;

  const lands = currentCase.assets.lands;
  const total = lands.reduce((sum, land) => sum + calculateLandValue(land), 0);

  const handleAdd = () => {
    const id = addAsset('lands', {
      location: '', landNumber: '', landCategory: '宅地' as LandCategory,
      area: 0, evaluationMethod: 'rosenka' as EvaluationMethod,
      rosenkaPrice: 0, landShape: defaultLandShape(),
      fixedAssetTaxValue: 0, multiplier: 1,
      useSpecialLand: false, specialUse: defaultSpecialUse(),
      note: '',
    });
    setExpandedId(id);
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">土地</h1>
        <Button onClick={handleAdd}>
          <Plus size={18} className="mr-2" />追加
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 border-b">
              <th className="p-2 text-left w-8"></th>
              <th className="p-2 text-left w-8">No</th>
              <th className="p-2 text-left">所在地</th>
              <th className="p-2 text-left">地目</th>
              <th className="p-2 text-right">地積</th>
              <th className="p-2 text-right">評価額</th>
            </tr>
          </thead>
          <tbody>
            {lands.map((land, i) => {
              const value = calculateLandValue(land);
              return (
                <React.Fragment key={land.id}>
                  <tr
                    className={`border-b cursor-pointer hover:bg-blue-50 ${i % 2 === 0 ? '' : 'bg-gray-50'} ${expandedId === land.id ? 'bg-blue-50' : ''}`}
                    onClick={() => setExpandedId(expandedId === land.id ? null : land.id)}
                  >
                    <td className="p-2">
                      {expandedId === land.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </td>
                    <td className="p-2">{i + 1}</td>
                    <td className="p-2">{land.location || '（未入力）'}</td>
                    <td className="p-2">{land.landCategory}</td>
                    <td className="p-2 text-right">{land.area ? `${land.area}㎡` : '-'}</td>
                    <td className="p-2 text-right font-medium">{formatCurrency(value)}</td>
                  </tr>
                  {expandedId === land.id && (
                    <tr><td colSpan={6} className="p-0">
                      <div className="px-4 py-3 bg-white border-l-4 border-blue-400 space-y-2">
                        {/* 1行目: 基本情報 */}
                        <div className="grid grid-cols-6 gap-2 items-end">
                          <Input label="所在地" value={land.location}
                            onChange={e => updateAsset('lands', land.id, { location: e.target.value })} />
                          <Input label="地番" value={land.landNumber}
                            onChange={e => updateAsset('lands', land.id, { landNumber: e.target.value })} />
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
                          <Input label="備考" value={land.note}
                            onChange={e => updateAsset('lands', land.id, { note: e.target.value })} />
                        </div>
                        {/* 2行目: 評価詳細 */}
                        {land.evaluationMethod === 'rosenka' ? (
                          <div className="grid grid-cols-8 gap-2 items-end">
                            <CurrencyInput label="路線価(円/㎡)" value={land.rosenkaPrice}
                              onChange={v => updateAsset('lands', land.id, { rosenkaPrice: v })} />
                            <Input label="奥行補正率" type="number" value={land.landShape?.depthCorrection || ''} step="0.01"
                              onChange={e => updateAsset('lands', land.id, {
                                landShape: { ...land.landShape, depthCorrection: Number(e.target.value) }
                              })} />
                            <Input label="間口(m)" type="number" value={land.landShape?.frontageDistance || ''}
                              onChange={e => updateAsset('lands', land.id, {
                                landShape: { ...land.landShape, frontageDistance: Number(e.target.value) }
                              })} />
                            <Input label="奥行(m)" type="number" value={land.landShape?.depth || ''}
                              onChange={e => updateAsset('lands', land.id, {
                                landShape: { ...land.landShape, depth: Number(e.target.value) }
                              })} />
                            <Input label="借地権割合" type="number" value={land.landShape?.borrowedLandRatio || ''} step="0.1"
                              onChange={e => updateAsset('lands', land.id, {
                                landShape: { ...land.landShape, borrowedLandRatio: Number(e.target.value) }
                              })} />
                            <div className="flex items-end gap-2 pb-1">
                              <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                                <input type="checkbox" checked={land.landShape?.irregularShape || false}
                                  onChange={e => updateAsset('lands', land.id, {
                                    landShape: { ...land.landShape, irregularShape: e.target.checked }
                                  })} className="w-3 h-3" />不整形
                              </label>
                              <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                                <input type="checkbox" checked={land.useSpecialLand || false}
                                  onChange={e => updateAsset('lands', land.id, { useSpecialLand: e.target.checked })} className="w-3 h-3" />小規模
                              </label>
                            </div>
                            {land.useSpecialLand && (
                              <Select label="特例" value={land.specialUse?.type || 'residence'}
                                onChange={e => {
                                  const type = e.target.value as SpecialLandUseType;
                                  const configs: Record<SpecialLandUseType, { rate: number; max: number }> = {
                                    residence: { rate: 0.8, max: 330 }, business: { rate: 0.8, max: 400 }, rental: { rate: 0.5, max: 200 },
                                  };
                                  updateAsset('lands', land.id, { specialUse: { ...land.specialUse, type, reductionRate: configs[type].rate, maxArea: configs[type].max } });
                                }}
                                options={[
                                  { value: 'residence', label: '居住用80%' },
                                  { value: 'business', label: '事業用80%' },
                                  { value: 'rental', label: '貸付用50%' },
                                ]} />
                            )}
                            <button onClick={() => removeAsset('lands', land.id)}
                              className="text-red-500 hover:text-red-700 text-xs pb-1">削除</button>
                          </div>
                        ) : (
                          <div className="grid grid-cols-4 gap-2 items-end">
                            <CurrencyInput label="固定資産税評価額" value={land.fixedAssetTaxValue}
                              onChange={v => updateAsset('lands', land.id, { fixedAssetTaxValue: v })} />
                            <Input label="倍率" type="number" value={land.multiplier || ''} step="0.1"
                              onChange={e => updateAsset('lands', land.id, { multiplier: Number(e.target.value) })} />
                            <div className="flex items-end gap-2 pb-1">
                              <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                                <input type="checkbox" checked={land.useSpecialLand || false}
                                  onChange={e => updateAsset('lands', land.id, { useSpecialLand: e.target.checked })} className="w-3 h-3" />小規模宅地特例
                              </label>
                            </div>
                            <button onClick={() => removeAsset('lands', land.id)}
                              className="text-red-500 hover:text-red-700 text-xs pb-1">削除</button>
                          </div>
                        )}
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
