'use client';

import React, { useState, useEffect } from 'react';
import { useCaseStore } from '@/lib/store/case-store';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/components/common/currency-input';
import { calculateListedStockValue } from '@/lib/tax/asset-valuation';
import {
  calculateStock, calculateStockBatch,
  type StockCalcResult, type DividendRights,
} from '@/lib/stock/stock-api';
import { Plus, Trash2, Zap, Check, AlertCircle, Link2, ChevronDown, ChevronRight, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const inputClass =
  'w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500';

function formatNum(n: number | undefined | null): string {
  if (!n) return '';
  return n.toLocaleString('ja-JP');
}

function parseNum(s: string): number {
  return Number(s.replace(/,/g, '')) || 0;
}

/** 4つの価格のうちどれが採用されたかラベルを返す */
function getAdoptedLabel(stock: {
  deathDatePrice: number;
  monthlyAvgDeath: number;
  monthlyAvgPrev1: number;
  monthlyAvgPrev2: number;
}): string {
  const entries: [string, number][] = [
    ['終値', stock.deathDatePrice],
    ['当月平均', stock.monthlyAvgDeath],
    ['前月平均', stock.monthlyAvgPrev1],
    ['前々月平均', stock.monthlyAvgPrev2],
  ];
  const valid = entries.filter(([, v]) => v > 0);
  if (valid.length === 0) return '-';
  valid.sort((a, b) => a[1] - b[1]);
  return valid[0][0];
}

export default function ListedStockPage() {
  const currentCase = useCaseStore(s => s.getCurrentCase());
  const addAsset = useCaseStore(s => s.addAsset);
  const updateAsset = useCaseStore(s => s.updateAsset);
  const removeAsset = useCaseStore(s => s.removeAsset);

  // Per-stock calculation state
  const [divResults, setDivResults] = useState<Record<string, DividendRights>>({});
  const [calcResults, setCalcResults] = useState<Record<string, StockCalcResult>>({});
  const [linkedDivIds, setLinkedDivIds] = useState<Set<string>>(new Set());
  const [calcStatus, setCalcStatus] = useState<Record<string, 'idle' | 'loading' | 'done' | 'error'>>({});
  const [batchLoading, setBatchLoading] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Check which dividends are already linked on mount / case change
  useEffect(() => {
    if (!currentCase) return;
    const linked = new Set<string>();
    currentCase.assets.others.forEach(o => {
      if (o.note?.startsWith('[株式連動]')) {
        const stockMatch = currentCase.assets.listedStocks.find(s =>
          o.note?.includes(s.stockCode));
        if (stockMatch) linked.add(stockMatch.id);
      }
    });
    setLinkedDivIds(linked);
  }, [currentCase]);

  if (!currentCase) return <p className="text-gray-500">案件を選択してください</p>;

  const items = currentCase.assets.listedStocks;
  const total = items.reduce((sum, item) => sum + calculateListedStockValue(item).totalValue, 0);

  // --- Add row ---
  const handleAdd = () => {
    addAsset('listedStocks', {
      companyName: '', stockCode: '', shares: 0,
      deathDatePrice: 0, monthlyAvgDeath: 0,
      monthlyAvgPrev1: 0, monthlyAvgPrev2: 0, note: '',
    });
  };

  // --- 評価基準日（死亡日優先、なければ基準日） ---
  const valuationDate = currentCase.decedent?.deathDate || currentCase.referenceDate;

  // --- Auto calculate single stock ---
  const handleAutoCalc = async (stockId: string) => {
    const stock = currentCase.assets.listedStocks.find(s => s.id === stockId);
    if (!stock || !stock.stockCode) return;
    if (!valuationDate) {
      alert('被相続人の死亡日または基準日を設定してください');
      return;
    }
    setCalcStatus(prev => ({ ...prev, [stockId]: 'loading' }));
    try {
      const result = await calculateStock(
        stock.stockCode,
        valuationDate,
        stock.shares || 1,
      );
      updateAsset('listedStocks', stockId, {
        companyName: result.company_name,
        deathDatePrice: result.close_on_date,
        monthlyAvgDeath: result.avg2,
        monthlyAvgPrev1: result.avg3,
        monthlyAvgPrev2: result.avg4,
      });
      setCalcResults(prev => ({ ...prev, [stockId]: result }));
      if (result.div_rights) {
        setDivResults(prev => ({ ...prev, [stockId]: result.div_rights }));
      }
      setCalcStatus(prev => ({ ...prev, [stockId]: 'done' }));
    } catch (e: any) {
      console.error('計算エラー:', e);
      alert('計算に失敗しました: ' + (e.message || '不明なエラー'));
      setCalcStatus(prev => ({ ...prev, [stockId]: 'error' }));
    }
  };

  // --- Batch calculate all (sequential per-stock to avoid index mismatch) ---
  const handleBatchCalc = async () => {
    const validItems = items.filter(s => s.stockCode);
    if (validItems.length === 0) return;
    setBatchLoading(true);

    for (const stock of validItems) {
      setCalcStatus(prev => ({ ...prev, [stock.id]: 'loading' }));
      try {
        const result = await calculateStock(stock.stockCode, valuationDate, stock.shares || 1);
        updateAsset('listedStocks', stock.id, {
          companyName: result.company_name,
          deathDatePrice: result.close_on_date,
          monthlyAvgDeath: result.avg2,
          monthlyAvgPrev1: result.avg3,
          monthlyAvgPrev2: result.avg4,
        });
        setCalcResults(prev => ({ ...prev, [stock.id]: result }));
        if (result.div_rights) {
          setDivResults(prev => ({ ...prev, [stock.id]: result.div_rights }));
        }
        setCalcStatus(prev => ({ ...prev, [stock.id]: 'done' }));
      } catch {
        setCalcStatus(prev => ({ ...prev, [stock.id]: 'error' }));
      }
    }
    setBatchLoading(false);
  };

  // --- Link dividend to others ---
  const handleLinkDividend = (stockId: string) => {
    const dr = divResults[stockId];
    const stock = currentCase.assets.listedStocks.find(s => s.id === stockId);
    if (!dr || !stock || dr.status === 'none') return;

    const category = dr.status === 'kitai_ken' ? '配当期待権' : '未収配当金';
    addAsset('others', {
      category,
      description: `${stock.companyName}（${stock.stockCode}）`,
      quantity: 1,
      unitPrice: Math.round(dr.total_net),
      note: `[株式連動] ${category} ${stock.stockCode}`,
    });
    setLinkedDivIds(prev => new Set([...prev, stockId]));
  };

  // --- Dividend badge label ---
  const getDivBadge = (stockId: string): { label: string; color: string } | null => {
    const dr = divResults[stockId];
    if (!dr || dr.status === 'none' || dr.status === 'unknown') return null;
    if (dr.status === 'kitai_ken') return { label: '期待権', color: 'bg-amber-100 text-amber-800' };
    if (dr.status === 'mishuu') return { label: '未収', color: 'bg-blue-100 text-blue-800' };
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">上場株式</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={handleBatchCalc}
            disabled={batchLoading || items.length === 0}
          >
            <Zap size={18} className="mr-2" />
            {batchLoading ? '計算中...' : '全銘柄一括計算'}
          </Button>
          <Button onClick={handleAdd}>
            <Plus size={18} className="mr-2" />追加
          </Button>
        </div>
      </div>

      {/* 評価基準日表示 */}
      <div className="bg-blue-50 border border-blue-200 rounded-md px-4 py-2 text-sm">
        <span className="text-gray-600">評価基準日: </span>
        <span className="font-semibold text-blue-700">
          {valuationDate || '未設定'}
        </span>
        <span className="text-gray-500 text-xs ml-2">
          （{currentCase.decedent?.deathDate ? '被相続人の死亡日' : '案件の基準日'}を使用）
        </span>
        {!valuationDate && (
          <span className="text-red-600 text-xs ml-2">
            ⚠ 被相続人情報で死亡日を設定してください
          </span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100 border-b">
              <th className="p-2 text-center border border-gray-300">No</th>
              <th className="p-2 text-center border border-gray-300">銘柄コード</th>
              <th className="p-2 text-center border border-gray-300">銘柄名</th>
              <th className="p-2 text-center border border-gray-300">株数</th>
              <th className="p-2 text-center border border-gray-300">終値</th>
              <th className="p-2 text-center border border-gray-300">月平均(当月)</th>
              <th className="p-2 text-center border border-gray-300">月平均(前月)</th>
              <th className="p-2 text-center border border-gray-300">月平均(前々月)</th>
              <th className="p-2 text-center border border-gray-300">採用単価</th>
              <th className="p-2 text-center border border-gray-300">評価額</th>
              <th className="p-2 text-center border border-gray-300">採用区分</th>
              <th className="p-2 text-center border border-gray-300">配当</th>
              <th className="p-2 text-center border border-gray-300">操作</th>
              <th className="p-2 text-center border border-gray-300 w-12">削除</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const { selectedPrice, totalValue } = calculateListedStockValue(item);
              const status = calcStatus[item.id] || 'idle';
              const divBadge = getDivBadge(item.id);
              const isLinked = linkedDivIds.has(item.id);

              return (
                <tr key={item.id} className={i % 2 === 0 ? '' : 'bg-gray-50'}>
                  {/* No */}
                  <td className="p-2 border border-gray-300 text-center">{i + 1}</td>

                  {/* 銘柄コード */}
                  <td className="p-2 border border-gray-300">
                    <input
                      type="text"
                      value={item.stockCode}
                      onChange={e => updateAsset('listedStocks', item.id, { stockCode: e.target.value })}
                      className={`${inputClass} w-24`}
                      placeholder="例: 7203"
                    />
                  </td>

                  {/* 銘柄名 */}
                  <td className="p-2 border border-gray-300">
                    <input
                      type="text"
                      value={item.companyName}
                      onChange={e => updateAsset('listedStocks', item.id, { companyName: e.target.value })}
                      className={inputClass}
                      placeholder="会社名"
                    />
                  </td>

                  {/* 株数 */}
                  <td className="p-2 border border-gray-300">
                    <input
                      type="text"
                      value={formatNum(item.shares)}
                      onChange={e => updateAsset('listedStocks', item.id, { shares: parseNum(e.target.value) })}
                      className={`${inputClass} text-right w-24`}
                    />
                  </td>

                  {/* 終値 */}
                  <td className="p-2 border border-gray-300">
                    <input
                      type="text"
                      value={formatNum(item.deathDatePrice)}
                      onChange={e => updateAsset('listedStocks', item.id, { deathDatePrice: parseNum(e.target.value) })}
                      className={`${inputClass} text-right`}
                    />
                  </td>

                  {/* 月平均(当月) */}
                  <td className="p-2 border border-gray-300">
                    <input
                      type="text"
                      value={formatNum(item.monthlyAvgDeath)}
                      onChange={e => updateAsset('listedStocks', item.id, { monthlyAvgDeath: parseNum(e.target.value) })}
                      className={`${inputClass} text-right`}
                    />
                  </td>

                  {/* 月平均(前月) */}
                  <td className="p-2 border border-gray-300">
                    <input
                      type="text"
                      value={formatNum(item.monthlyAvgPrev1)}
                      onChange={e => updateAsset('listedStocks', item.id, { monthlyAvgPrev1: parseNum(e.target.value) })}
                      className={`${inputClass} text-right`}
                    />
                  </td>

                  {/* 月平均(前々月) */}
                  <td className="p-2 border border-gray-300">
                    <input
                      type="text"
                      value={formatNum(item.monthlyAvgPrev2)}
                      onChange={e => updateAsset('listedStocks', item.id, { monthlyAvgPrev2: parseNum(e.target.value) })}
                      className={`${inputClass} text-right`}
                    />
                  </td>

                  {/* 採用単価 */}
                  <td className="p-2 border border-gray-300 text-right">
                    {formatNum(selectedPrice)}
                  </td>

                  {/* 評価額 */}
                  <td className="p-2 border border-gray-300 text-right font-medium">
                    {formatNum(totalValue)}
                  </td>

                  {/* 採用区分 */}
                  <td className="p-2 border border-gray-300 text-center text-xs text-gray-600">
                    {getAdoptedLabel(item)}
                  </td>

                  {/* 配当 */}
                  <td className="p-2 border border-gray-300 text-center">
                    <div className="flex flex-col items-center gap-1">
                      {divBadge && (
                        <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${divBadge.color}`}>
                          {divBadge.label}
                        </span>
                      )}
                      {divBadge && !isLinked && (
                        <button
                          type="button"
                          onClick={() => handleLinkDividend(item.id)}
                          className="flex items-center gap-0.5 text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap"
                          title="配当を財産に反映"
                        >
                          <Link2 size={12} />
                          反映
                        </button>
                      )}
                      {isLinked && (
                        <span className="flex items-center gap-0.5 text-xs text-green-600">
                          <Check size={12} />
                          連動済
                        </span>
                      )}
                    </div>
                  </td>

                  {/* 操作 (自動計算) */}
                  <td className="p-2 border border-gray-300 text-center">
                    <button
                      type="button"
                      onClick={() => handleAutoCalc(item.id)}
                      disabled={status === 'loading' || !item.stockCode}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors
                        ${status === 'loading'
                          ? 'bg-gray-200 text-gray-500 cursor-wait'
                          : status === 'done'
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : status === 'error'
                              ? 'bg-red-100 text-red-700 hover:bg-red-200'
                              : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                        }
                        disabled:opacity-50`}
                    >
                      {status === 'loading' ? (
                        <>計算中...</>
                      ) : status === 'done' ? (
                        <><Check size={12} /> 完了</>
                      ) : status === 'error' ? (
                        <><AlertCircle size={12} /> 再試行</>
                      ) : (
                        <><Zap size={12} /> 自動計算</>
                      )}
                    </button>
                  </td>

                  {/* 削除 */}
                  <td className="p-2 border border-gray-300 text-center">
                    <button
                      type="button"
                      onClick={() => removeAsset('listedStocks', item.id)}
                      className="text-red-600 hover:text-red-800"
                      aria-label="削除"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gray-100 font-semibold border-t-2">
              <td colSpan={9} className="p-2 text-right border border-gray-300">合計</td>
              <td className="p-2 text-right border border-gray-300">{formatNum(total)}</td>
              <td className="border border-gray-300" colSpan={4}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
