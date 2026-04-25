'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useCaseStore } from '@/lib/store/case-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CurrencyInput, formatCurrency, formatManyen } from '@/components/common/currency-input';
import { calculateTotalAssetValue, calculateInheritanceTax } from '@/lib/tax/inheritance-tax';
import {
  calculateLandValue,
  calculateBuildingValue,
  calculateCashValue,
  calculateListedStockValue,
  calculateUnlistedStockValue,
  calculateOtherAssetValue,
  calculateInsuranceExemption,
  calculateDeductibleFuneralExpenses,
} from '@/lib/tax/asset-valuation';
import { calculateLegalShareRatios, countLegalHeirs } from '@/lib/tax/deductions';
import { RELATIONSHIP_LABELS } from '@/types';
import type { DivisionEntry, Assets, Case, Heir } from '@/types';

// ---------- Beneficiary-fixed asset descriptor ----------
interface BeneficiaryFixedRow {
  key: string;
  category: string;
  description: string;
  beneficiaryHeirId: string;
  amount: number;
}

// ---------- Asset row descriptor ----------
interface AssetRow {
  key: string;        // unique key like "lands_abc123"
  assetId: string;
  assetType: keyof Assets;
  category: string;   // 表示カテゴリ名
  description: string;
  value: number;       // 評価額
}

// ---------- Category labels ----------
const CATEGORY_ORDER: { type: keyof Assets; label: string }[] = [
  { type: 'lands', label: '土地' },
  { type: 'buildings', label: '建物' },
  { type: 'cashDeposits', label: '預貯金' },
  { type: 'listedStocks', label: '上場株式' },
  { type: 'unlistedStocks', label: '非上場株式' },
  { type: 'insurances', label: '保険金' },
  { type: 'others', label: 'その他' },
  { type: 'debts', label: '債務' },
  { type: 'funeralExpenses', label: '葬式費用' },
];

// ---------- Build flat asset list ----------
function buildAssetRows(c: Case): AssetRow[] {
  const rows: AssetRow[] = [];
  const { assets } = c;

  for (const land of assets.lands) {
    rows.push({
      key: `lands_${land.id}`,
      assetId: land.id,
      assetType: 'lands',
      category: '土地',
      description: `${land.location} ${land.landNumber}（${land.landCategory}）`,
      value: calculateLandValue(land, land.linkedBuildingId ? assets.buildings.find(b => b.id === land.linkedBuildingId) : undefined),
    });
  }

  for (const b of assets.buildings) {
    rows.push({
      key: `buildings_${b.id}`,
      assetId: b.id,
      assetType: 'buildings',
      category: '建物',
      description: `${b.location}（${b.usage}）`,
      value: calculateBuildingValue(b),
    });
  }

  for (const cd of assets.cashDeposits) {
    rows.push({
      key: `cashDeposits_${cd.id}`,
      assetId: cd.id,
      assetType: 'cashDeposits',
      category: '預貯金',
      description: `${cd.institutionName}（${cd.accountType}）`,
      value: calculateCashValue(cd),
    });
  }

  for (const s of assets.listedStocks) {
    const { totalValue } = calculateListedStockValue(s);
    rows.push({
      key: `listedStocks_${s.id}`,
      assetId: s.id,
      assetType: 'listedStocks',
      category: '上場株式',
      description: `${s.companyName}（${s.stockCode}）${s.shares}株`,
      value: totalValue,
    });
  }

  for (const s of assets.unlistedStocks) {
    rows.push({
      key: `unlistedStocks_${s.id}`,
      assetId: s.id,
      assetType: 'unlistedStocks',
      category: '非上場株式',
      description: `${s.companyName} ${s.sharesOwned}株`,
      value: calculateUnlistedStockValue(s),
    });
  }

  // Only include non-death-benefit insurances in the division table
  for (const ins of assets.insurances) {
    if (ins.isDeathBenefit) continue;
    rows.push({
      key: `insurances_${ins.id}`,
      assetId: ins.id,
      assetType: 'insurances',
      category: '保険金',
      description: `${ins.insuranceCompany}（${ins.policyNumber}）`,
      value: ins.amount,
    });
  }

  // Retirement benefits are beneficiary-fixed; excluded from division table

  for (const o of assets.others) {
    rows.push({
      key: `others_${o.id}`,
      assetId: o.id,
      assetType: 'others',
      category: 'その他',
      description: `${o.category} - ${o.description}`,
      value: calculateOtherAssetValue(o),
    });
  }

  for (const d of assets.debts) {
    rows.push({
      key: `debts_${d.id}`,
      assetId: d.id,
      assetType: 'debts',
      category: '債務',
      description: `${d.creditor} - ${d.description}`,
      value: -d.amount, // negative for debts
    });
  }

  for (const f of assets.funeralExpenses) {
    if (f.isDeductible) {
      rows.push({
        key: `funeralExpenses_${f.id}`,
        assetId: f.id,
        assetType: 'funeralExpenses',
        category: '葬式費用',
        description: f.description,
        value: -f.amount, // negative for deductions
      });
    }
  }

  return rows;
}

