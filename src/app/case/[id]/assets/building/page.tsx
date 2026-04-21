'use client';

import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useCaseStore } from '@/lib/store/case-store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CurrencyInput, formatCurrency } from '@/components/common/currency-input';
import { calculateBuildingValue } from '@/lib/tax/asset-valuation';
import { Plus, ChevronDown, ChevronRight, Check } from 'lucide-react';
import type { BuildingAsset, BuildingRoom, RoomOccupancy } from '@/types';

const MONTH_KEYS = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
] as const;
type MonthKey = typeof MONTH_KEYS[number];

const MONTH_LABELS: Record<MonthKey, string> = {
  jan: '1月', feb: '2月', mar: '3月', apr: '4月', may: '5月', jun: '6月',
  jul: '7月', aug: '8月', sep: '9月', oct: '10月', nov: '11月', dec: '12月',
};

function allMonthsOccupied(): RoomOccupancy {
  return {
    jan: true, feb: true, mar: true, apr: true, may: true, jun: true,
    jul: true, aug: true, sep: true, oct: true, nov: true, dec: true,
  };
}

// Returns true if the room is rented at the reference date month (based on occupancy flags)
function isOccupiedAtReference(occupancy: RoomOccupancy, referenceDate: string): boolean {
  const month = new Date(referenceDate).getMonth(); // 0-11
  return occupancy[MONTH_KEYS[month]];
}

// 課税時期賃貸面積: rented at reference date -> full area, else 0
function getTaxableRentalArea(room: BuildingRoom, referenceDate: string): number {
  return isOccupiedAtReference(room.occupancy, referenceDate) ? room.area : 0;
}

function countOccupiedMonths(occupancy: RoomOccupancy): number {
  return MONTH_KEYS.reduce((n, m) => n + (occupancy[m] ? 1 : 0), 0);
}

