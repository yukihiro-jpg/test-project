// Blobバージョン（Googleドライブアップロード用）

import * as XLSX from 'xlsx';
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

export function generatePropertyListWorkbook(caseData: Case): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  const { assets, heirs, decedent, referenceDate } = caseData;
  const legalHeirCount = countLegalHeirs(heirs);
  const heirNames = heirs.map(h => h.name || '（未入力）');

  const rows: (string | number | null)[][] = [];
  rows.push([`${decedent.name || '被相続人'} 様`, null, null, null, null, null, ...Array(heirNames.length).fill(null), '財産目録']);
  rows.push([null, null, null, null, null, null, ...Array(heirNames.length).fill(null), `基準日：${toWareki(referenceDate)}`]);
  rows.push(['財産分割案＆相続税概算', null, null, null, '単位：円']);
  rows.push([]);
  rows.push(['種類', 'No', '明細', null, '相続税評価額', ...heirNames]);

  if (assets.lands.length > 0) {
    rows.push(['土地', null, '【所在場所】', '【利用状況】', '【面積】']);
    assets.lands.forEach((l, i) => {
      rows.push([null, i + 1, `${l.location} ${l.landNumber}`, l.landCategory, calculateLandValue(l), ...Array(heirNames.length).fill(null)]);
    });
    rows.push([null, null, null, '小計', assets.lands.reduce((s, l) => s + calculateLandValue(l), 0), ...Array(heirNames.length).fill(0)]);
  }
  if (assets.buildings.length > 0) {
    rows.push(['建物', null, '【所在場所】', '【用途】']);
    assets.buildings.forEach((b, i) => {
      rows.push([null, i + 1, b.location, b.usage, calculateBuildingValue(b), ...Array(heirNames.length).fill(null)]);
    });
    rows.push([null, null, null, '小計', assets.buildings.reduce((s, b) => s + calculateBuildingValue(b), 0), ...Array(heirNames.length).fill(0)]);
  }
  if (assets.cashDeposits.length > 0) {
    rows.push(['預貯金', null, '【金融機関】', '【種類】']);
    assets.cashDeposits.forEach((c, i) => {
      rows.push([null, i + 1, c.institutionName, c.accountType, calculateCashValue(c), ...Array(heirNames.length).fill(null)]);
    });
    rows.push([null, null, null, '小計', assets.cashDeposits.reduce((s, c) => s + calculateCashValue(c), 0), ...Array(heirNames.length).fill(0)]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 12 }, { wch: 5 }, { wch: 30 }, { wch: 20 }, { wch: 18 }, ...heirNames.map(() => ({ wch: 16 }))];
  setAllNumFmt(ws);
  XLSX.utils.book_append_sheet(wb, ws, '財産目録');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
}

export function generateSimulationWorkbook(caseData: Case, result: TaxCalculationResult): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  const { decedent, referenceDate, heirs } = caseData;

  const rows: (string | number | null)[][] = [];
  rows.push(['相続税シミュレーション結果']);
  rows.push([]);
  rows.push(['被相続人', decedent.name]);
  rows.push(['基準日', referenceDate, null, '和暦', toWareki(referenceDate)]);
  rows.push([]);
  rows.push(['【計算概要】']);
  rows.push([null, '財産総額', result.totalAssetValue]);
  rows.push([null, '債務・葬式費用', result.totalDeductions]);
  rows.push([null, '保険金非課税枠', result.insuranceExemption]);
  rows.push([null, '課税価格合計', result.netTaxableValue]);
  rows.push([null, '基礎控除額', result.basicDeduction]);
  rows.push([null, '課税遺産総額', result.taxableAmount]);
  rows.push([null, '相続税の総額', result.totalInheritanceTax]);
  rows.push([]);
  rows.push(['【各相続人の相続税額】']);
  rows.push([null, '氏名', '続柄', '取得額', '法定相続分', '按分税額', '配偶者控除', '未成年者控除', '障害者控除', '納付税額']);
  result.heirTaxDetails.forEach(d => {
    const heir = heirs.find(h => h.id === d.heirId);
    rows.push([null, d.heirName, heir ? RELATIONSHIP_LABELS[heir.relationship] : '', d.acquiredValue, `${(d.legalShareRatio * 100).toFixed(1)}%`, d.allocatedTax, d.spouseDeduction, d.minorDeduction, d.disabilityDeduction, d.finalTax]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 5 }, { wch: 18 }, { wch: 14 }, { wch: 18 }, { wch: 12 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 18 }];
  setAllNumFmt(ws);
  XLSX.utils.book_append_sheet(wb, ws, 'シミュレーション結果');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
}
