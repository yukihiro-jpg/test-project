// スプレッドシート生成（財産目録・シミュレーション結果）- 改善版

import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import type { Case, TaxCalculationResult, Heir } from '@/types';
import {
  calculateLandValue, calculateBuildingValue, calculateCashValue,
  calculateListedStockValue, calculateUnlistedStockValue,
  calculateOtherAssetValue, calculateInsuranceExemption,
  calculateDeductibleFuneralExpenses,
} from '@/lib/tax/asset-valuation';
import { countLegalHeirs } from '@/lib/tax/deductions';
import { RELATIONSHIP_LABELS } from '@/types';
import { toWareki } from '@/lib/dates/wareki';

// セルスタイル用ヘルパー
function numFmt(ws: XLSX.WorkSheet, ref: string, fmt: string = '#,##0') {
  if (!ws[ref]) return;
  ws[ref].z = fmt;
}

function setAllNumFmt(ws: XLSX.WorkSheet, fmt: string = '#,##0') {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const ref = XLSX.utils.encode_cell({ r, c });
      if (ws[ref] && typeof ws[ref].v === 'number') {
        ws[ref].z = fmt;
      }
    }
  }
}

/**
 * 財産目録スプレッドシート（添付画像スタイル）
 */
export function exportPropertyList(caseData: Case) {
  const wb = XLSX.utils.book_new();
  const { assets, heirs, decedent, referenceDate } = caseData;
  const legalHeirCount = countLegalHeirs(heirs);

  // 相続人名の列ヘッダー
  const heirNames = heirs.map(h => h.name || '（未入力）');
  const heirColStart = 5; // F列から相続人列開始

  // --- ヘッダー部分 ---
  const rows: (string | number | null)[][] = [];

  // 1行目: タイトル
  rows.push([`${decedent.name || '被相続人'} 様`, null, null, null, null, null, ...Array(heirNames.length).fill(null), '財産目録']);
  // 2行目: 日付情報
  rows.push([null, null, null, null, null, null, ...Array(heirNames.length).fill(null),
    `基準日：${toWareki(referenceDate)}`]);
  // 3行目: 財産分割案&相続税概算
  rows.push(['財産分割案＆相続税概算', null, null, null, `単位：円`]);
  // 4行目: 空行
  rows.push([]);
  // 5行目: テーブルヘッダー
  rows.push(['種類', 'No', '明細', null, '相続税評価額', ...heirNames]);

  let currentRow = 5; // 0-indexed

  // ========== 土地 ==========
  if (assets.lands.length > 0) {
    currentRow++;
    const landStartRow = rows.length;
    rows.push(['土地', null, '【所在場所】', '【利用状況】', '【面積】']);
    assets.lands.forEach((l, i) => {
      const val = calculateLandValue(l);
      rows.push([null, i + 1,
        `${l.location} ${l.landNumber}`,
        l.landCategory,
        val,
        ...Array(heirNames.length).fill(null)]);
      currentRow++;
    });
    const landTotal = assets.lands.reduce((s, l) => s + calculateLandValue(l), 0);
    rows.push([null, null, null, '小計（土地評価額）', landTotal, ...Array(heirNames.length).fill(0)]);
    currentRow++;
    rows.push([null, null, null, '小計（小規模宅地等の減額）', null, ...Array(heirNames.length).fill(null)]);
    currentRow++;
    const landAfterSpecial = landTotal;
    rows.push([null, null, null, '差引 ★', landAfterSpecial, ...Array(heirNames.length).fill(0)]);
    currentRow++;
  }

  // ========== 建物 ==========
  if (assets.buildings.length > 0) {
    rows.push(['建物', null, '【所在場所】', '【利用状況】']);
    currentRow++;
    assets.buildings.forEach((b, i) => {
      const val = calculateBuildingValue(b);
      rows.push([null, i + 1, b.location, b.usage, val, ...Array(heirNames.length).fill(null)]);
      currentRow++;
    });
    const buildingTotal = assets.buildings.reduce((s, b) => s + calculateBuildingValue(b), 0);
    rows.push([null, null, null, '小計', buildingTotal, ...Array(heirNames.length).fill(0)]);
    currentRow++;
  }

  // ========== 預貯金 ==========
  if (assets.cashDeposits.length > 0) {
    rows.push(['預貯金', null, '【金融機関】', '【種類】', '【口座番号】']);
    currentRow++;
    assets.cashDeposits.forEach((c, i) => {
      const val = calculateCashValue(c);
      rows.push([null, i + 1, c.institutionName, c.accountType, val, ...Array(heirNames.length).fill(null)]);
      currentRow++;
    });
    // 既経過利息
    const totalInterest = assets.cashDeposits.reduce((s, c) => s + c.accruedInterest, 0);
    if (totalInterest > 0) {
      rows.push([null, null, '既経過利息', null, totalInterest]);
      currentRow++;
    }
    const cashTotal = assets.cashDeposits.reduce((s, c) => s + calculateCashValue(c), 0);
    rows.push([null, null, null, '小計 ★', cashTotal, ...Array(heirNames.length).fill(0)]);
    currentRow++;
  }

  // ========== 生命保険金・日当 ==========
  if (assets.insurances.length > 0) {
    const insResult = calculateInsuranceExemption(assets.insurances, legalHeirCount);
    rows.push(['生保', null, '【保険会社】', '【保険種類】', '【証券番号】']);
    currentRow++;
    assets.insurances.forEach((ins, i) => {
      rows.push([`・日当：`, i + 1, ins.insuranceCompany,
        ins.isDeathBenefit ? '終身保険' : 'その他',
        ins.amount, ...Array(heirNames.length).fill(null)]);
      currentRow++;
    });
    rows.push([null, null, null, '小計', insResult.totalAmount, ...Array(heirNames.length).fill(0)]);
    currentRow++;
    rows.push([null, null, null, '非課税金額', -insResult.exemption, ...Array(heirNames.length).fill(0)]);
    currentRow++;
    rows.push([null, null, null, '差引 ★', insResult.taxableAmount, ...Array(heirNames.length).fill(0)]);
    currentRow++;
  }

  // ========== 上場株式 ==========
  if (assets.listedStocks.length > 0) {
    rows.push(['有価証券', null, '【銘柄】', '【証券コード】', '【株数】']);
    currentRow++;
    assets.listedStocks.forEach((s, i) => {
      const { selectedPrice, totalValue } = calculateListedStockValue(s);
      rows.push([null, i + 1, s.companyName, s.stockCode, totalValue, ...Array(heirNames.length).fill(null)]);
      currentRow++;
    });
    const stockTotal = assets.listedStocks.reduce((s, st) => s + calculateListedStockValue(st).totalValue, 0);
    rows.push([null, null, null, '小計', stockTotal, ...Array(heirNames.length).fill(0)]);
    currentRow++;
  }

  // ========== 非上場株式 ==========
  if (assets.unlistedStocks.length > 0) {
    rows.push(['非上場株式', null, '【会社名】', '【所有株数】']);
    currentRow++;
    assets.unlistedStocks.forEach((s, i) => {
      const val = calculateUnlistedStockValue(s);
      rows.push([null, i + 1, s.companyName, `${s.sharesOwned}株`, val, ...Array(heirNames.length).fill(null)]);
      currentRow++;
    });
    const unlistedTotal = assets.unlistedStocks.reduce((s, st) => s + calculateUnlistedStockValue(st), 0);
    rows.push([null, null, null, '小計', unlistedTotal, ...Array(heirNames.length).fill(0)]);
    currentRow++;
  }

  // ========== その他 ==========
  if (assets.others.length > 0) {
    rows.push(['その他', null, '【種類】', '【名称等】']);
    currentRow++;
    assets.others.forEach((o, i) => {
      const val = calculateOtherAssetValue(o);
      rows.push([null, i + 1, o.category, o.description, val, ...Array(heirNames.length).fill(null)]);
      currentRow++;
    });
    const otherTotal = assets.others.reduce((s, o) => s + calculateOtherAssetValue(o), 0);
    rows.push([null, null, null, '小計 ★', otherTotal, ...Array(heirNames.length).fill(0)]);
    currentRow++;
  }

  // ========== 代償分割 ==========
  rows.push(['代償分割', null, null, null, null, ...Array(heirNames.length).fill(null)]);
  currentRow++;

  // ========== 取得財産の価額 ==========
  const totalPositiveAssets =
    assets.lands.reduce((s, l) => s + calculateLandValue(l), 0) +
    assets.buildings.reduce((s, b) => s + calculateBuildingValue(b), 0) +
    assets.cashDeposits.reduce((s, c) => s + calculateCashValue(c), 0) +
    assets.listedStocks.reduce((s, st) => s + calculateListedStockValue(st).totalValue, 0) +
    assets.unlistedStocks.reduce((s, st) => s + calculateUnlistedStockValue(st), 0) +
    assets.others.reduce((s, o) => s + calculateOtherAssetValue(o), 0) +
    calculateInsuranceExemption(assets.insurances, legalHeirCount).taxableAmount;
  rows.push(['取得財産の価額', null, '（＝★の合計）', null, totalPositiveAssets, ...Array(heirNames.length).fill(0)]);
  currentRow++;

  // ========== 債務・葬式費用 ==========
  if (assets.debts.length > 0 || assets.funeralExpenses.length > 0) {
    rows.push(['債務・', null, '【種類】', '【債権者名】']);
    currentRow++;
    assets.debts.forEach((d, i) => {
      rows.push(['葬式', i + 1, d.description, d.creditor, d.amount, ...Array(heirNames.length).fill(null)]);
      currentRow++;
    });
    assets.funeralExpenses.forEach((f, i) => {
      rows.push([null, assets.debts.length + i + 1, f.description,
        f.isDeductible ? '控除対象' : '対象外', f.amount, ...Array(heirNames.length).fill(null)]);
      currentRow++;
    });
    const debtFuneralTotal = assets.debts.reduce((s, d) => s + d.amount, 0) +
      calculateDeductibleFuneralExpenses(assets.funeralExpenses);
    rows.push([null, null, '債務・葬式費用の合計', null, debtFuneralTotal, ...Array(heirNames.length).fill(0)]);
    currentRow++;
  }

  // ========== 課税価格 ==========
  rows.push([]);
  currentRow++;
  const debtTotal = assets.debts.reduce((s, d) => s + d.amount, 0) +
    calculateDeductibleFuneralExpenses(assets.funeralExpenses);
  const taxablePrice = totalPositiveAssets - debtTotal;
  rows.push(['課税価格', null, '（取得財産の価額）－（債務・葬式費用の合計）＋（生前贈与加算額）', null,
    taxablePrice, ...Array(heirNames.length).fill(0)]);

  // --- シートの作成 ---
  const ws = XLSX.utils.aoa_to_sheet(rows);

  // 列幅設定
  const colWidths = [
    { wch: 12 },  // A: 種類
    { wch: 5 },   // B: No
    { wch: 30 },  // C: 明細1
    { wch: 20 },  // D: 明細2
    { wch: 18 },  // E: 評価額
    ...heirNames.map(() => ({ wch: 16 })),  // 各相続人列
  ];
  ws['!cols'] = colWidths;

  // すべての数値セルに #,##0 フォーマットを適用
  setAllNumFmt(ws);

  XLSX.utils.book_append_sheet(wb, ws, '財産目録');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  saveAs(new Blob([buf]), `財産目録_${decedent.name || '未入力'}.xlsx`);
}

