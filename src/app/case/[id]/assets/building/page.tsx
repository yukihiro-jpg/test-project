'use client';

import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useCaseStore } from '@/lib/store/case-store';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/components/common/currency-input';
import { calculateBuildingValue } from '@/lib/tax/asset-valuation';
import type { BuildingAsset, BuildingRoom, RoomOccupancy } from '@/types';
import { Plus, Trash2, ChevronDown, ChevronRight, Check, Link2 } from 'lucide-react';

// ── helpers ──────────────────────────────────────────────────

function formatNum(n: number | undefined | null): string {
  if (!n) return '';
  return n.toLocaleString('ja-JP');
}

function parseNum(s: string): number {
  return Number(s.replace(/,/g, '')) || 0;
}

function parseOwnershipRatio(ratio: string | undefined): { numerator: string; denominator: string } {
  if (!ratio || !ratio.includes('/')) return { numerator: ratio || '1', denominator: '1' };
  const [n, d] = ratio.split('/');
  return { numerator: n.trim(), denominator: d.trim() };
}

const MONTH_KEYS = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
] as const;
type MonthKey = typeof MONTH_KEYS[number];

const MONTH_LABELS: Record<MonthKey, string> = {
  jan: '1', feb: '2', mar: '3', apr: '4', may: '5', jun: '6',
  jul: '7', aug: '8', sep: '9', oct: '10', nov: '11', dec: '12',
};

function allMonthsOccupied(): RoomOccupancy {
  return {
    jan: true, feb: true, mar: true, apr: true, may: true, jun: true,
    jul: true, aug: true, sep: true, oct: true, nov: true, dec: true,
  };
}

function isOccupiedAtReference(occupancy: RoomOccupancy, referenceDate: string): boolean {
  const month = new Date(referenceDate).getMonth(); // 0-11
  return occupancy[MONTH_KEYS[month]];
}

function getTaxableRentalArea(room: BuildingRoom, referenceDate: string): number {
  return isOccupiedAtReference(room.occupancy, referenceDate) ? room.area : 0;
}

// ── style constants ──────────────────────────────────────────

const inputCls = 'border border-gray-300 rounded px-1.5 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500';
const inputNumCls = `${inputCls} text-right`;

// ── component ────────────────────────────────────────────────

