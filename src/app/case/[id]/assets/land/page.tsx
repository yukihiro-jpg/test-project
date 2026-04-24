'use client';

import React from 'react';
import { useCaseStore } from '@/lib/store/case-store';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/components/common/currency-input';
import { calculateLandValue, calculateLandValueBeforeSpecial, calculateSmallLandReduction } from '@/lib/tax/asset-valuation';
import type { LandCategory, EvaluationMethod, SpecialLandUseType, LandUsageType, BuildingAsset, LandAsset } from '@/types';
import { Plus, Trash2, ChevronDown, ChevronRight, AlertTriangle, Check } from 'lucide-react';
import { useState } from 'react';

const LAND_CATEGORIES: LandCategory[] = ['宅地', '田', '畑', '山林', '原野', '牧場', '池沼', '鉱泉地', '雑種地'];
const LAND_USAGES: LandUsageType[] = ['自用', '貸家建付地', '貸地', '借地', '私道', '使用貸借'];
const EVALUATION_AREAS = ['路線価', '倍率'];

const CITY_PLANNING_ZONES = [
  '', '市街化区域', '市街化調整区域', '非線引き区域', '都市計画区域外',
];

const YOTO_CHIIKI = [
  '', '第1種低層住居専用', '第2種低層住居専用', '第1種中高層住居専用', '第2種中高層住居専用',
  '第1種住居', '第2種住居', '準住居', '田園住居',
  '近隣商業', '商業', '準工業', '工業', '工業専用',
  '調整区域',
];

const inputCls = 'w-full border border-gray-300 rounded px-1.5 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500';
const inputNumCls = 'w-full border border-gray-300 rounded px-1.5 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500';

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

const STICKY_NO_LEFT = 0;
const STICKY_CHIBAN_LEFT = 48;

function formatNumber(n: number | undefined | null): string {
  if (n === undefined || n === null || n === 0) return '';
  return n.toLocaleString('ja-JP');
}

function parseFormattedNumber(s: string): number {
  return Number(s.replace(/,/g, '')) || 0;
}

function parseOwnershipRatio(ratio: string | undefined): { numerator: string; denominator: string } {
  if (!ratio || !ratio.includes('/')) return { numerator: ratio || '1', denominator: '1' };
  const [n, d] = ratio.split('/');
  return { numerator: n.trim(), denominator: d.trim() };
}

function calculateRentalLandReduction(land: LandAsset, buildings: BuildingAsset[], referenceDate: string): { reducedValue: number; formula: string } | null {
  if (!land.linkedBuildingId) return null;
  const building = buildings.find(b => b.id === land.linkedBuildingId);
  if (!building || !building.rentalReduction) return null;

  const baseValue = calculateLandValue(land);
  const borrowingRight = land.borrowingRightRatio || 0.6; // default 60%
  const tenantRight = building.borrowedHouseRatio || 0.3; // default 30%

  // Calculate rental ratio from rooms
  const rooms = building.rooms || [];
  const totalArea = rooms.reduce((s, r) => s + (r.area || 0), 0);
  const month = new Date(referenceDate).getMonth();
  const MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'] as const;
  const taxableArea = rooms.reduce((s, r) => {
    return s + (r.occupancy?.[MONTHS[month]] ? r.area : 0);
  }, 0);
  const rentalRatio = totalArea > 0 ? taxableArea / totalArea : 1;

  const reduction = borrowingRight * tenantRight * rentalRatio;
  const reducedValue = Math.floor(baseValue * (1 - reduction));
  const formula = `${baseValue.toLocaleString()} × (1 - ${borrowingRight} × ${tenantRight} × ${(rentalRatio * 100).toFixed(0)}%) = ${reducedValue.toLocaleString()}`;

  return { reducedValue, formula };
}

// 小規模宅地等の区分設定
const SPECIAL_LAND_CONFIGS: Record<SpecialLandUseType, { label: string; rate: number; maxArea: number; desc: string; requirements: string[] }> = {
  residence: {
    label: '特定居住用宅地等',
    rate: 0.8, maxArea: 330,
    desc: '被相続人の自宅の敷地（80%減額、330㎡まで）',
    requirements: [
      '配偶者が取得 → 無条件で適用可',
      '同居親族が取得 → 相続開始前から同居＋申告期限まで居住・保有',
      '別居親族が取得 → 家なき子特例（条件厳格）',
    ],
  },
  business: {
    label: '特定事業用宅地等',
    rate: 0.8, maxArea: 400,
    desc: '被相続人の事業用の敷地（80%減額、400㎡まで）',
    requirements: [
      '親族が事業を承継し、申告期限まで事業継続＋保有',
      '不動産貸付業は対象外（貸付事業用宅地に該当）',
    ],
  },
  rental: {
    label: '貸付事業用宅地等',
    rate: 0.5, maxArea: 200,
    desc: '被相続人の賃貸不動産の敷地（50%減額、200㎡まで）',
    requirements: [
      '親族が貸付事業を承継し、申告期限まで事業継続＋保有',
      '相続開始前3年以内に新たに貸付開始した場合は対象外（例外あり）',
    ],
  },
};