/**
 * シミュレーション結果スプレッドシート
 */
export function exportSimulationResult(caseData: Case, result: TaxCalculationResult) {
  const wb = XLSX.utils.book_new();
  const { decedent, referenceDate, heirs } = caseData;

  const rows: (string | number | null)[][] = [];

  // ヘッダー
  rows.push(['相続税シミュレーション結果']);
  rows.push([]);
  rows.push(['被相続人', decedent.name]);
  rows.push(['基準日', referenceDate, null, '和暦', toWareki(referenceDate)]);
  rows.push(['相続人数', `${heirs.length}名`]);
  rows.push([]);

  // 計算概要
  rows.push(['【計算概要】']);
  rows.push([]);
  const summaryItems: [string, number][] = [
    ['財産総額（保険金含む）', result.totalAssetValue],
    ['債務・葬式費用合計', result.totalDeductions],
    ['保険金非課税枠', result.insuranceExemption],
    ['課税価格合計', result.netTaxableValue],
    ['基礎控除額', result.basicDeduction],
    ['課税遺産総額', result.taxableAmount],
    ['相続税の総額', result.totalInheritanceTax],
  ];
  summaryItems.forEach(([label, value]) => {
    rows.push([null, label, value]);
  });

  rows.push([]);
  rows.push([]);

  // 各相続人の相続税額
  rows.push(['【各相続人の相続税額】']);
  rows.push([]);
  rows.push([null, '氏名', '続柄', '取得額', '法定相続分', '法定相続分による取得金額',
    '法定相続分に対する税額', '按分税額', '配偶者控除', '未成年者控除', '障害者控除', '納付税額']);

  result.heirTaxDetails.forEach(d => {
    const heir = heirs.find(h => h.id === d.heirId);
    rows.push([null,
      d.heirName,
      heir ? RELATIONSHIP_LABELS[heir.relationship] : '',
      d.acquiredValue,
      `${(d.legalShareRatio * 100).toFixed(1)}%`,
      d.legalShareAmount,
      d.taxOnLegalShare,
      d.allocatedTax,
      d.spouseDeduction,
      d.minorDeduction,
      d.disabilityDeduction,
      d.finalTax,
    ]);
  });

  // 合計行
  rows.push([null, '合計', null,
    result.heirTaxDetails.reduce((s, d) => s + d.acquiredValue, 0),
    null, null, null,
    result.heirTaxDetails.reduce((s, d) => s + d.allocatedTax, 0),
    result.heirTaxDetails.reduce((s, d) => s + d.spouseDeduction, 0),
    result.heirTaxDetails.reduce((s, d) => s + d.minorDeduction, 0),
    result.heirTaxDetails.reduce((s, d) => s + d.disabilityDeduction, 0),
    result.heirTaxDetails.reduce((s, d) => s + d.finalTax, 0),
  ]);

  rows.push([]);
  rows.push([]);

  // 実効税率
  const totalFinalTax = result.heirTaxDetails.reduce((s, d) => s + d.finalTax, 0);
  const effectiveRate = result.netTaxableValue > 0
    ? (totalFinalTax / result.netTaxableValue * 100).toFixed(2) + '%'
    : '0%';
  rows.push(['実効税率', effectiveRate]);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // 列幅
  ws['!cols'] = [
    { wch: 5 },  // A
    { wch: 18 }, // B: 氏名/ラベル
    { wch: 14 }, // C: 続柄
    { wch: 18 }, // D: 取得額
    { wch: 12 }, // E: 法定相続分
    { wch: 20 }, // F: 法定相続分取得金額
    { wch: 20 }, // G: 法定相続分税額
    { wch: 18 }, // H: 按分税額
    { wch: 16 }, // I: 配偶者控除
    { wch: 16 }, // J: 未成年者控除
    { wch: 16 }, // K: 障害者控除
    { wch: 18 }, // L: 納付税額
  ];

  // 数値フォーマット適用
  setAllNumFmt(ws);

  XLSX.utils.book_append_sheet(wb, ws, 'シミュレーション結果');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  saveAs(new Blob([buf]), `相続税シミュレーション_${decedent.name || '未入力'}.xlsx`);
}