// ---------- Build beneficiary-fixed asset list (not subject to division) ----------
function buildBeneficiaryFixedRows(c: Case): BeneficiaryFixedRow[] {
  const rows: BeneficiaryFixedRow[] = [];
  const { assets } = c;

  // Death benefit insurances go to the designated beneficiary
  for (const ins of assets.insurances) {
    if (!ins.isDeathBenefit) continue;
    rows.push({
      key: `insurances_${ins.id}`,
      category: '死亡保険金',
      description: `${ins.insuranceCompany}（${ins.policyNumber}）`,
      beneficiaryHeirId: ins.beneficiaryHeirId,
      amount: ins.amount,
    });
  }

  // Retirement benefits go to the designated beneficiary
  for (const rb of (assets.retirementBenefits || [])) {
    rows.push({
      key: `retirementBenefits_${rb.id}`,
      category: '退職金',
      description: rb.payerName,
      beneficiaryHeirId: rb.beneficiaryHeirId,
      amount: rb.amount,
    });
  }

  return rows;
}

// Allocations: Record<assetKey, Record<heirId, amount>>
type Allocations = Record<string, Record<string, number>>;

function calculateNetValue(c: Case): number {
  const totalAsset = calculateTotalAssetValue(c.assets);
  const legalHeirCount = countLegalHeirs(c.heirs);
  const insurance = calculateInsuranceExemption(c.assets.insurances, legalHeirCount);
  const totalDebt = c.assets.debts.reduce((s, d) => s + d.amount, 0);
  const funeral = calculateDeductibleFuneralExpenses(c.assets.funeralExpenses);
  return totalAsset + insurance.taxableAmount - totalDebt - funeral;
}

