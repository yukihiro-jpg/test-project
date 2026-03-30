// スプレッドシート生成（財産目録・シミュレーション結果）

import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import type { Case, TaxCalculationResult } from '@/types';
import {
  calculateLandValue, calculateBuildingValue, calculateCashValue,
  calculateListedStockValue, calculateUnlistedStockValue,
  calculateOtherAssetValue, calculateInsuranceExemption,
  calculateDeductibleFuneralExpenses,
} from '@/lib/tax/asset-valuation';
import { countLegalHeirs } from '@/lib/tax/deductions';
import { RELATIONSHIP_LABELS } from '@/types';
import { toWareki } from '@/lib/dates/wareki';

/**
 * 財産目録スプレッドシートを生成
 */
export function exportPropertyList(caseData: Case) {
  const wb = XLSX.utils.book_new();
  const { assets, heirs, decedent, referenceDate } = caseData;

  // ヘッダー行
  const headerRows = [
    ['財産目録'],
    [''],
    ['被相続人', decedent.name],
    ['基準日', referenceDate, '', '和暦', toWareki(referenceDate)],
    [''],
  ];

  // 土地
  const landRows: (string | number)[][] = [['【土地】']];
  landRows.push(['No', '所在地', '地番', '地目', '地積(㎡)', '評価方式', '評価額', '備考']);
  assets.lands.forEach((l, i) => {
    landRows.push([
      i + 1, l.location, l.landNumber, l.landCategory, l.area,
      l.evaluationMethod === 'rosenka' ? '路線価' : '倍率', calculateLandValue(l), l.note,
    ]);
  });
  landRows.push(['', '', '', '', '', '小計', assets.lands.reduce((s, l) => s + calculateLandValue(l), 0), '']);
  landRows.push(['']);

  // 建物
  const buildingRows: (string | number)[][] = [['【建物】']];
  buildingRows.push(['No', '所在地', '構造', '用途', '固定資産税評価額', '評価額', '備考']);
  assets.buildings.forEach((b, i) => {
    buildingRows.push([
      i + 1, b.location, b.structureType, b.usage, b.fixedAssetTaxValue, calculateBuildingValue(b), b.note,
    ]);
  });
  buildingRows.push(['']);

  // 現金預金
  const cashRows: (string | number)[][] = [['【現金預金】']];
  cashRows.push(['No', '金融機関', '口座種別', '残高', '既経過利息', '評価額', '備考']);
  assets.cashDeposits.forEach((c, i) => {
    cashRows.push([
      i + 1, c.institutionName, c.accountType, c.balance, c.accruedInterest, calculateCashValue(c), c.note,
    ]);
  });
  cashRows.push(['']);

  // 上場株式
  const stockRows: (string | number)[][] = [['【上場株式】']];
  stockRows.push(['No', '銘柄', '証券コード', '株数', '採用単価', '評価額', '備考']);
  assets.listedStocks.forEach((s, i) => {
    const { selectedPrice, totalValue } = calculateListedStockValue(s);
    stockRows.push([i + 1, s.companyName, s.stockCode, s.shares, selectedPrice, totalValue, s.note]);
  });
  stockRows.push(['']);

  // 非上場株式
  const unlistedRows: (string | number)[][] = [['【非上場株式】']];
  unlistedRows.push(['No', '会社名', '所有株数', '1株評価額', '評価額', '備考']);
  assets.unlistedStocks.forEach((s, i) => {
    unlistedRows.push([i + 1, s.companyName, s.sharesOwned, s.pricePerShare, calculateUnlistedStockValue(s), s.note]);
  });
  unlistedRows.push(['']);

  // 保険金
  const legalHeirCount = countLegalHeirs(heirs);
  const insResult = calculateInsuranceExemption(assets.insurances, legalHeirCount);
  const insRows: (string | number)[][] = [['【保険金】']];
  insRows.push(['No', '保険会社', '証券番号', '保険金額', '備考']);
  assets.insurances.forEach((ins, i) => {
    insRows.push([i + 1, ins.insuranceCompany, ins.policyNumber, ins.amount, ins.note]);
  });
  insRows.push(['', '', '保険金合計', insResult.totalAmount, '']);
  insRows.push(['', '', '非課税枠', insResult.exemption, '']);
  insRows.push(['', '', '課税対象', insResult.taxableAmount, '']);
  insRows.push(['']);

  // その他
  const otherRows: (string | number)[][] = [['【その他財産】']];
  otherRows.push(['No', '分類', '内容', '数量', '単価', '評価額', '備考']);
  assets.others.forEach((o, i) => {
    otherRows.push([i + 1, o.category, o.description, o.quantity, o.unitPrice, calculateOtherAssetValue(o), o.note]);
  });
  otherRows.push(['']);

  // 債務
  const debtRows: (string | number)[][] = [['【債務】']];
  debtRows.push(['No', '債権者', '内容', '金額', '備考']);
  assets.debts.forEach((d, i) => {
    debtRows.push([i + 1, d.creditor, d.description, d.amount, d.note]);
  });
  debtRows.push(['']);

  // 葬式費用
  const funeralRows: (string | number)[][] = [['【葬式費用】']];
  funeralRows.push(['No', '内容', '金額', '控除対象', '備考']);
  assets.funeralExpenses.forEach((f, i) => {
    funeralRows.push([i + 1, f.description, f.amount, f.isDeductible ? '○' : '×', f.note]);
  });

  const allRows = [
    ...headerRows, ...landRows, ...buildingRows, ...cashRows,
    ...stockRows, ...unlistedRows, ...insRows, ...otherRows,
    ...debtRows, ...funeralRows,
  ];

  const ws = XLSX.utils.aoa_to_sheet(allRows);

  // 列幅設定
  ws['!cols'] = [
    { wch: 5 }, { wch: 25 }, { wch: 15 }, { wch: 12 },
    { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 30 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, '財産目録');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  saveAs(new Blob([buf]), `財産目録_${decedent.name || '未入力'}.xlsx`);
}

/**
 * シミュレーション結果スプレッドシートを生成
 */
export function exportSimulationResult(caseData: Case, result: TaxCalculationResult) {
  const wb = XLSX.utils.book_new();
  const { decedent, referenceDate, heirs } = caseData;

  const rows: (string | number)[][] = [
    ['相続税シミュレーション結果'],
    [''],
    ['被相続人', decedent.name],
    ['基準日', referenceDate],
    [''],
    ['【計算概要】'],
    ['財産総額（保険金含む）', result.totalAssetValue],
    ['債務・葬式費用', result.totalDeductions],
    ['保険金非課税枠', result.insuranceExemption],
    ['課税価格合計', result.netTaxableValue],
    ['基礎控除額', result.basicDeduction],
    ['課税遺産総額', result.taxableAmount],
    ['相続税の総額', result.totalInheritanceTax],
    [''],
    ['【各相続人の相続税額】'],
    ['氏名', '続柄', '取得額', '法定相続分', '按分税額', '配偶者控除', '未成年者控除', '障害者控除', '納付税額'],
  ];

  result.heirTaxDetails.forEach(d => {
    const heir = heirs.find(h => h.id === d.heirId);
    rows.push([
      d.heirName, heir ? RELATIONSHIP_LABELS[heir.relationship] : '',
      d.acquiredValue, `${(d.legalShareRatio * 100).toFixed(1)}%`,
      d.allocatedTax, d.spouseDeduction, d.minorDeduction, d.disabilityDeduction, d.finalTax,
    ]);
  });

  rows.push([
    '合計', '', '', '', '', '', '', '',
    result.heirTaxDetails.reduce((s, d) => s + d.finalTax, 0),
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 15 }, { wch: 12 }, { wch: 18 }, { wch: 12 },
    { wch: 18 }, { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 18 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'シミュレーション結果');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  saveAs(new Blob([buf]), `相続税シミュレーション_${decedent.name || '未入力'}.xlsx`);
}
