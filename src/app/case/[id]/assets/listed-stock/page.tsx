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
  const [activeMonthTab, setActiveMonthTab] = useState<Record<string, number>>({});

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

  // --- Toggle detail row ---
  const toggleDetail = (stockId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(stockId)) {
        next.delete(stockId);
      } else {
        next.add(stockId);
      }
      return next;
    });
  };

  // --- Excel export (multi-sheet) ---
  const handleExcelExport = () => {
    const wb = XLSX.utils.book_new();

    // ===== Sheet 1: 一覧 (Summary) =====
    const summaryHeaders = [
      '銘柄コード', '銘柄名', '株数',
      '①終値', '②当月平均', '③前月平均', '④前々月平均',
      '採用単価', '採用区分', '評価額', '配当判定', '配当評価額',
    ];

    const summaryRows = items.map(item => {
      const { selectedPrice, totalValue } = calculateListedStockValue(item);
      const dr = divResults[item.id];
      const divLabel = dr
        ? dr.status === 'kitai_ken' ? '配当期待権あり'
          : dr.status === 'mishuu' ? '未収配当金あり'
          : 'なし'
        : '';
      const divValue = dr && dr.status !== 'none' && dr.status !== 'unknown'
        ? Math.round(dr.total_net)
        : '';

      return [
        item.stockCode,
        item.companyName,
        item.shares,
        item.deathDatePrice || '',
        item.monthlyAvgDeath || '',
        item.monthlyAvgPrev1 || '',
        item.monthlyAvgPrev2 || '',
        selectedPrice || '',
        getAdoptedLabel(item),
        totalValue || '',
        divLabel,
        divValue,
      ];
    });

    const wsSummary = XLSX.utils.aoa_to_sheet([summaryHeaders, ...summaryRows]);
    const summaryRange = XLSX.utils.decode_range(wsSummary['!ref'] || 'A1');
    for (let r = summaryRange.s.r + 1; r <= summaryRange.e.r; r++) {
      for (let c = 2; c <= 11; c++) {
        const ref = XLSX.utils.encode_cell({ r, c });
        if (wsSummary[ref] && typeof wsSummary[ref].v === 'number') {
          wsSummary[ref].z = '#,##0';
        }
      }
    }
    wsSummary['!cols'] = [
      { wch: 12 }, { wch: 20 }, { wch: 10 },
      { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
      { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(wb, wsSummary, '一覧');

    // ===== Per-stock sheets =====
    for (const item of items) {
      const result = calcResults[item.id];
      if (!result) continue;

      const { selectedPrice, totalValue } = calculateListedStockValue(item);
      const dr = divResults[item.id];
      const codePrefix = (item.stockCode || 'unknown').slice(0, 20);

      // --- Sheet: {code}_評価額計算書 ---
      const evalRows: (string | number | null)[][] = [];
      evalRows.push(['上場株式 評価額計算書']);
      evalRows.push([]);
      evalRows.push(['銘柄コード', item.stockCode]);
      evalRows.push(['銘柄名', result.company_name || item.companyName]);
      evalRows.push(['課税時期', result.inherit_date || valuationDate || '']);
      evalRows.push(['実際取得日', result.actual_date || '']);
      evalRows.push(['株数', item.shares]);
      evalRows.push([]);
      evalRows.push(['【4指標比較】']);
      evalRows.push(['区分', '価格（円）', '採用']);
      const prices: [string, number][] = [
        ['①課税時期の終値', item.deathDatePrice],
        ['②課税時期の月の月平均', item.monthlyAvgDeath],
        ['③前月の月平均', item.monthlyAvgPrev1],
        ['④前々月の月平均', item.monthlyAvgPrev2],
      ];
      const validPrices = prices.filter(([, v]) => v > 0);
      const minPrice = validPrices.length > 0 ? Math.min(...validPrices.map(([, v]) => v)) : 0;
      for (const [label, price] of prices) {
        evalRows.push([
          label,
          price > 0 ? price : null,
          price > 0 && price === minPrice ? '○' : '',
        ]);
      }
      evalRows.push([]);
      evalRows.push(['採用単価', selectedPrice || null]);
      evalRows.push(['採用区分', getAdoptedLabel(item)]);
      evalRows.push(['株数', item.shares]);
      evalRows.push(['評価額', totalValue || null]);
      evalRows.push([]);

      // Dividend info
      if (dr && dr.status !== 'none' && dr.status !== 'unknown') {
        evalRows.push(['【配当期待権・未収配当金】']);
        const divStatusLabel = dr.status === 'kitai_ken' ? '配当期待権あり' : '未収配当金あり';
        evalRows.push(['判定', divStatusLabel]);
        if (dr.items && dr.items.length > 0) {
          evalRows.push(['区分', '権利落日', '1株配当', '税引前', '源泉税', '税引後']);
          for (const di of dr.items) {
            evalRows.push([
              di.status, di.ex_date, di.div_per_share,
              Math.round(di.gross), Math.round(di.tax), Math.round(di.net),
            ]);
          }
          evalRows.push(['合計', '', '', Math.round(dr.total_gross), Math.round(dr.total_tax), Math.round(dr.total_net)]);
        }
      }

      const wsEval = XLSX.utils.aoa_to_sheet(evalRows);
      // Number format for numeric cells
      const evalRange = XLSX.utils.decode_range(wsEval['!ref'] || 'A1');
      for (let r = evalRange.s.r; r <= evalRange.e.r; r++) {
        for (let c = evalRange.s.c; c <= evalRange.e.c; c++) {
          const ref = XLSX.utils.encode_cell({ r, c });
          if (wsEval[ref] && typeof wsEval[ref].v === 'number') {
            wsEval[ref].z = '#,##0';
          }
        }
      }
      wsEval['!cols'] = [
        { wch: 24 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
      ];

      const evalSheetName = `${codePrefix}_評価額計算書`.slice(0, 31);
      XLSX.utils.book_append_sheet(wb, wsEval, evalSheetName);

      // --- Sheet: {code}_終値データ ---
      const monthlyData = [
        { label: result.month4, dates: result.dates4, closes: result.closes4, days: result.days4, avg: result.avg4 },
        { label: result.month3, dates: result.dates3, closes: result.closes3, days: result.days3, avg: result.avg3 },
        { label: result.month2, dates: result.dates2, closes: result.closes2, days: result.days2, avg: result.avg2 },
      ];

      const closingRows: (string | number | null)[][] = [];
      closingRows.push([`${result.company_name || item.companyName}（${item.stockCode}）月別終値データ`]);
      closingRows.push([]);

      for (const md of monthlyData) {
        if (!md.dates || !md.closes) continue;
        closingRows.push([`【${md.label}】`]);
        closingRows.push(['日付', '終値（円）']);
        const total = md.closes.reduce((s, v) => s + v, 0);
        for (let i = 0; i < md.dates.length; i++) {
          const dateStr = md.dates[i];
          const isValDate = dateStr === (result.actual_date || result.inherit_date);
          closingRows.push([
            isValDate ? `${dateStr} ★` : dateStr,
            md.closes[i],
          ]);
        }
        closingRows.push([]);
        closingRows.push(['終値合計', total]);
        closingRows.push(['営業日数', md.days]);
        closingRows.push(['月平均額（円未満切捨）', md.avg]);
        closingRows.push([]);
      }

      const wsClosing = XLSX.utils.aoa_to_sheet(closingRows);
      const closingRange = XLSX.utils.decode_range(wsClosing['!ref'] || 'A1');
      for (let r = closingRange.s.r; r <= closingRange.e.r; r++) {
        for (let c = closingRange.s.c; c <= closingRange.e.c; c++) {
          const ref = XLSX.utils.encode_cell({ r, c });
          if (wsClosing[ref] && typeof wsClosing[ref].v === 'number') {
            wsClosing[ref].z = '#,##0';
          }
        }
      }
      wsClosing['!cols'] = [
        { wch: 18 }, { wch: 14 },
      ];

      const closingSheetName = `${codePrefix}_終値データ`.slice(0, 31);
      XLSX.utils.book_append_sheet(wb, wsClosing, closingSheetName);
    }

    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf], { type: 'application/octet-stream' }), '上場株式_算定結果.xlsx');
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
            onClick={handleExcelExport}
            disabled={items.length === 0}
          >
            <Download size={18} className="mr-2" />
            算定結果Excel出力
          </Button>
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

              const isExpanded = expandedIds.has(item.id);
              const cr = calcResults[item.id];
              const dr = divResults[item.id];

              return (
                <React.Fragment key={item.id}>
                  <tr className={i % 2 === 0 ? '' : 'bg-gray-50'}>
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

                    {/* 操作 (自動計算 + 詳細) */}
                    <td className="p-2 border border-gray-300 text-center">
                      <div className="flex items-center justify-center gap-1">
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
                        {status === 'done' && (
                          <button
                            type="button"
                            onClick={() => toggleDetail(item.id)}
                            className="inline-flex items-center gap-0.5 px-1.5 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                            title="算定詳細を表示"
                          >
                            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            詳細
                          </button>
                        )}
                      </div>
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

                  {/* Expandable detail row */}
                  {isExpanded && status === 'done' && (
                    <tr className="bg-blue-50">
                      <td colSpan={14} className="p-4 border border-gray-300">
                        <div className="space-y-4">
                          {/* a) 算定根拠: 4指標比較テーブル */}
                          <div>
                            <h4 className="text-sm font-semibold text-gray-800 mb-2">算定根拠</h4>
                            <table className="text-sm border-collapse">
                              <thead>
                                <tr className="bg-gray-100">
                                  <th className="px-3 py-1 border border-gray-300 text-left">区分</th>
                                  <th className="px-3 py-1 border border-gray-300 text-right">価格</th>
                                  <th className="px-3 py-1 border border-gray-300 text-center">採用</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(() => {
                                  const prices: [string, number][] = [
                                    ['①課税時期の終値', item.deathDatePrice],
                                    ['②課税時期の月の月平均', item.monthlyAvgDeath],
                                    ['③前月の月平均', item.monthlyAvgPrev1],
                                    ['④前々月の月平均', item.monthlyAvgPrev2],
                                  ];
                                  const validPrices = prices.filter(([, v]) => v > 0);
                                  const minPrice = validPrices.length > 0
                                    ? Math.min(...validPrices.map(([, v]) => v))
                                    : 0;

                                  return prices.map(([label, price]) => (
                                    <tr key={label} className={price > 0 && price === minPrice ? 'bg-green-50' : ''}>
                                      <td className="px-3 py-1 border border-gray-300">{label}</td>
                                      <td className="px-3 py-1 border border-gray-300 text-right">
                                        {price > 0 ? `${formatNum(price)}円` : '-'}
                                      </td>
                                      <td className="px-3 py-1 border border-gray-300 text-center">
                                        {price > 0 && price === minPrice ? '✅' : ''}
                                      </td>
                                    </tr>
                                  ));
                                })()}
                              </tbody>
                            </table>
                          </div>

                          {/* b) 月別終値データ（タブ切替式） */}
                          {cr && cr.dates2 && cr.closes2 && (
                            <div>
                              <h4 className="text-sm font-semibold text-gray-800 mb-2">月別終値データ</h4>
                              {(() => {
                                const monthData = [
                                  { dates: cr.dates4, closes: cr.closes4, label: cr.month4, days: cr.days4, avg: cr.avg4 },
                                  { dates: cr.dates3, closes: cr.closes3, label: cr.month3, days: cr.days3, avg: cr.avg3 },
                                  { dates: cr.dates2, closes: cr.closes2, label: cr.month2, days: cr.days2, avg: cr.avg2 },
                                ];
                                const tab = activeMonthTab[item.id] ?? 2;
                                const active = monthData[tab];
                                const valDate = cr.actual_date || cr.inherit_date;

                                return (
                                  <div>
                                    <div className="flex gap-1">
                                      {[cr.month4, cr.month3, cr.month2].map((label, idx) => (
                                        <button
                                          key={idx}
                                          onClick={() => setActiveMonthTab(prev => ({ ...prev, [item.id]: idx }))}
                                          className={`px-3 py-1 text-xs rounded-t border ${tab === idx ? 'bg-white border-b-white font-bold text-blue-700' : 'bg-gray-100 text-gray-600'}`}
                                        >
                                          {label}
                                        </button>
                                      ))}
                                    </div>
                                    {active && active.dates && active.closes && (
                                      <div className="border border-gray-300 border-t-0 rounded-b bg-white p-2">
                                        <table className="text-xs border-collapse w-auto">
                                          <thead>
                                            <tr className="bg-gray-100">
                                              <th className="px-3 py-1 border border-gray-300 text-left">日付</th>
                                              <th className="px-3 py-1 border border-gray-300 text-right">終値（円）</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {active.dates.map((d, idx) => {
                                              const isValDate = d === valDate;
                                              return (
                                                <tr key={idx} className={isValDate ? 'bg-yellow-100' : ''}>
                                                  <td className="px-3 py-1 border border-gray-300">
                                                    {isValDate ? `${d} ★` : d}
                                                  </td>
                                                  <td className="px-3 py-1 border border-gray-300 text-right">
                                                    {formatNum(active.closes![idx])}
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                          <tfoot>
                                            <tr className="bg-gray-50 font-medium">
                                              <td className="px-3 py-1 border border-gray-300 text-right">終値合計</td>
                                              <td className="px-3 py-1 border border-gray-300 text-right">
                                                {formatNum(active.closes.reduce((s, v) => s + v, 0))}
                                              </td>
                                            </tr>
                                            <tr className="bg-gray-50 font-medium">
                                              <td className="px-3 py-1 border border-gray-300 text-right">営業日数</td>
                                              <td className="px-3 py-1 border border-gray-300 text-right">
                                                {active.days}
                                              </td>
                                            </tr>
                                            <tr className="bg-gray-50 font-medium">
                                              <td className="px-3 py-1 border border-gray-300 text-right">月平均額（円未満切捨）</td>
                                              <td className="px-3 py-1 border border-gray-300 text-right">
                                                {formatNum(active.avg)}円
                                              </td>
                                            </tr>
                                          </tfoot>
                                        </table>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          )}

                          {/* c) 配当期待権・未収配当金の判定ロジック表示 */}
                          {dr && (
                            <div>
                              <h4 className="text-sm font-semibold text-gray-800 mb-2">配当期待権・未収配当金</h4>
                              <p className="text-sm mb-2">
                                <span className="text-gray-600">判定: </span>
                                <span className={`font-medium ${
                                  dr.status === 'kitai_ken' ? 'text-amber-700'
                                    : dr.status === 'mishuu' ? 'text-blue-700'
                                    : 'text-gray-600'
                                }`}>
                                  {dr.status === 'kitai_ken' ? '配当期待権あり'
                                    : dr.status === 'mishuu' ? '未収配当金あり'
                                    : dr.status === 'unknown' ? '判定不可'
                                    : 'なし'}
                                </span>
                              </p>

                              {/* 判定ロジック説明 */}
                              <div className="bg-gray-50 border border-gray-200 rounded p-3 mb-3 text-xs text-gray-700 font-mono whitespace-pre-line leading-5">
{`■ 配当期待権（財産評価基本通達 193-2）
  判定条件：権利付最終日 ＜ 課税時期 ＜ 支払日
  評価額 ＝ 1株当たり配当金額 × (1 − 20.315%) × 株数

■ 源泉徴収税率: 所得税15% + 復興特別所得税0.315% + 住民税5% = 20.315%`}
                              </div>

                              {dr.items && dr.items.length > 0 && (
                                <div>
                                  <p className="text-xs text-gray-500 mb-1">配当明細:</p>
                                  <table className="text-xs border-collapse">
                                    <thead>
                                      <tr className="bg-gray-100">
                                        <th className="px-2 py-1 border border-gray-300">区分</th>
                                        <th className="px-2 py-1 border border-gray-300">権利落日</th>
                                        <th className="px-2 py-1 border border-gray-300 text-right">1株配当</th>
                                        <th className="px-2 py-1 border border-gray-300 text-right">税引前</th>
                                        <th className="px-2 py-1 border border-gray-300 text-right">源泉税</th>
                                        <th className="px-2 py-1 border border-gray-300 text-right">税引後</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {dr.items.map((di, idx) => (
                                        <tr key={idx}>
                                          <td className="px-2 py-1 border border-gray-300">{di.status}</td>
                                          <td className="px-2 py-1 border border-gray-300">{di.ex_date}</td>
                                          <td className="px-2 py-1 border border-gray-300 text-right">
                                            {formatNum(di.div_per_share)}
                                          </td>
                                          <td className="px-2 py-1 border border-gray-300 text-right">
                                            {formatNum(Math.round(di.gross))}
                                          </td>
                                          <td className="px-2 py-1 border border-gray-300 text-right">
                                            {formatNum(Math.round(di.tax))}
                                          </td>
                                          <td className="px-2 py-1 border border-gray-300 text-right">
                                            {formatNum(Math.round(di.net))}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                    <tfoot>
                                      <tr className="bg-gray-50 font-medium">
                                        <td colSpan={3} className="px-2 py-1 border border-gray-300 text-right">合計</td>
                                        <td className="px-2 py-1 border border-gray-300 text-right">
                                          {formatNum(Math.round(dr.total_gross))}
                                        </td>
                                        <td className="px-2 py-1 border border-gray-300 text-right">
                                          {formatNum(Math.round(dr.total_tax))}
                                        </td>
                                        <td className="px-2 py-1 border border-gray-300 text-right">
                                          {formatNum(Math.round(dr.total_net))}
                                        </td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
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
