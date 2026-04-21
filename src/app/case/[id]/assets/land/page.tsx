'use client';

import React from 'react';
import { useCaseStore } from '@/lib/store/case-store';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/components/common/currency-input';
import { calculateLandValue } from '@/lib/tax/asset-valuation';
import type { LandCategory, EvaluationMethod, SpecialLandUseType, LandUsageType } from '@/types';
import { Plus, Trash2 } from 'lucide-react';

const LAND_CATEGORIES: LandCategory[] = ['宅地', '田', '畑', '山林', '原野', '牧場', '池沼', '鉱泉地', '雑種地'];
const LAND_USAGES: LandUsageType[] = ['自用', '貸家', '貸家建付地', '貸地', '私道', '使用貸借'];
const EVALUATION_AREAS = ['路線価', '倍率'];

const inputCls = 'w-full border border-gray-300 rounded px-2 py-1 text-sm';
const inputNumCls = 'w-full border border-gray-300 rounded px-2 py-1 text-sm text-right';

const defaultLandShape = () => ({
  frontageDistance: 0,
  depth: 0,
  depthCorrection: 1,
  irregularShape: false,
  irregularCorrection: 1,
  sideRoad: false,
  sideRoadCorrection: 0,
  twoRoads: false,
  twoRoadsCorrection: 0,
  setback: 0,
  borrowedLandRatio: 0,
});

const defaultSpecialUse = () => ({
  type: 'residence' as SpecialLandUseType,
  reductionRate: 0.8,
  applicableArea: 0,
  maxArea: 330,
});