export default function DivisionPage() {
  const currentCase = useCaseStore(s => s.getCurrentCase());
  const updateDivision = useCaseStore(s => s.updateDivision);

  const [allocations, setAllocations] = useState<Allocations>({});
  const [saved, setSaved] = useState(false);

  const assetRows = useMemo(() => {
    if (!currentCase) return [];
    return buildAssetRows(currentCase);
  }, [currentCase]);

  const beneficiaryFixedRows = useMemo(() => {
    if (!currentCase) return [];
    return buildBeneficiaryFixedRows(currentCase);
  }, [currentCase]);

  const netValue = useMemo(() => {
    if (!currentCase) return 0;
    return calculateNetValue(currentCase);
  }, [currentCase]);

  // Initialize allocations from existing division entries
  useEffect(() => {
    if (!currentCase) return;
    const alloc: Allocations = {};

    // Initialize all asset keys with empty heir maps
    for (const row of buildAssetRows(currentCase)) {
      alloc[row.key] = {};
    }

    // Load existing entries
    for (const entry of currentCase.division.entries) {
      const key = `${entry.assetType}_${entry.assetId}`;
      if (!alloc[key]) alloc[key] = {};
      alloc[key][entry.heirId] = entry.amount || 0;
    }

    setAllocations(alloc);
  }, [currentCase?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const heirs = currentCase?.heirs || [];

  // Compute heir totals and unallocated per row
  const heirTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const heir of heirs) {
      totals[heir.id] = 0;
    }
    for (const row of assetRows) {
      const heirAlloc = allocations[row.key] || {};
      for (const heirId of Object.keys(heirAlloc)) {
        totals[heirId] = (totals[heirId] || 0) + (heirAlloc[heirId] || 0);
      }
    }
    return totals;
  }, [allocations, assetRows, heirs]);

  const totalAllocated = useMemo(() => {
    return Object.values(heirTotals).reduce((s, v) => s + v, 0);
  }, [heirTotals]);

  const remaining = netValue - totalAllocated;

  // Group rows by category for display
  const groupedRows = useMemo(() => {
    const groups: { label: string; rows: AssetRow[] }[] = [];
    for (const cat of CATEGORY_ORDER) {
      const rows = assetRows.filter(r => r.assetType === cat.type);
      if (rows.length > 0) {
        groups.push({ label: cat.label, rows });
      }
    }
    return groups;
  }, [assetRows]);

  const handleAllocationChange = useCallback((assetKey: string, heirId: string, value: number) => {
    setSaved(false);
    setAllocations(prev => ({
      ...prev,
      [assetKey]: {
        ...(prev[assetKey] || {}),
        [heirId]: value,
      },
    }));
  }, []);

  // Auto-distribute by legal share ratios
  const handleLegalShare = useCallback(() => {
    if (!currentCase) return;
    const ratios = calculateLegalShareRatios(heirs);
    const newAlloc: Allocations = {};

    for (const row of assetRows) {
      newAlloc[row.key] = {};
      const absValue = Math.abs(row.value);
      for (const heir of heirs) {
        const ratio = ratios.get(heir.id) || 0;
        const amount = Math.floor(absValue * ratio);
        if (row.value < 0) {
          // Debts/funeral: allocate as negative
          newAlloc[row.key][heir.id] = -amount;
        } else {
          newAlloc[row.key][heir.id] = amount;
        }
      }
    }

    setAllocations(newAlloc);
    setSaved(false);
  }, [currentCase, heirs, assetRows]);

  // Equal split among all heirs
  const handleEqualSplit = useCallback(() => {
    if (!currentCase || heirs.length === 0) return;
    const newAlloc: Allocations = {};

    for (const row of assetRows) {
      newAlloc[row.key] = {};
      const absValue = Math.abs(row.value);
      const perHeir = Math.floor(absValue / heirs.length);
      for (const heir of heirs) {
        if (row.value < 0) {
          newAlloc[row.key][heir.id] = -perHeir;
        } else {
          newAlloc[row.key][heir.id] = perHeir;
        }
      }
    }

    setAllocations(newAlloc);
    setSaved(false);
  }, [currentCase, heirs, assetRows]);

  // Save
  const handleSave = useCallback(() => {
    const entries: DivisionEntry[] = [];

    for (const row of assetRows) {
      const heirAlloc = allocations[row.key] || {};
      for (const [heirId, amount] of Object.entries(heirAlloc)) {
        if (amount === 0) continue;
        entries.push({
          heirId,
          assetId: row.assetId,
          assetType: row.assetType,
          ratio: row.value !== 0 ? Math.abs(amount) / Math.abs(row.value) : 0,
          amount,
        });
      }
    }

    updateDivision(entries);
    setSaved(true);
  }, [assetRows, allocations, updateDivision]);

  if (!currentCase) return <p className="text-gray-500">案件を選択してください</p>;

  // Row unallocated computation helper
  const getRowUnallocated = (row: AssetRow) => {
    const heirAlloc = allocations[row.key] || {};
    const allocated = Object.values(heirAlloc).reduce((s, v) => s + v, 0);
    return row.value - allocated;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">遺産分割</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleLegalShare}>
            法定相続分で設定
          </Button>
          <Button variant="secondary" onClick={handleEqualSplit}>
            均等分割
          </Button>
          <Button onClick={handleSave}>
            {saved ? '保存済み' : '保存'}
          </Button>
        </div>
      </div>

      {/* Summary Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <p className="text-gray-600">正味遺産額</p>
              <p className="font-semibold text-lg">{formatManyen(netValue)}</p>
            </div>
            <div className="border-l border-blue-300 pl-6">
              <p className="text-gray-600">未分割額</p>
              <p className={`font-semibold text-lg ${remaining !== 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatManyen(remaining)}
              </p>
            </div>
            {heirs.map(heir => {
              const total = heirTotals[heir.id] || 0;
              const pct = netValue > 0 ? ((total / netValue) * 100).toFixed(1) : '0.0';
              return (
                <div key={heir.id} className="border-l border-blue-300 pl-6">
                  <p className="text-gray-600">
                    {heir.name || '（未入力）'}
                    <span className="ml-1 text-xs text-gray-400">
                      （{RELATIONSHIP_LABELS[heir.relationship]}）
                    </span>
                  </p>
                  <p className="font-semibold">
                    {formatManyen(total)}
                    <span className="ml-1 text-xs font-normal text-gray-500">{pct}%</span>
                  </p>
                </div>
              );
            })}
          </div>

          {/* 相続税額の自動表示 */}
          {(() => {
            try {
              const taxResult = calculateInheritanceTax(currentCase);
              const totalTax = taxResult.heirTaxDetails.reduce((s, d) => s + d.finalTax, 0);
              return (
                <div className="mt-4 pt-4 border-t border-blue-300">
                  <div className="flex flex-wrap gap-6 text-sm">
                    <div>
                      <p className="text-gray-600">相続税の総額</p>
                      <p className="font-bold text-lg text-blue-800">{formatManyen(taxResult.totalInheritanceTax)}</p>
                    </div>
                    {taxResult.heirTaxDetails.map(d => (
                      <div key={d.heirId} className="border-l border-blue-300 pl-4">
                        <p className="text-gray-600 text-xs">{d.heirName} 納付税額</p>
                        <p className="font-semibold text-blue-700">
                          {formatManyen(d.finalTax)}
                          {d.surchargeAmount > 0 && <span className="text-xs text-red-600 ml-1">（2割加算含）</span>}
                        </p>
                      </div>
                    ))}
                    <div className="border-l border-blue-300 pl-4">
                      <p className="text-gray-600 text-xs">合計納付税額</p>
                      <p className="font-bold text-lg text-red-700">{formatManyen(totalTax)}</p>
                    </div>
                  </div>
                </div>
              );
            } catch { return null; }
          })()}
        </CardContent>
      </Card>

      {/* Asset Allocation Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-3 py-2 font-medium text-gray-600 w-24">区分</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">財産の内容</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-600 w-32">評価額</th>
                  {heirs.map(heir => (
                    <th key={heir.id} className="text-center px-3 py-2 font-medium text-gray-600 w-40">
                      {heir.name || '（未入力）'}
                    </th>
                  ))}
                  <th className="text-right px-3 py-2 font-medium text-gray-600 w-28">未分割</th>
                </tr>
              </thead>
              <tbody>
                {groupedRows.map(group => (
                  <React.Fragment key={`group-${group.label}`}>
                    {/* Category header row */}
                    <tr className="bg-gray-100 border-t">
                      <td colSpan={3 + heirs.length + 1} className="px-3 py-1.5 font-semibold text-gray-700">
                        {group.label}
                      </td>
                    </tr>
                    {/* Asset rows */}
                    {group.rows.map(row => {
                      const unallocated = getRowUnallocated(row);
                      return (
                        <tr key={row.key} className="border-t hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-500">{row.category}</td>
                          <td className="px-3 py-2 text-gray-900">{row.description}</td>
                          <td className="px-3 py-2 text-right font-mono whitespace-nowrap">
                            {formatCurrency(row.value)}
                          </td>
                          {heirs.map(heir => (
                            <td key={heir.id} className="px-2 py-1">
                              <CurrencyInput
                                label=""
                                value={allocations[row.key]?.[heir.id] || 0}
                                onChange={v => handleAllocationChange(row.key, heir.id, v)}
                              />
                            </td>
                          ))}
                          <td className={`px-3 py-2 text-right font-mono whitespace-nowrap ${unallocated !== 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {formatCurrency(unallocated)}
                          </td>
                        </tr>
                      );
                    })}
                    {/* Category subtotal */}
                    <tr className="border-t bg-gray-50">
                      <td className="px-3 py-1.5" />
                      <td className="px-3 py-1.5 text-right font-medium text-gray-600">小計</td>
                      <td className="px-3 py-1.5 text-right font-mono font-medium">
                        {formatCurrency(group.rows.reduce((s, r) => s + r.value, 0))}
                      </td>
                      {heirs.map(heir => {
                        const catTotal = group.rows.reduce((s, r) => {
                          return s + (allocations[r.key]?.[heir.id] || 0);
                        }, 0);
                        return (
                          <td key={heir.id} className="px-3 py-1.5 text-right font-mono font-medium">
                            {formatCurrency(catTotal)}
                          </td>
                        );
                      })}
                      <td className="px-3 py-1.5 text-right font-mono font-medium">
                        {formatCurrency(group.rows.reduce((s, r) => s + getRowUnallocated(r), 0))}
                      </td>
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
              {/* Grand total footer */}
              <tfoot>
                <tr className="border-t-2 border-gray-400 bg-gray-100 font-bold">
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2 text-right">合計</td>
                  <td className="px-3 py-2 text-right font-mono">
                    {formatCurrency(assetRows.reduce((s, r) => s + r.value, 0))}
                  </td>
                  {heirs.map(heir => (
                    <td key={heir.id} className="px-3 py-2 text-right font-mono">
                      {formatCurrency(heirTotals[heir.id] || 0)}
                    </td>
                  ))}
                  <td className={`px-3 py-2 text-right font-mono ${remaining !== 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(remaining)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Beneficiary-fixed assets (not subject to division) */}
      {beneficiaryFixedRows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">受取人固有財産（分割対象外）</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left px-3 py-2 font-medium text-gray-600 w-24">区分</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">内容</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600 w-40">受取人</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600 w-32">金額</th>
                    <th className="text-center px-3 py-2 font-medium text-gray-600 w-28">備考</th>
                  </tr>
                </thead>
                <tbody>
                  {beneficiaryFixedRows.map(row => {
                    const heir = heirs.find(h => h.id === row.beneficiaryHeirId);
                    const heirLabel = heir ? heir.name || '（未入力）' : '（未選択）';
                    return (
                      <tr key={row.key} className="border-t hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-500">{row.category}</td>
                        <td className="px-3 py-2 text-gray-900">{row.description}</td>
                        <td className="px-3 py-2 text-gray-900">{heirLabel}</td>
                        <td className="px-3 py-2 text-right font-mono whitespace-nowrap">
                          {formatCurrency(row.amount)}
                        </td>
                        <td className="px-3 py-2 text-center text-xs text-gray-500">受取人固定</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-400 bg-gray-100 font-bold">
                    <td className="px-3 py-2" />
                    <td className="px-3 py-2 text-right">合計</td>
                    <td className="px-3 py-2" />
                    <td className="px-3 py-2 text-right font-mono">
                      {formatCurrency(beneficiaryFixedRows.reduce((s, r) => s + r.amount, 0))}
                    </td>
                    <td className="px-3 py-2" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