export default function LandPage() {
  const currentCase = useCaseStore(s => s.getCurrentCase());
  const addAsset = useCaseStore(s => s.addAsset);
  const updateAsset = useCaseStore(s => s.updateAsset);
  const removeAsset = useCaseStore(s => s.removeAsset);
  const [expandedSpecialId, setExpandedSpecialId] = useState<string | null>(null);

  if (!currentCase) return <p className="text-gray-500">案件を選択してください</p>;

  const lands = currentCase.assets.lands;
  const buildings = currentCase.assets.buildings || [];
  const referenceDate = currentCase.referenceDate;
  const getLinkedBuilding = (land: any) => land.linkedBuildingId ? buildings.find((b: any) => b.id === land.linkedBuildingId) : undefined;
  const total = lands.reduce((sum, land) => sum + calculateLandValue(land, getLinkedBuilding(land), referenceDate), 0);

  const handleAdd = () => {
    addAsset('lands', {
      location: '', landNumber: '', referenceNote: '',
      ownershipRatio: '1/1',
      landCategory: '宅地' as LandCategory,
      registeredCategory: '宅地', taxCategory: '宅地', currentStatus: '',
      area: 0, registeredArea: 0, taxArea: 0,
      evaluationMethod: 'rosenka' as EvaluationMethod,
      rosenkaPrice: 0, landShape: defaultLandShape(),
      fixedAssetTaxValue: 0, multiplier: 1, evaluationArea: '路線価',
      usage: '自用' as LandUsageType, tenantName: '',
      borrowingRightRatio: 0, sideTwoRoads: '', cityPlanningZone: '',
      useSpecialLand: false, specialUse: defaultSpecialUse(),
      note: '', confirmationNote: '',
    });
  };

  const rowBg = (i: number) => (i % 2 === 0 ? 'white' : '#f9fafb');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">土地</h1>
        <Button onClick={handleAdd}><Plus size={18} className="mr-2" />追加</Button>
      </div>

      <div className="overflow-x-auto border border-gray-300 rounded-lg">
        <table className="text-sm border-collapse w-max">
          <thead>
            <tr className="bg-gray-100 border-b">
              <th className="p-1 text-center w-12 border border-gray-300 sticky z-20 bg-gray-100" style={{ left: STICKY_NO_LEFT }}>No</th>
              <th className="p-1 text-left min-w-[260px] border border-gray-300 sticky z-20 bg-gray-100 border-r-2 border-r-gray-400 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)]" style={{ left: STICKY_CHIBAN_LEFT }}>地番・参照備考</th>
              <th className="p-1 text-center border border-gray-300" style={{ width: '70px' }}>
                <div className="text-xs">持分</div>
                <div className="text-xs font-normal text-gray-400">分子/分母</div>
              </th>
              <th className="p-1 text-center border border-gray-300" style={{ width: '90px' }}>
                <div>地目</div>
                <div className="text-xs font-normal text-gray-500">登記/課税</div>
              </th>
              <th className="p-1 text-left border border-gray-300" style={{ width: '130px' }}>現況確認</th>
              <th className="p-1 text-center border border-gray-300" style={{ width: '120px' }}>
                <div>地積(㎡)</div>
                <div className="text-xs font-normal text-gray-500">登記/課税</div>
              </th>
              <th className="p-1 text-right border border-gray-300" style={{ width: '130px' }}>固定資産税評価額</th>
              <th className="p-1 text-center border border-gray-300" style={{ width: '70px' }}>路/倍</th>
              <th className="p-1 text-right border border-gray-300" style={{ width: '100px' }}>路線価/倍率</th>
              <th className="p-1 text-center border border-gray-300" style={{ width: '100px' }}>自用/貸地/借地</th>
              <th className="p-1 text-left border border-gray-300" style={{ width: '130px' }}>
                <div>借主/貸主</div>
              </th>
              <th className="p-1 text-right border border-gray-300" style={{ width: '80px' }}>借地権割合</th>
              <th className="p-1 text-left border border-gray-300" style={{ width: '120px' }}>側方・二方</th>
              <th className="p-1 text-center border border-gray-300" style={{ width: '120px' }}>都市計画区分</th>
              <th className="p-1 text-center border border-gray-300" style={{ width: '130px' }}>用途地域</th>
              <th className="p-1 text-center border border-gray-300" style={{ width: '130px' }}>紐づけ建物</th>
              <th className="p-1 text-center border border-gray-300" style={{ width: '130px' }}>相続税評価額</th>
              <th className="p-1 text-center border border-gray-300" style={{ width: '160px' }}>
                <div>小規模宅地等</div>
                <div className="text-xs font-normal text-gray-500">適用後評価額</div>
              </th>
              <th className="p-1 text-left border border-gray-300" style={{ width: '180px' }}>備考/確認</th>
              <th className="p-1 text-center w-10 border border-gray-300"></th>
            </tr>
          </thead>
          <tbody>
            {lands.map((land, i) => {
              const { numerator, denominator } = parseOwnershipRatio(land.ownershipRatio);
              const isBorrowed = land.usage === '借地';
              const isSpecialExpanded = expandedSpecialId === land.id;
              return (
                <React.Fragment key={land.id}>
                <tr className="border-b">
                  {/* Sticky: No */}
                  <td className="p-1 text-center border border-gray-300 sticky z-10" style={{ left: STICKY_NO_LEFT, background: rowBg(i) }}>{i + 1}</td>
                  {/* Sticky: 地番 */}
                  <td className="p-1 border border-gray-300 sticky z-10 border-r-2 border-r-gray-400 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)]" style={{ left: STICKY_CHIBAN_LEFT, background: rowBg(i) }}>
                    <input type="text" className={inputCls} value={`${land.location} ${land.landNumber || ''}`.trim()}
                      placeholder="所在地・地番"
                      onChange={e => {
                        const val = e.target.value;
                        updateAsset('lands', land.id, { location: val, landNumber: '' });
                      }} />
                    <input type="text" className={`${inputCls} mt-0.5`} value={land.referenceNote || ''} placeholder="参照備考"
                      onChange={e => updateAsset('lands', land.id, { referenceNote: e.target.value })} />
                  </td>
                  {/* 持分: 分子/分母 */}
                  <td className="p-1 border border-gray-300">
                    <div className="flex items-center justify-center gap-0.5">
                      <input type="text" className="border border-gray-300 rounded px-1 py-1 text-sm text-center w-8"
                        value={numerator}
                        onChange={e => updateAsset('lands', land.id, { ownershipRatio: `${e.target.value}/${denominator}` })} />
                      <span className="text-gray-400 text-xs">/</span>
                      <input type="text" className="border border-gray-300 rounded px-1 py-1 text-sm text-center w-8"
                        value={denominator}
                        onChange={e => updateAsset('lands', land.id, { ownershipRatio: `${numerator}/${e.target.value}` })} />
                    </div>
                  </td>
                  {/* 地目: 登記/課税 */}
                  <td className="p-1 border border-gray-300">
                    <div className="flex items-center gap-0.5">
                      <span className="text-xs text-gray-400 shrink-0">登</span>
                      <select className="border border-gray-300 rounded px-0.5 py-1 text-sm w-full"
                        value={land.registeredCategory || '宅地'}
                        onChange={e => updateAsset('lands', land.id, { registeredCategory: e.target.value })}>
                        {LAND_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="flex items-center gap-0.5 mt-0.5">
                      <span className="text-xs text-gray-400 shrink-0">課</span>
                      <select className="border border-gray-300 rounded px-0.5 py-1 text-sm w-full"
                        value={land.taxCategory || '宅地'}
                        onChange={e => updateAsset('lands', land.id, { taxCategory: e.target.value })}>
                        {LAND_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </td>
                  {/* 現況確認 */}
                  <td className="p-1 border border-gray-300">
                    <input type="text" className={inputCls} value={land.currentStatus || ''}
                      onChange={e => updateAsset('lands', land.id, { currentStatus: e.target.value })} />
                  </td>
                  {/* 地積: 登記/課税 ㎡表示 */}
                  <td className="p-1 border border-gray-300">
                    <div className="flex items-center gap-0.5">
                      <span className="text-xs text-gray-400 shrink-0">登</span>
                      <input type="text" className={`${inputNumCls} w-20`}
                        value={land.registeredArea ? land.registeredArea.toLocaleString('ja-JP', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : ''}
                        placeholder="0.00"
                        onChange={e => updateAsset('lands', land.id, { registeredArea: parseFormattedNumber(e.target.value) })} />
                      <span className="text-xs text-gray-400 shrink-0">㎡</span>
                    </div>
                    <div className="flex items-center gap-0.5 mt-0.5">
                      <span className="text-xs text-gray-400 shrink-0">課</span>
                      <input type="text" className={`${inputNumCls} w-20`}
                        value={land.taxArea ? land.taxArea.toLocaleString('ja-JP', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : ''}
                        placeholder="0.00"
                        onChange={e => updateAsset('lands', land.id, { taxArea: parseFormattedNumber(e.target.value) })} />
                      <span className="text-xs text-gray-400 shrink-0">㎡</span>
                    </div>
                  </td>
                  {/* 固定資産税評価額 #,### */}
                  <td className="p-1 border border-gray-300">
                    <input type="text" className={inputNumCls}
                      value={formatNumber(land.fixedAssetTaxValue)}
                      onChange={e => updateAsset('lands', land.id, { fixedAssetTaxValue: parseFormattedNumber(e.target.value) })} />
                  </td>
                  {/* 路/倍 */}
                  <td className="p-1 border border-gray-300">
                    <select className="border border-gray-300 rounded px-0.5 py-1 text-sm w-full"
                      value={land.evaluationArea || '路線価'}
                      onChange={e => {
                        const val = e.target.value;
                        updateAsset('lands', land.id, {
                          evaluationArea: val,
                          evaluationMethod: (val === '倍率' ? 'bairitsu' : 'rosenka') as EvaluationMethod,
                        });
                      }}>
                      {EVALUATION_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </td>
                  {/* 路線価/倍率 */}
                  <td className="p-1 border border-gray-300">
                    {land.evaluationArea === '倍率' ? (
                      <input type="text" className={inputNumCls}
                        value={land.multiplier ?? ''}
                        placeholder="1.0"
                        onChange={e => {
                          const v = e.target.value;
                          // 小数点入力中の中間状態も許容
                          updateAsset('lands', land.id, { multiplier: v as any });
                        }}
                        onBlur={e => {
                          const parsed = parseFloat(e.target.value);
                          updateAsset('lands', land.id, { multiplier: isNaN(parsed) ? 1 : parsed });
                        }} />
                    ) : (
                      <input type="text" className={inputNumCls}
                        value={formatNumber(land.rosenkaPrice)}
                        onChange={e => updateAsset('lands', land.id, { rosenkaPrice: parseFormattedNumber(e.target.value) })} />
                    )}
                  </td>
                  {/* 自用/貸地/借地 */}
                  <td className="p-1 border border-gray-300">
                    <select className="border border-gray-300 rounded px-0.5 py-1 text-sm w-full"
                      value={land.usage || '自用'}
                      onChange={e => updateAsset('lands', land.id, { usage: e.target.value as LandUsageType })}>
                      <option value="自用">自用地</option>
                      <option value="貸地">貸地</option>
                      <option value="借地">借地</option>
                      <option value="使用貸借">使用貸借</option>
                      <option value="貸家建付地">貸家建付地</option>
                      <option value="私道">私道</option>
                    </select>
                  </td>
                  {/* 借主/貸主 */}
                  <td className="p-1 border border-gray-300">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-400 shrink-0">{isBorrowed ? '貸主' : '借主'}</span>
                      <input type="text" className={inputCls}
                        value={land.tenantName || ''}
                        placeholder={isBorrowed ? '貸主名' : '借主名'}
                        onChange={e => updateAsset('lands', land.id, { tenantName: e.target.value })} />
                    </div>
                  </td>
                  {/* 借地権割合 */}
                  <td className="p-1 border border-gray-300">
                    <input type="text" className={inputNumCls}
                      value={land.borrowingRightRatio ?? ''}
                      onChange={e => updateAsset('lands', land.id, { borrowingRightRatio: e.target.value as any })}
                      onBlur={e => {
                        const v = parseFloat(e.target.value);
                        updateAsset('lands', land.id, { borrowingRightRatio: isNaN(v) ? 0 : v });
                      }} />
                  </td>
                  {/* 側方・二方 */}
                  <td className="p-1 border border-gray-300">
                    <input type="text" className={inputCls} value={land.sideTwoRoads || ''}
                      onChange={e => updateAsset('lands', land.id, { sideTwoRoads: e.target.value })} />
                  </td>
                  {/* 都市計画区分 */}
                  <td className="p-1 border border-gray-300">
                    <select className={inputCls} value={land.cityPlanningZone || ''}
                      onChange={e => {
                        const zone = e.target.value;
                        const updates: any = { cityPlanningZone: zone };
                        if (zone === '市街化調整区域') {
                          updates.usageZone = '調整区域';
                        }
                        updateAsset('lands', land.id, updates);
                      }}>
                      {CITY_PLANNING_ZONES.map(z => <option key={z} value={z}>{z || '選択'}</option>)}
                    </select>
                  </td>
                  {/* 用途地域 */}
                  <td className="p-1 border border-gray-300">
                    <select className={inputCls} value={land.usageZone || ''}
                      onChange={e => updateAsset('lands', land.id, { usageZone: e.target.value })}>
                      {YOTO_CHIIKI.map(z => <option key={z} value={z}>{z || '選択'}</option>)}
                    </select>
                  </td>
                  {/* 紐づけ建物 */}
                  <td className="p-1 border border-gray-300">
                    <select className="border border-gray-300 rounded px-0.5 py-1 text-sm w-full"
                      value={land.linkedBuildingId || ''}
                      onChange={e => {
                        const selectedId = e.target.value || undefined;
                        const updates: Record<string, unknown> = { linkedBuildingId: selectedId };
                        if (selectedId) {
                          const selectedBuilding = buildings.find(b => b.id === selectedId);
                          if (selectedBuilding?.rentalReduction) {
                            updates.usage = '貸家建付地';
                          }
                        }
                        updateAsset('lands', land.id, updates);
                      }}>
                      <option value="">なし</option>
                      {buildings.map(b => (
                        <option key={b.id} value={b.id}>{b.name || b.location || '建物'}</option>
                      ))}
                    </select>
                    {(() => {
                      const reduction = calculateRentalLandReduction(land, buildings, referenceDate);
                      if (!reduction) return null;
                      return (
                        <div className="mt-0.5 text-xs text-blue-700 leading-tight">
                          貸家建付地: {reduction.formula}
                        </div>
                      );
                    })()}
                  </td>
                  {/* 相続税評価額（小規模宅地適用前） */}
                  {(() => {
                    const lb = getLinkedBuilding(land);
                    const before = calculateLandValueBeforeSpecial(land, lb, referenceDate);
                    const reduction = calculateSmallLandReduction(land, before);
                    const after = Math.max(0, before - reduction);
                    const isExpanded = expandedSpecialId === land.id;
                    return (
                      <>
                        <td className="p-1 border border-gray-300 text-right font-medium">
                          {formatCurrency(before)}
                        </td>
                        <td className="p-1 border border-gray-300">
                          <div className="flex flex-col items-end gap-0.5">
                            {land.useSpecialLand ? (
                              <>
                                <span className="text-right font-bold text-green-700">{formatCurrency(after)}</span>
                                <span className="text-xs text-red-600">▲{formatCurrency(reduction)}</span>
                                <span className="text-xs text-gray-500">
                                  {SPECIAL_LAND_CONFIGS[land.specialUse?.type || 'residence']?.label}
                                </span>
                              </>
                            ) : (
                              <span className="text-xs text-gray-400">未適用</span>
                            )}
                            <button
                              type="button"
                              onClick={() => setExpandedSpecialId(isExpanded ? null : land.id)}
                              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-0.5"
                            >
                              {isExpanded ? <ChevronDown size={10}/> : <ChevronRight size={10}/>}
                              {land.useSpecialLand ? '設定変更' : '特例を適用'}
                            </button>
                          </div>
                        </td>
                      </>
                    );
                  })()}
                  {/* 備考/確認 */}
                  <td className="p-1 border border-gray-300">
                    <input type="text" className={inputCls} value={land.note} placeholder="備考"
                      onChange={e => updateAsset('lands', land.id, { note: e.target.value })} />
                    <input type="text" className={`${inputCls} mt-0.5`} value={land.confirmationNote || ''} placeholder="確認事項"
                      onChange={e => updateAsset('lands', land.id, { confirmationNote: e.target.value })} />
                  </td>
                  {/* 削除 */}
                  <td className="p-1 border border-gray-300 text-center">
                    <button onClick={() => removeAsset('lands', land.id)} className="text-red-500 hover:text-red-700">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
                {/* 小規模宅地等の設定パネル */}
                {isSpecialExpanded && (
                  <tr>
                    <td colSpan={20} className="p-0">
                      <div className="px-4 py-3 bg-yellow-50 border-l-4 border-yellow-400 space-y-3">
                        <div className="flex items-center gap-2">
                          <input type="checkbox" checked={land.useSpecialLand || false}
                            onChange={e => updateAsset('lands', land.id, { useSpecialLand: e.target.checked })}
                            className="w-4 h-4" />
                          <span className="font-medium text-sm">小規模宅地等の特例を適用する</span>
                        </div>
                        {land.useSpecialLand && (
                          <div className="space-y-3">
                            {/* 区分選択 */}
                            <div className="grid grid-cols-3 gap-2">
                              {(Object.entries(SPECIAL_LAND_CONFIGS) as [SpecialLandUseType, typeof SPECIAL_LAND_CONFIGS['residence']][]).map(([key, cfg]) => {
                                const selected = (land.specialUse?.type || 'residence') === key;
                                return (
                                  <button key={key} type="button"
                                    onClick={() => updateAsset('lands', land.id, {
                                      specialUse: { ...land.specialUse, type: key, reductionRate: cfg.rate, maxArea: cfg.maxArea, applicableArea: land.specialUse?.applicableArea || land.area || 0 },
                                    })}
                                    className={`p-2 rounded border text-left text-xs ${selected ? 'border-yellow-500 bg-yellow-100' : 'border-gray-300 bg-white hover:bg-gray-50'}`}
                                  >
                                    <div className="font-bold">{cfg.label}</div>
                                    <div className="text-gray-600">{cfg.desc}</div>
                                    <div className="mt-1 text-blue-700 font-medium">{cfg.rate * 100}%減額 / 上限{cfg.maxArea}㎡</div>
                                  </button>
                                );
                              })}
                            </div>
                            {/* 適用面積 */}
                            {(() => {
                              const cfg = SPECIAL_LAND_CONFIGS[land.specialUse?.type || 'residence'];
                              const area = land.area || land.registeredArea || 0;
                              const applicableArea = land.specialUse?.applicableArea || area;
                              const maxArea = cfg.maxArea;
                              const isOverMax = applicableArea > maxArea;
                              return (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-3 text-sm">
                                    <span className="text-gray-700">適用面積:</span>
                                    <input type="text" className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-right"
                                      value={land.specialUse?.applicableArea ?? area}
                                      onChange={e => updateAsset('lands', land.id, {
                                        specialUse: { ...land.specialUse, applicableArea: e.target.value as any },
                                      })}
                                      onBlur={e => {
                                        const v = parseFloat(e.target.value);
                                        updateAsset('lands', land.id, {
                                          specialUse: { ...land.specialUse, applicableArea: isNaN(v) ? area : v },
                                        });
                                      }}
                                    />
                                    <span className="text-gray-500">㎡</span>
                                    <span className="text-gray-500">/ 上限 {maxArea}㎡</span>
                                    {isOverMax && (
                                      <span className="text-red-600 text-xs flex items-center gap-1">
                                        <AlertTriangle size={12} />上限超過（{maxArea}㎡まで適用）
                                      </span>
                                    )}
                                  </div>
                                  {/* 要件チェックリスト */}
                                  <div className="bg-white rounded border border-gray-200 p-2">
                                    <div className="text-xs font-medium text-gray-700 mb-1">適用要件（確認用）:</div>
                                    {cfg.requirements.map((req, ri) => (
                                      <div key={ri} className="text-xs text-gray-600 flex items-start gap-1 py-0.5">
                                        <Check size={10} className="mt-0.5 text-green-600 shrink-0" />
                                        {req}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
                </React.Fragment>
              );
            })}
            {lands.length === 0 && (
              <tr><td colSpan={20} className="p-4 text-center text-gray-400">土地が登録されていません</td></tr>
            )}
          </tbody>
          <tfoot>
            <tr className="bg-gray-100 font-semibold border-t-2">
              <td className="p-1 border border-gray-300 sticky z-10 bg-gray-100" style={{ left: STICKY_NO_LEFT }}></td>
              <td className="p-1 border border-gray-300 text-right sticky z-10 bg-gray-100 border-r-2 border-r-gray-400" style={{ left: STICKY_CHIBAN_LEFT }}>評価額合計</td>
              <td colSpan={17} className="p-1 border border-gray-300"></td>
              <td className="p-1 border border-gray-300 text-right">{formatCurrency(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