export default function BuildingPage() {
  const currentCase = useCaseStore(s => s.getCurrentCase());
  const addAsset = useCaseStore(s => s.addAsset);
  const updateAsset = useCaseStore(s => s.updateAsset);
  const removeAsset = useCaseStore(s => s.removeAsset);

  const [expandedRentalId, setExpandedRentalId] = useState<string | null>(null);

  if (!currentCase) return <p className="text-gray-500">案件を選択してください</p>;

  const buildings = currentCase.assets.buildings;
  const debts = currentCase.assets.debts;
  const referenceDate = currentCase.referenceDate;
  const total = buildings.reduce((sum, b) => sum + calculateBuildingValue(b), 0);

  // ── handlers ─────────────────────────────────────────────

  const handleAdd = () => {
    addAsset('buildings', {
      location: '',
      structureType: '',
      usage: '自用',
      fixedAssetTaxValue: 0,
      rentalReduction: false,
      borrowedHouseRatio: 0.3,
      ownershipRatio: '1/1',
      registrationStatus: 'registered',
      note: '',
    });
  };

  const addRoom = (b: BuildingAsset) => {
    const newRoom: BuildingRoom = {
      id: uuidv4(),
      roomNumber: '',
      tenantName: '',
      area: 0,
      occupancy: allMonthsOccupied(),
      deposit: 0,
      note: '',
    };
    updateAsset('buildings', b.id, { rooms: [...(b.rooms ?? []), newRoom] });
  };

  const updateRoom = (b: BuildingAsset, roomId: string, updates: Partial<BuildingRoom>) => {
    const rooms = (b.rooms ?? []).map(r => r.id === roomId ? { ...r, ...updates } : r);
    updateAsset('buildings', b.id, { rooms });
  };

  const removeRoom = (b: BuildingAsset, roomId: string) => {
    const rooms = (b.rooms ?? []).filter(r => r.id !== roomId);
    updateAsset('buildings', b.id, { rooms });
  };

  const toggleMonth = (b: BuildingAsset, room: BuildingRoom, month: MonthKey) => {
    const newOccupancy = { ...room.occupancy, [month]: !room.occupancy[month] };
    updateRoom(b, room.id, { occupancy: newOccupancy });
  };

  const toggleRentalExpand = (id: string) => {
    setExpandedRentalId(expandedRentalId === id ? null : id);
  };

  // ── deposit sync to debts ────────────────────────────────

  const syncDepositToDebt = (b: BuildingAsset) => {
    const rooms = b.rooms ?? [];
    const totalDeposit = rooms.reduce((sum, r) => sum + (r.deposit || 0), 0);
    if (totalDeposit === 0) return;

    const buildingName = b.name || b.location || '建物';
    const firstRoom = rooms.find(r => (r.deposit || 0) > 0);
    const firstRoomNumber = firstRoom?.roomNumber || '?';
    const firstTenantName = firstRoom?.tenantName || '?';
    const creditor = `${buildingName}_${firstRoomNumber}+${firstTenantName}他`;
    const autoNote = `[自動連動] ${buildingName}の預り敷金`;

    // Find existing auto-synced debt for this building
    const existingDebt = debts.find(d => d.note?.startsWith(`[自動連動] ${buildingName}`));

    if (existingDebt) {
      updateAsset('debts', existingDebt.id, {
        creditor,
        description: '預り敷金（自動連動）',
        amount: totalDeposit,
        note: autoNote,
      });
    } else {
      addAsset('debts', {
        creditor,
        description: '預り敷金（自動連動）',
        amount: totalDeposit,
        note: autoNote,
      });
    }
  };

  // ── render ───────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">建物</h1>
        <Button onClick={handleAdd}><Plus size={18} className="mr-2" />追加</Button>
      </div>

      <div className="overflow-x-auto border border-gray-300 rounded-lg">
        <table className="text-sm border-collapse w-max">
          <thead>
            <tr className="bg-gray-100 border-b">
              <th className="p-1 text-center w-10 border border-gray-300 sticky left-0 z-10 bg-gray-100">No</th>
              <th className="p-1 text-center border border-gray-300 sticky left-[40px] z-10 bg-gray-100 border-r-2 border-r-gray-400 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)]" style={{ minWidth: '140px' }}>所在地</th>
              <th className="p-1 text-center border border-gray-300" style={{ minWidth: '80px' }}>家屋番号</th>
              <th className="p-1 text-center border border-gray-300" style={{ width: '70px' }}>登記状況</th>
              <th className="p-1 text-center border border-gray-300" style={{ width: '65px' }}>
                <div className="text-xs">持分</div>
              </th>
              <th className="p-1 text-center border border-gray-300" style={{ minWidth: '70px' }}>構造</th>
              <th className="p-1 text-center border border-gray-300" style={{ minWidth: '60px' }}>用途</th>
              <th className="p-1 text-center border border-gray-300" style={{ minWidth: '100px' }}>
                <div>床面積</div>
                <div className="text-xs font-normal text-gray-400">階数・各階㎡</div>
              </th>
              <th className="p-1 text-center border border-gray-300" style={{ minWidth: '120px' }}>固定資産税評価額</th>
              <th className="p-1 text-center border border-gray-300" style={{ width: '80px' }}>貸家</th>
              <th className="p-1 text-center border border-gray-300" style={{ minWidth: '140px' }}>
                <div>相続税評価額</div>
                <div className="text-xs font-normal text-gray-400">貸家: ×(1-借家権割合)</div>
              </th>
              <th className="p-1 text-center border border-gray-300 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {buildings.map((b, i) => {
              const value = calculateBuildingValue(b);
              const rooms = b.rooms ?? [];
              const totalArea = rooms.reduce((s, r) => s + (r.area || 0), 0);
              const totalTaxableRental = rooms.reduce(
                (s, r) => s + getTaxableRentalArea(r, referenceDate),
                0,
              );
              const rentalRatio = totalArea > 0 ? (totalTaxableRental / totalArea) * 100 : 0;
              const totalDeposit = rooms.reduce((s, r) => s + (r.deposit || 0), 0);
              const { numerator, denominator } = parseOwnershipRatio(b.ownershipRatio);
              const isRentalExpanded = expandedRentalId === b.id;

              return (
                <React.Fragment key={b.id}>
                  {/* Main inline row */}
                  <tr className={`border-b ${i % 2 === 0 ? '' : 'bg-gray-50'}`}>
                    <td className={`p-1 text-center border border-gray-300 sticky left-0 z-10 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>{i + 1}</td>
                    {/* 所在地 */}
                    <td className={`p-1 border border-gray-300 sticky left-[40px] z-10 border-r-2 border-r-gray-400 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)] ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      <input type="text" className={`${inputCls} w-full`} value={b.location} placeholder="所在地"
                        onChange={e => updateAsset('buildings', b.id, { location: e.target.value })} />
                    </td>
                    {/* 家屋番号 */}
                    <td className="p-1 border border-gray-300">
                      <input type="text" className={`${inputCls} w-full`} value={b.houseNumber || ''} placeholder="家屋番号"
                        onChange={e => updateAsset('buildings', b.id, { houseNumber: e.target.value })} />
                    </td>
                    {/* 登記状況 */}
                    <td className="p-1 border border-gray-300">
                      <select className="border border-gray-300 rounded px-0.5 py-1 text-sm w-full"
                        value={b.registrationStatus || 'registered'}
                        onChange={e => updateAsset('buildings', b.id, { registrationStatus: e.target.value as 'registered' | 'unregistered' })}>
                        <option value="registered">登記有</option>
                        <option value="unregistered">未登記</option>
                      </select>
                    </td>
                    {/* 持分 */}
                    <td className="p-1 border border-gray-300">
                      <div className="flex items-center justify-center gap-0.5">
                        <input type="text" className="border border-gray-300 rounded px-1 py-1 text-sm text-center w-8"
                          value={numerator}
                          onChange={e => updateAsset('buildings', b.id, { ownershipRatio: `${e.target.value}/${denominator}` })} />
                        <span className="text-gray-400 text-xs">/</span>
                        <input type="text" className="border border-gray-300 rounded px-1 py-1 text-sm text-center w-8"
                          value={denominator}
                          onChange={e => updateAsset('buildings', b.id, { ownershipRatio: `${numerator}/${e.target.value}` })} />
                      </div>
                    </td>
                    {/* 構造 */}
                    <td className="p-1 border border-gray-300">
                      <input type="text" className={`${inputCls} w-full`} value={b.structureType} placeholder="木造/RC等"
                        onChange={e => updateAsset('buildings', b.id, { structureType: e.target.value })} />
                    </td>
                    {/* 用途 */}
                    <td className="p-1 border border-gray-300">
                      <input type="text" className={`${inputCls} w-full`} value={b.usage} placeholder="自用/貸家等"
                        onChange={e => updateAsset('buildings', b.id, { usage: e.target.value })} />
                    </td>
                    {/* 床面積（階数選択＋各階入力） */}
                    <td className="p-1 border border-gray-300">
                      {(() => {
                        const fl = b.floors || 1;
                        const areas = b.floorAreas || [];
                        const totalFloor = areas.reduce((s, a) => s + (a || 0), 0);
                        return (
                          <>
                            <div className="flex items-center gap-1">
                              <select className="border border-gray-300 rounded px-0.5 py-0.5 text-xs w-12"
                                value={fl}
                                onChange={e => {
                                  const newFloors = Number(e.target.value);
                                  const newAreas = Array.from({ length: newFloors }, (_, i) => areas[i] || 0);
                                  updateAsset('buildings', b.id, { floors: newFloors, floorAreas: newAreas });
                                }}>
                                {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}階</option>)}
                              </select>
                              <span className="text-xs text-gray-500 font-medium">{totalFloor > 0 ? `${totalFloor.toLocaleString('ja-JP')}㎡` : ''}</span>
                            </div>
                            {Array.from({ length: fl }).map((_, fi) => (
                              <div key={fi} className="flex items-center gap-0.5 mt-0.5">
                                <span className="text-xs text-gray-400 w-5">{fi+1}F</span>
                                <input type="text" className={`${inputNumCls} w-16`}
                                  value={areas[fi] ? areas[fi].toString() : ''}
                                  placeholder="㎡"
                                  onChange={e => {
                                    const newAreas = [...(b.floorAreas || Array(fl).fill(0))];
                                    newAreas[fi] = parseFloat(e.target.value) || 0;
                                    updateAsset('buildings', b.id, { floorAreas: newAreas });
                                  }} />
                              </div>
                            ))}
                          </>
                        );
                      })()}
                    </td>
                    {/* 固定資産税評価額 */}
                    <td className="p-1 border border-gray-300">
                      <input type="text" className={`${inputNumCls} w-full`}
                        value={formatNum(b.fixedAssetTaxValue)}
                        onChange={e => updateAsset('buildings', b.id, { fixedAssetTaxValue: parseNum(e.target.value) })} />
                    </td>
                    {/* 貸家チェック＋建物名 */}
                    <td className="p-1 border border-gray-300">
                      <div className="flex items-center justify-center">
                        <input type="checkbox" className="w-4 h-4"
                          checked={b.rentalReduction || false}
                          onChange={e => updateAsset('buildings', b.id, { rentalReduction: e.target.checked })} />
                      </div>
                      {b.rentalReduction && (
                        <input type="text" className={`${inputCls} w-full mt-0.5`}
                          value={b.name || ''} placeholder="建物名"
                          onChange={e => updateAsset('buildings', b.id, { name: e.target.value })} />
                      )}
                    </td>
                    {/* 相続税評価額（計算式表示） */}
                    <td className="p-1 border border-gray-300 text-right">
                      <div className="font-medium">{formatCurrency(value)}</div>
                      {b.rentalReduction && (
                        <div className="text-xs text-gray-500 mt-0.5">
                          {formatNum(b.fixedAssetTaxValue)} × (1-
                          <input type="text" className="w-8 border border-gray-300 rounded text-center text-xs mx-0.5"
                            value={b.borrowedHouseRatio}
                            onChange={e => {
                              const v = parseFloat(e.target.value);
                              if (!isNaN(v)) updateAsset('buildings', b.id, { borrowedHouseRatio: v });
                            }} />
                          )
                        </div>
                      )}
                    </td>
                    {/* 削除 */}
                    <td className="p-1 border border-gray-300 text-center">
                      <button
                        onClick={() => removeAsset('buildings', b.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>

                  {/* Rental sub-section (expandable, shown only when 貸家 is checked) */}
                  {b.rentalReduction && (
                    <tr>
                      <td colSpan={12} className="p-0 border border-gray-300">
                        {/* Toggle header */}
                        <div
                          className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 cursor-pointer hover:bg-amber-100 select-none"
                          onClick={() => toggleRentalExpand(b.id)}
                        >
                          {isRentalExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          <span className="text-sm font-semibold text-amber-800">賃貸割合（部屋管理）</span>
                          <span className="text-xs text-gray-600 ml-2">
                            賃貸割合: <span className="font-bold text-amber-800">{rentalRatio.toFixed(2)}%</span>
                          </span>
                          {totalDeposit > 0 && (
                            <span className="text-xs text-gray-600 ml-2">
                              敷金合計: <span className="font-bold">{formatNum(totalDeposit)}円</span>
                            </span>
                          )}
                        </div>

                        {isRentalExpanded && (
                          <div className="px-4 py-2 bg-white border-t border-amber-200 space-y-2">
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs border border-gray-200">
                                <thead>
                                  <tr className="bg-amber-100 border-b">
                                    <th className="p-1 text-center" style={{ minWidth: '70px' }}>部屋番号</th>
                                    <th className="p-1 text-center" style={{ minWidth: '80px' }}>借主</th>
                                    <th className="p-1 text-center" style={{ minWidth: '80px' }}>専有面積(㎡)</th>
                                    <th className="p-1 text-center" style={{ minWidth: '90px' }}>預り敷金</th>
                                    {MONTH_KEYS.map(m => (
                                      <th key={m} className="p-1 text-center w-7" title={`${MONTH_LABELS[m]}月`}>
                                        {MONTH_LABELS[m]}月
                                      </th>
                                    ))}
                                    <th className="p-1 text-center" style={{ minWidth: '70px' }}>賃貸面積</th>
                                    <th className="p-1 text-center" style={{ minWidth: '100px' }}>備考</th>
                                    <th className="p-1 text-center w-8"></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {rooms.map(room => {
                                    const taxableArea = getTaxableRentalArea(room, referenceDate);
                                    return (
                                      <tr key={room.id} className="border-b hover:bg-amber-50/40">
                                        {/* 部屋番号 */}
                                        <td className="p-1">
                                          <input
                                            type="text"
                                            value={room.roomNumber}
                                            onChange={e => updateRoom(b, room.id, { roomNumber: e.target.value })}
                                            className="w-16 border border-gray-300 rounded px-1 py-0.5"
                                          />
                                        </td>
                                        {/* 借主 */}
                                        <td className="p-1">
                                          <input
                                            type="text"
                                            value={room.tenantName}
                                            onChange={e => updateRoom(b, room.id, { tenantName: e.target.value })}
                                            className="w-20 border border-gray-300 rounded px-1 py-0.5"
                                          />
                                        </td>
                                        {/* 専有面積 - text input, empty string when 0 */}
                                        <td className="p-1 text-right">
                                          <input
                                            type="text"
                                            value={room.area ? String(room.area) : ''}
                                            placeholder=""
                                            onChange={e => {
                                              const val = e.target.value;
                                              if (val === '') {
                                                updateRoom(b, room.id, { area: 0 });
                                              } else {
                                                const parsed = parseFloat(val);
                                                if (!isNaN(parsed)) {
                                                  updateRoom(b, room.id, { area: parsed });
                                                }
                                              }
                                            }}
                                            className="w-20 border border-gray-300 rounded px-1 py-0.5 text-right"
                                          />
                                        </td>
                                        {/* 預り敷金 */}
                                        <td className="p-1 text-right">
                                          <input
                                            type="text"
                                            value={formatNum(room.deposit)}
                                            onChange={e => updateRoom(b, room.id, { deposit: parseNum(e.target.value) })}
                                            className="w-24 border border-gray-300 rounded px-1 py-0.5 text-right"
                                          />
                                        </td>
                                        {/* 月別入居 1-12月 */}
                                        {MONTH_KEYS.map(m => {
                                          const checked = room.occupancy[m];
                                          return (
                                            <td key={m} className="p-1 text-center">
                                              <button
                                                type="button"
                                                onClick={() => toggleMonth(b, room, m)}
                                                className={`w-5 h-5 rounded border flex items-center justify-center mx-auto ${
                                                  checked
                                                    ? 'bg-amber-500 border-amber-600 text-white'
                                                    : 'bg-white border-gray-300 text-transparent hover:border-amber-400'
                                                }`}
                                                aria-label={`${MONTH_LABELS[m]}月の入居状況`}
                                                aria-pressed={checked}
                                                title={`${MONTH_LABELS[m]}月: ${checked ? '入居中' : '空室'}`}
                                              >
                                                <Check size={12} />
                                              </button>
                                            </td>
                                          );
                                        })}
                                        {/* 賃貸面積 */}
                                        <td className="p-1 text-right">
                                          {taxableArea ? taxableArea.toFixed(2) : ''}
                                        </td>
                                        {/* 備考 */}
                                        <td className="p-1">
                                          <input
                                            type="text"
                                            value={room.note || ''}
                                            onChange={e => updateRoom(b, room.id, { note: e.target.value })}
                                            placeholder="備考"
                                            className="w-28 border border-gray-300 rounded px-1 py-0.5"
                                          />
                                        </td>
                                        {/* 削除 */}
                                        <td className="p-1 text-center">
                                          <button
                                            type="button"
                                            onClick={() => removeRoom(b, room.id)}
                                            className="text-red-500 hover:text-red-700"
                                            aria-label="部屋を削除"
                                          >
                                            <Trash2 size={12} />
                                          </button>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                  {rooms.length === 0 && (
                                    <tr>
                                      <td colSpan={MONTH_KEYS.length + 7} className="p-2 text-center text-gray-500">
                                        部屋が登録されていません
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                                <tfoot>
                                  <tr className="bg-amber-50 font-semibold border-t">
                                    <td className="p-1 text-right" colSpan={2}>計</td>
                                    <td className="p-1 text-right">{totalArea ? totalArea.toFixed(2) : ''}</td>
                                    <td className="p-1 text-right">{formatNum(totalDeposit)}</td>
                                    <td className="p-1" colSpan={MONTH_KEYS.length}></td>
                                    <td className="p-1 text-right">{totalTaxableRental ? totalTaxableRental.toFixed(2) : ''}</td>
                                    <td className="p-1" colSpan={2}></td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>

                            {/* Bottom controls: add room, deposit sync, stats */}
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => addRoom(b)}
                                  className="text-xs text-amber-700 hover:text-amber-900 border border-amber-300 rounded px-2 py-1 bg-white hover:bg-amber-50 inline-flex items-center"
                                >
                                  <Plus size={12} className="mr-1" />部屋追加
                                </button>
                                {totalDeposit > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => syncDepositToDebt(b)}
                                    className="text-xs text-blue-700 hover:text-blue-900 border border-blue-300 rounded px-2 py-1 bg-white hover:bg-blue-50 inline-flex items-center"
                                  >
                                    <Link2 size={12} className="mr-1" />敷金を債務に連動
                                  </button>
                                )}
                              </div>
                              <div className="text-xs text-gray-600">
                                基準日: {referenceDate} / 課税時期賃貸面積合計: {totalTaxableRental.toFixed(2)}㎡ &divide; 専有面積合計: {totalArea.toFixed(2)}㎡ = <span className="font-bold text-amber-800">{rentalRatio.toFixed(2)}%</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {buildings.length === 0 && (
              <tr>
                <td colSpan={12} className="p-4 text-center text-gray-400">建物が登録されていません</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="bg-gray-100 font-semibold border-t-2">
              <td colSpan={10} className="p-1 border border-gray-300 text-right">評価額合計</td>
              <td className="p-1 border border-gray-300 text-right">{formatCurrency(total)}</td>
              <td className="p-1 border border-gray-300"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