export default function LandPage() {
  const currentCase = useCaseStore(s => s.getCurrentCase());
  const addAsset = useCaseStore(s => s.addAsset);
  const updateAsset = useCaseStore(s => s.updateAsset);
  const removeAsset = useCaseStore(s => s.removeAsset);

  if (!currentCase) return <p className="text-gray-500">案件を選択してください</p>;

  const lands = currentCase.assets.lands;
  const total = lands.reduce((sum, land) => sum + calculateLandValue(land), 0);

  const handleAdd = () => {
    addAsset('lands', {
      location: '',
      landNumber: '',
      referenceNote: '',
      ownershipRatio: '1/1',
      landCategory: '宅地' as LandCategory,
      registeredCategory: '宅地',
      taxCategory: '宅地',
      currentStatus: '',
      area: 0,
      registeredArea: 0,
      taxArea: 0,
      evaluationMethod: 'rosenka' as EvaluationMethod,
      rosenkaPrice: 0,
      landShape: defaultLandShape(),
      fixedAssetTaxValue: 0,
      multiplier: 1,
      evaluationArea: '路線価',
      usage: '自用' as LandUsageType,
      tenantName: '',
      borrowingRightRatio: 0,
      sideTwoRoads: '',
      cityPlanningZone: '',
      useSpecialLand: false,
      specialUse: defaultSpecialUse(),
      note: '',
      confirmationNote: '',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">土地</h1>
        <Button onClick={handleAdd}>
          <Plus size={18} className="mr-2" />追加
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="text-sm border-collapse">
          <thead>
            <tr className="bg-gray-100 border-b">
              <th className="p-2 text-center w-12 border border-gray-300">No</th>
              <th className="p-2 text-center w-16 border border-gray-300">土地家屋</th>
              <th className="p-2 text-left min-w-[200px] border border-gray-300">地番・参照備考</th>
              <th className="p-2 text-center w-20 border border-gray-300">持分</th>
              <th className="p-2 text-center w-20 border border-gray-300">登記地目</th>
              <th className="p-2 text-center w-20 border border-gray-300">課税地目</th>
              <th className="p-2 text-left w-32 border border-gray-300">現況確認・実地調査</th>
              <th className="p-2 text-right w-24 border border-gray-300">登記地積<br /><span className="text-xs font-normal">騰本より</span></th>
              <th className="p-2 text-right w-24 border border-gray-300">課税地積<br /><span className="text-xs font-normal">評証より</span></th>
              <th className="p-2 text-right w-32 border border-gray-300">固定資産税評価額</th>
              <th className="p-2 text-center w-24 border border-gray-300">評価地域<br /><span className="text-xs font-normal">路・倍</span></th>
              <th className="p-2 text-right w-24 border border-gray-300">倍率</th>
              <th className="p-2 text-right w-32 border border-gray-300">路線価</th>
              <th className="p-2 text-center w-28 border border-gray-300">自用/貸家</th>
              <th className="p-2 text-left w-32 border border-gray-300">借主</th>
              <th className="p-2 text-right w-24 border border-gray-300">借地権割合</th>
              <th className="p-2 text-left w-32 border border-gray-300">側方・二方</th>
              <th className="p-2 text-left w-32 border border-gray-300">都市計画区分</th>
              <th className="p-2 text-left w-32 border border-gray-300">備考</th>
              <th className="p-2 text-left w-32 border border-gray-300">確認すること</th>
              <th className="p-2 text-center w-12 border border-gray-300"></th>
            </tr>
          </thead>
          <tbody>
            {lands.map((land, i) => (
              <tr key={land.id} className={`border-b ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                <td className="p-2 text-center border border-gray-300">{i + 1}</td>
                <td className="p-2 text-center border border-gray-300">土地</td>
                <td className="p-2 border border-gray-300">
                  <input
                    type="text"
                    className={inputCls}
                    value={land.location}
                    placeholder="所在地・地番"
                    onChange={e => updateAsset('lands', land.id, { location: e.target.value })}
                  />
                  <input
                    type="text"
                    className={`${inputCls} mt-1`}
                    value={land.referenceNote || ''}
                    placeholder="参照備考"
                    onChange={e => updateAsset('lands', land.id, { referenceNote: e.target.value })}
                  />
                </td>
                <td className="p-2 border border-gray-300">
                  <input
                    type="text"
                    className={inputCls}
                    value={land.ownershipRatio || ''}
                    placeholder="1/1"
                    onChange={e => updateAsset('lands', land.id, { ownershipRatio: e.target.value })}
                  />
                </td>
                <td className="p-2 border border-gray-300">
                  <select
                    className={inputCls}
                    value={land.registeredCategory || '宅地'}
                    onChange={e => updateAsset('lands', land.id, { registeredCategory: e.target.value })}
                  >
                    {LAND_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </td>
                <td className="p-2 border border-gray-300">
                  <select
                    className={inputCls}
                    value={land.taxCategory || '宅地'}
                    onChange={e => updateAsset('lands', land.id, { taxCategory: e.target.value })}
                  >
                    {LAND_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </td>
                <td className="p-2 border border-gray-300">
                  <input
                    type="text"
                    className={inputCls}
                    value={land.currentStatus || ''}
                    onChange={e => updateAsset('lands', land.id, { currentStatus: e.target.value })}
                  />
                </td>
                <td className="p-2 border border-gray-300">
                  <input
                    type="number"
                    className={inputNumCls}
                    value={land.registeredArea || ''}
                    onChange={e => updateAsset('lands', land.id, { registeredArea: Number(e.target.value) })}
                  />
                </td>
                <td className="p-2 border border-gray-300">
                  <input
                    type="number"
                    className={inputNumCls}
                    value={land.taxArea || ''}
                    onChange={e => updateAsset('lands', land.id, { taxArea: Number(e.target.value) })}
                  />
                </td>
                <td className="p-2 border border-gray-300">
                  <input
                    type="number"
                    className={inputNumCls}
                    value={land.fixedAssetTaxValue || ''}
                    onChange={e => updateAsset('lands', land.id, { fixedAssetTaxValue: Number(e.target.value) })}
                  />
                </td>
                <td className="p-2 border border-gray-300">
                  <select
                    className={inputCls}
                    value={land.evaluationArea || '路線価'}
                    onChange={e => {
                      const val = e.target.value;
                      updateAsset('lands', land.id, {
                        evaluationArea: val,
                        evaluationMethod: (val === '倍率' ? 'bairitsu' : 'rosenka') as EvaluationMethod,
                      });
                    }}
                  >
                    {EVALUATION_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </td>
                <td className="p-2 border border-gray-300">
                  <input
                    type="number"
                    step="0.01"
                    className={inputNumCls}
                    value={land.multiplier || ''}
                    onChange={e => updateAsset('lands', land.id, { multiplier: Number(e.target.value) })}
                  />
                </td>
                <td className="p-2 border border-gray-300">
                  <input
                    type="number"
                    className={inputNumCls}
                    value={land.rosenkaPrice || ''}
                    onChange={e => updateAsset('lands', land.id, { rosenkaPrice: Number(e.target.value) })}
                  />
                </td>
                <td className="p-2 border border-gray-300">
                  <select
                    className={inputCls}
                    value={land.usage || '自用'}
                    onChange={e => updateAsset('lands', land.id, { usage: e.target.value as LandUsageType })}
                  >
                    {LAND_USAGES.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </td>
                <td className="p-2 border border-gray-300">
                  <input
                    type="text"
                    className={inputCls}
                    value={land.tenantName || ''}
                    onChange={e => updateAsset('lands', land.id, { tenantName: e.target.value })}
                  />
                </td>
                <td className="p-2 border border-gray-300">
                  <input
                    type="number"
                    step="0.01"
                    className={inputNumCls}
                    value={land.borrowingRightRatio || ''}
                    onChange={e => updateAsset('lands', land.id, { borrowingRightRatio: Number(e.target.value) })}
                  />
                </td>
                <td className="p-2 border border-gray-300">
                  <input
                    type="text"
                    className={inputCls}
                    value={land.sideTwoRoads || ''}
                    onChange={e => updateAsset('lands', land.id, { sideTwoRoads: e.target.value })}
                  />
                </td>
                <td className="p-2 border border-gray-300">
                  <input
                    type="text"
                    className={inputCls}
                    value={land.cityPlanningZone || ''}
                    onChange={e => updateAsset('lands', land.id, { cityPlanningZone: e.target.value })}
                  />
                </td>
                <td className="p-2 border border-gray-300">
                  <input
                    type="text"
                    className={inputCls}
                    value={land.note}
                    onChange={e => updateAsset('lands', land.id, { note: e.target.value })}
                  />
                </td>
                <td className="p-2 border border-gray-300">
                  <input
                    type="text"
                    className={inputCls}
                    value={land.confirmationNote || ''}
                    onChange={e => updateAsset('lands', land.id, { confirmationNote: e.target.value })}
                  />
                </td>
                <td className="p-2 text-center border border-gray-300">
                  <button
                    onClick={() => removeAsset('lands', land.id)}
                    className="text-red-500 hover:text-red-700"
                    aria-label="削除"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {lands.length === 0 && (
              <tr>
                <td colSpan={21} className="p-6 text-center text-gray-500 border border-gray-300">
                  土地が登録されていません。「追加」ボタンから登録してください。
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 font-semibold bg-gray-100">
              <td colSpan={9} className="p-2 text-right border border-gray-300">評価額合計</td>
              <td className="p-2 text-right border border-gray-300" colSpan={11}>{formatCurrency(total)}</td>
              <td className="p-2 border border-gray-300"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