export default function BuildingPage() {
  const currentCase = useCaseStore(s => s.getCurrentCase());
  const addAsset = useCaseStore(s => s.addAsset);
  const updateAsset = useCaseStore(s => s.updateAsset);
  const removeAsset = useCaseStore(s => s.removeAsset);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!currentCase) return <p className="text-gray-500">案件を選択してください</p>;
  const buildings = currentCase.assets.buildings;
  const referenceDate = currentCase.referenceDate;
  const total = buildings.reduce((sum, b) => sum + calculateBuildingValue(b), 0);

  const handleAdd = () => {
    const id = addAsset('buildings', {
      location: '', structureType: '', usage: '自用',
      fixedAssetTaxValue: 0, rentalReduction: false,
      borrowedHouseRatio: 0.3, note: '',
    });
    setExpandedId(id);
  };

  const addRoom = (b: BuildingAsset) => {
    const newRoom: BuildingRoom = {
      id: uuidv4(),
      roomNumber: '',
      tenantName: '',
      area: 0,
      occupancy: allMonthsOccupied(),
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

  return (
    <div className="space-y-6">
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
              const rooms = b.rooms ?? [];
              const totalArea = rooms.reduce((s, r) => s + (r.area || 0), 0);
              const totalTaxableRental = rooms.reduce(
                (s, r) => s + getTaxableRentalArea(r, referenceDate),
                0,
              );
              const rentalRatio = totalArea > 0 ? (totalTaxableRental / totalArea) * 100 : 0;

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
                      <div className="px-4 py-2 bg-white border-l-4 border-blue-400 space-y-2">
                        {/* 1行目: 基本情報 */}
                        <div className="grid grid-cols-8 gap-2 items-end">
                          <Input label="建物名" value={b.name || ''}
                            onChange={e => updateAsset('buildings', b.id, { name: e.target.value })}
                            placeholder="建物名" />
                          <div className="col-span-2">
                            <Input label="所在地" value={b.location}
                              onChange={e => updateAsset('buildings', b.id, { location: e.target.value })} />
                          </div>
                          <Input label="構造" value={b.structureType} placeholder="木造/RC等"
                            onChange={e => updateAsset('buildings', b.id, { structureType: e.target.value })} />
                          <Input label="用途" value={b.usage} placeholder="自用/貸家等"
                            onChange={e => updateAsset('buildings', b.id, { usage: e.target.value })} />
                          <CurrencyInput label="固定資産税評価額" value={b.fixedAssetTaxValue}
                            onChange={v => updateAsset('buildings', b.id, { fixedAssetTaxValue: v })} />
                          <div className="flex items-end gap-2 pb-1">
                            <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                              <input type="checkbox" checked={b.rentalReduction || false}
                                onChange={e => updateAsset('buildings', b.id, { rentalReduction: e.target.checked })} className="w-3 h-3" />貸家
                            </label>
                            {b.rentalReduction && (
                              <input type="number" value={b.borrowedHouseRatio} step="0.1"
                                onChange={e => updateAsset('buildings', b.id, { borrowedHouseRatio: Number(e.target.value) })}
                                className="w-16 border border-gray-300 rounded px-1 py-0.5 text-xs" />
                            )}
                          </div>
                          <Input label="賃借人" value={b.tenantName || ''}
                            onChange={e => updateAsset('buildings', b.id, { tenantName: e.target.value })}
                            placeholder="賃借人名" />
                          <Input label="備考" value={b.note}
                            onChange={e => updateAsset('buildings', b.id, { note: e.target.value })} />
                        </div>

                        {/* 賃貸割合計算（貸家のみ） */}
                        {b.rentalReduction && (
                          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded space-y-2">
                            <div className="flex items-center justify-between">
                              <h3 className="text-sm font-semibold text-gray-800">賃貸割合（部屋ごとの入居状況）</h3>
                              <div className="text-sm">
                                <span className="text-gray-600">賃貸割合: </span>
                                <span className="font-bold text-amber-800">{rentalRatio.toFixed(2)}%</span>
                              </div>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs border border-gray-200">
                                <thead>
                                  <tr className="bg-amber-100 border-b">
                                    <th className="p-1 text-left">部屋番号</th>
                                    <th className="p-1 text-left">借主</th>
                                    <th className="p-1 text-right">専有面積(㎡)</th>
                                    {MONTH_KEYS.map(m => (
                                      <th key={m} className="p-1 text-center w-7" title={MONTH_LABELS[m]}>
                                        {MONTH_LABELS[m]}
                                      </th>
                                    ))}
                                    <th className="p-1 text-right">課税時期<br />賃貸面積</th>
                                    <th className="p-1 text-left">備考</th>
                                    <th className="p-1 w-8"></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {rooms.map(room => {
                                    const taxableArea = getTaxableRentalArea(room, referenceDate);
                                    const occupiedMonths = countOccupiedMonths(room.occupancy);
                                    return (
                                      <tr key={room.id} className="border-b hover:bg-amber-50/40">
                                        <td className="p-1">
                                          <input
                                            type="text"
                                            value={room.roomNumber}
                                            onChange={e => updateRoom(b, room.id, { roomNumber: e.target.value })}
                                            className="w-16 border border-gray-300 rounded px-1 py-0.5"
                                          />
                                        </td>
                                        <td className="p-1">
                                          <input
                                            type="text"
                                            value={room.tenantName}
                                            onChange={e => updateRoom(b, room.id, { tenantName: e.target.value })}
                                            className="w-24 border border-gray-300 rounded px-1 py-0.5"
                                          />
                                        </td>
                                        <td className="p-1 text-right">
                                          <input
                                            type="number"
                                            value={room.area}
                                            step="0.01"
                                            onChange={e => updateRoom(b, room.id, { area: Number(e.target.value) })}
                                            className="w-20 border border-gray-300 rounded px-1 py-0.5 text-right"
                                          />
                                        </td>
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
                                                aria-label={`${MONTH_LABELS[m]}の入居状況`}
                                                aria-pressed={checked}
                                                title={`${MONTH_LABELS[m]}: ${checked ? '入居中' : '空室'}`}
                                              >
                                                <Check size={12} />
                                              </button>
                                            </td>
                                          );
                                        })}
                                        <td className="p-1 text-right" title={`入居月数: ${occupiedMonths}/12`}>
                                          {taxableArea.toFixed(2)}
                                        </td>
                                        <td className="p-1">
                                          <input
                                            type="text"
                                            value={room.note || ''}
                                            onChange={e => updateRoom(b, room.id, { note: e.target.value })}
                                            placeholder="賃料等"
                                            className="w-28 border border-gray-300 rounded px-1 py-0.5"
                                          />
                                        </td>
                                        <td className="p-1 text-center">
                                          <button
                                            type="button"
                                            onClick={() => removeRoom(b, room.id)}
                                            className="text-red-500 hover:text-red-700 text-xs"
                                            aria-label="部屋を削除"
                                          >
                                            削除
                                          </button>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                  {rooms.length === 0 && (
                                    <tr>
                                      <td colSpan={MONTH_KEYS.length + 6} className="p-2 text-center text-gray-500">
                                        部屋が登録されていません
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                                <tfoot>
                                  <tr className="bg-amber-50 font-semibold border-t">
                                    <td className="p-1 text-right" colSpan={2}>計</td>
                                    <td className="p-1 text-right">{totalArea.toFixed(2)}</td>
                                    <td className="p-1 text-right" colSpan={MONTH_KEYS.length}></td>
                                    <td className="p-1 text-right">{totalTaxableRental.toFixed(2)}</td>
                                    <td className="p-1" colSpan={2}></td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                            <div className="flex items-center justify-between">
                              <button
                                type="button"
                                onClick={() => addRoom(b)}
                                className="text-xs text-amber-700 hover:text-amber-900 border border-amber-300 rounded px-2 py-1 bg-white hover:bg-amber-50"
                              >
                                <Plus size={12} className="inline mr-1" />部屋追加
                              </button>
                              <div className="text-xs text-gray-600">
                                基準日: {referenceDate} / 課税時期賃貸面積合計: {totalTaxableRental.toFixed(2)}㎡ ÷ 専有面積合計: {totalArea.toFixed(2)}㎡
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 削除ボタン */}
                        <div className="flex justify-end">
                          <button onClick={() => removeAsset('buildings', b.id)}
                            className="text-red-500 hover:text-red-700 text-xs">削除</button>
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
