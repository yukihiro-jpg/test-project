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

/** Sticky column left offsets: No = 0, 地番 = 48px (w-12) */
const STICKY_NO_LEFT = 0;
const STICKY_CHIBAN_LEFT = 48; // w-12 = 3rem = 48px

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

  const rowBg = (i: number) => (i % 2 === 0 ? 'white' : '#f9fafb');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">土地</h1>
        <Button onClick={handleAdd}>
          <Plus size={18} className="mr-2" />追加
        </Button>
      </div>

      <div className="overflow-x-auto border border-gray-300 rounded-lg">
        <table className="text-sm border-collapse w-max">
          <thead>
            <tr className="bg-gray-100 border-b">
              {/* --- Sticky: No --- */}
              <th
                className="p-1 text-center w-12 border border-gray-300 sticky z-20 bg-gray-100"
                style={{ left: STICKY_NO_LEFT }}
              >
                No
              </th>
              {/* --- Sticky: 地番・参照備考 --- */}
              <th
                className="p-1 text-left min-w-[280px] border border-gray-300 sticky z-20 bg-gray-100 border-r-2 border-r-gray-400 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)]"
                style={{ left: STICKY_CHIBAN_LEFT }}
              >
                地番・参照備考
              </th>
              {/* --- Scrollable columns --- */}
              <th className="p-1 text-center min-w-[100px] border border-gray-300">持分</th>
              <th className="p-1 text-center min-w-[140px] border border-gray-300">
                <div>地目</div>
                <div className="text-xs font-normal text-gray-500">登記 / 課税</div>
              </th>
              <th className="p-1 text-left min-w-[150px] border border-gray-300">現況確認・実地調査</th>
              <th className="p-1 text-center min-w-[140px] border border-gray-300">
                <div>地積</div>
                <div className="text-xs font-normal text-gray-500">登記 / 課税</div>
              </th>
              <th className="p-1 text-right min-w-[150px] border border-gray-300">固定資産税評価額</th>
              <th className="p-1 text-center min-w-[100px] border border-gray-300">評価地域<br /><span className="text-xs font-normal">路・倍</span></th>
              <th className="p-1 text-center min-w-[130px] border border-gray-300">
                <div>路線価/倍率</div>
              </th>
              <th className="p-1 text-center min-w-[120px] border border-gray-300">自用/貸家</th>
              <th className="p-1 text-left min-w-[150px] border border-gray-300">借主</th>
              <th className="p-1 text-right min-w-[120px] border border-gray-300">借地権割合</th>
              <th className="p-1 text-left min-w-[150px] border border-gray-300">側方・二方</th>
              <th className="p-1 text-left min-w-[150px] border border-gray-300">都市計画区分</th>
              <th className="p-1 text-left min-w-[200px] border border-gray-300">
                <div>備考/確認</div>
              </th>
              <th className="p-1 text-center w-12 border border-gray-300"></th>
            </tr>
          </thead>
          <tbody>
            {lands.map((land, i) => (
              <tr key={land.id} className="border-b">
                {/* --- Sticky: No --- */}
                <td
                  className="p-1 text-center border border-gray-300 sticky z-10"
                  style={{ left: STICKY_NO_LEFT, background: rowBg(i) }}
                >
                  {i + 1}
                </td>
                {/* --- Sticky: 地番・参照備考 --- */}
                <td
                  className="p-1 border border-gray-300 min-w-[280px] sticky z-10 border-r-2 border-r-gray-400 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)]"
                  style={{ left: STICKY_CHIBAN_LEFT, background: rowBg(i) }}
                >
                  <div className="flex gap-1">
                    <input
                      type="text"
                      className={inputCls}
                      value={land.location}
                      placeholder="所在地"
                      onChange={e => updateAsset('lands', land.id, { location: e.target.value })}
                    />
                    <input
                      type="text"
                      className={`${inputCls} w-28 shrink-0`}
                      value={land.landNumber || ''}
                      placeholder="地番"
                      onChange={e => updateAsset('lands', land.id, { landNumber: e.target.value })}
                    />
                  </div>
                  <input
                    type="text"
                    className={`${inputCls} mt-0.5`}
                    value={land.referenceNote || ''}
                    placeholder="参照備考"
                    onChange={e => updateAsset('lands', land.id, { referenceNote: e.target.value })}
                  />
                </td>
                {/* --- Scrollable columns --- */}
                <td className="p-1 border border-gray-300">
                  <input
                    type="text"
                    className={`${inputCls} min-w-[80px]`}
                    value={land.ownershipRatio || ''}
                    placeholder="1/1"
                    onChange={e => updateAsset('lands', land.id, { ownershipRatio: e.target.value })}
                  />
                </td>
                {/* Combined 地目: 登記地目 (top) + 課税地目 (bottom) */}
                <td className="p-1 border border-gray-300">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-400 shrink-0 w-6">登記</span>
                    <select
                      className={`${inputCls} min-w-[80px]`}
                      value={land.registeredCategory || '宅地'}
                      onChange={e => updateAsset('lands', land.id, { registeredCategory: e.target.value })}
                    >
                      {LAND_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-xs text-gray-400 shrink-0 w-6">課税</span>
                    <select
                      className={`${inputCls} min-w-[80px]`}
                      value={land.taxCategory || '宅地'}
                      onChange={e => updateAsset('lands', land.id, { taxCategory: e.target.value })}
                    >
                      {LAND_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </td>
                <td className="p-1 border border-gray-300">
                  <input
                    type="text"
                    className={`${inputCls} min-w-[120px]`}
                    value={land.currentStatus || ''}
                    onChange={e => updateAsset('lands', land.id, { currentStatus: e.target.value })}
                  />
                </td>
                {/* Combined 地積: 登記地積 (top) + 課税地積 (bottom) */}
                <td className="p-1 border border-gray-300">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-400 shrink-0 w-6">登記</span>
                    <input
                      type="number"
                      className={`${inputNumCls} min-w-[90px]`}
                      value={land.registeredArea || ''}
                      onChange={e => updateAsset('lands', land.id, { registeredArea: Number(e.target.value) })}
                    />
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-xs text-gray-400 shrink-0 w-6">課税</span>
                    <input
                      type="number"
                      className={`${inputNumCls} min-w-[90px]`}
                      value={land.taxArea || ''}
                      onChange={e => updateAsset('lands', land.id, { taxArea: Number(e.target.value) })}
                    />
                  </div>
                </td>
                <td className="p-1 border border-gray-300">
                  <input
                    type="number"
                    className={`${inputNumCls} min-w-[130px]`}
                    value={land.fixedAssetTaxValue || ''}
                    onChange={e => updateAsset('lands', land.id, { fixedAssetTaxValue: Number(e.target.value) })}
                  />
                </td>
                <td className="p-1 border border-gray-300">
                  <select
                    className={`${inputCls} min-w-[80px]`}
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
                {/* Combined 路線価/倍率: show relevant input based on evaluationArea */}
                <td className="p-1 border border-gray-300">
                  {land.evaluationArea === '倍率' ? (
                    <input
                      type="number"
                      step="0.01"
                      className={`${inputNumCls} min-w-[110px]`}
                      value={land.multiplier || ''}
                      placeholder="倍率"
                      onChange={e => updateAsset('lands', land.id, { multiplier: Number(e.target.value) })}
                    />
                  ) : (
                    <input
                      type="number"
                      className={`${inputNumCls} min-w-[110px]`}
                      value={land.rosenkaPrice || ''}
                      placeholder="路線価"
                      onChange={e => updateAsset('lands', land.id, { rosenkaPrice: Number(e.target.value) })}
                    />
                  )}
                </td>
                <td className="p-1 border border-gray-300">
                  <select
                    className={`${inputCls} min-w-[100px]`}
                    value={land.usage || '自用'}
                    onChange={e => updateAsset('lands', land.id, { usage: e.target.value as LandUsageType })}
                  >
                    {LAND_USAGES.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </td>
                <td className="p-1 border border-gray-300">
                  <input
                    type="text"
                    className={`${inputCls} min-w-[120px]`}
                    value={land.tenantName || ''}
                    onChange={e => updateAsset('lands', land.id, { tenantName: e.target.value })}
                  />
                </td>
                <td className="p-1 border border-gray-300">
                  <input
                    type="number"
                    step="0.01"
                    className={`${inputNumCls} min-w-[100px]`}
                    value={land.borrowingRightRatio || ''}
                    onChange={e => updateAsset('lands', land.id, { borrowingRightRatio: Number(e.target.value) })}
                  />
                </td>
                <td className="p-1 border border-gray-300">
                  <input
                    type="text"
                    className={`${inputCls} min-w-[120px]`}
                    value={land.sideTwoRoads || ''}
                    onChange={e => updateAsset('lands', land.id, { sideTwoRoads: e.target.value })}
                  />
                </td>
                <td className="p-1 border border-gray-300">
                  <input
                    type="text"
                    className={`${inputCls} min-w-[120px]`}
                    value={land.cityPlanningZone || ''}
                    onChange={e => updateAsset('lands', land.id, { cityPlanningZone: e.target.value })}
                  />
                </td>
                {/* Combined 備考/確認: note (top) + confirmationNote (bottom) */}
                <td className="p-1 border border-gray-300 min-w-[200px]">
                  <input
                    type="text"
                    className={`${inputCls} min-w-[180px]`}
                    value={land.note}
                    placeholder="備考"
                    onChange={e => updateAsset('lands', land.id, { note: e.target.value })}
                  />
                  <input
                    type="text"
                    className={`${inputCls} mt-0.5 min-w-[180px]`}
                    value={land.confirmationNote || ''}
                    placeholder="確認すること"
                    onChange={e => updateAsset('lands', land.id, { confirmationNote: e.target.value })}
                  />
                </td>
                <td className="p-1 text-center border border-gray-300">
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
                <td colSpan={16} className="p-6 text-center text-gray-500 border border-gray-300">
                  土地が登録されていません。「追加」ボタンから登録してください。
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 font-semibold bg-gray-100">
              <td
                colSpan={2}
                className="p-2 text-right border border-gray-300 sticky z-20 bg-gray-100"
                style={{ left: STICKY_NO_LEFT }}
              >
                評価額合計
              </td>
              <td className="p-2 text-right border border-gray-300" colSpan={13}>{formatCurrency(total)}</td>
              <td className="p-2 border border-gray-300"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
