import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import type { Case, TaxCalculationResult, Heir } from '@/types';
import { getDisplayRelationship } from '@/types';
import {
  calculateLandValue, calculateBuildingValue, calculateCashValue,
  calculateListedStockValue, calculateUnlistedStockValue,
  calculateOtherAssetValue, calculateInsuranceExemption,
  calculateDeductibleFuneralExpenses,
} from '@/lib/tax/asset-valuation';
import { countLegalHeirs, calculateLegalShareRatios } from '@/lib/tax/deductions';
import { toWareki } from '@/lib/dates/wareki';
import { RETIREMENT_EXEMPTION_PER_HEIR } from '@/lib/tax/tax-tables';

function fmt(ws: XLSX.WorkSheet) {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const ref = XLSX.utils.encode_cell({ r, c });
      if (ws[ref] && typeof ws[ref].v === 'number') {
        ws[ref].z = '#,##0';
      }
    }
  }
}

function n(v: number): number | null { return v === 0 ? null : v; }

export function exportDivisionReport(caseData: Case, result: TaxCalculationResult) {
  const { decedent, heirs, assets, referenceDate, division } = caseData;
  const wb = XLSX.utils.book_new();
  const heirNames = heirs.map(h => `${h.name || '（未入力）'} 様`);
  const heirCount = heirs.length;
  const legalHeirCount = countLegalHeirs(heirs);
  const legalRatios = calculateLegalShareRatios(heirs);
  const today = new Date().toISOString().split('T')[0];

  // 遺産分割データから各相続人の取得額を取得
  const getAlloc = (assetKey: string, heirId: string): number => {
    const entry = division.entries.find(e => `${e.assetType}_${e.assetId}` === assetKey && e.heirId === heirId);
    return entry?.amount || 0;
  };

  const rows: (string | number | null)[][] = [];
  const E = heirCount; // 相続人列数

  // ヘッダー
  rows.push([`${decedent.name || '被相続人'} 様`, null, null, null, null, null, null, null, null, null, '財産診断書']);
  rows.push([]);
  rows.push([]);
  rows.push(['財産分割案＆相続税概算']);
  rows.push([]);
  rows.push([null, null, null, null, null, null, null, `基準日：${toWareki(referenceDate)}`]);
  rows.push([null, null, null, null, null, null, '単位：円', `作成日：${toWareki(today)}`]);
  rows.push([]);
  // ヘッダー行
  rows.push(['種類', null, '明細', null, null, null, null, '相続税評価額', ...heirNames]);

  let rowIdx = rows.length;
  let starTotal = 0;
  const heirStarTotals = new Array(heirCount).fill(0);

  // ===== 土地 =====
  rows.push(['土地', null, '【所在場所】', null, '【利用状況】', '【面積】']);
  const lands = assets.lands;
  lands.forEach((l, i) => {
    const linkedBld = l.linkedBuildingId ? assets.buildings.find(b => b.id === l.linkedBuildingId) : undefined;
    const val = calculateLandValue(l, linkedBld, referenceDate);
    const key = `lands_${l.id}`;
    const heirAmounts = heirs.map(h => n(getAlloc(key, h.id)));
    rows.push([null, i + 1, l.location, null, l.usage || '自用地', `${l.area || l.registeredArea || 0}㎡`, null, val, ...heirAmounts]);
  });
  const landTotal = lands.reduce((s, l) => {
    const lb = l.linkedBuildingId ? assets.buildings.find(b => b.id === l.linkedBuildingId) : undefined;
    return s + calculateLandValue(l, lb, referenceDate);
  }, 0);
  rows.push([null, null, null, null, null, null, '小計（土地評価額）', landTotal, ...heirs.map(() => null)]);
  rows.push([null, null, null, null, null, null, '差引 ★', landTotal, ...heirs.map((h) => {
    const t = lands.reduce((s, l) => s + getAlloc(`lands_${l.id}`, h.id), 0);
    return n(t);
  })]);
  starTotal += landTotal;
  heirs.forEach((h, hi) => {
    heirStarTotals[hi] += lands.reduce((s, l) => s + getAlloc(`lands_${l.id}`, h.id), 0);
  });

  // ===== 建物 =====
  rows.push(['建物', null, '【所在場所】', null, '【利用状況】']);
  const buildings = assets.buildings;
  buildings.forEach((b, i) => {
    const val = calculateBuildingValue(b);
    const key = `buildings_${b.id}`;
    rows.push([null, i + 1, b.location, null, b.usage, null, null, val, ...heirs.map(h => n(getAlloc(key, h.id)))]);
  });
  const bldTotal = buildings.reduce((s, b) => s + calculateBuildingValue(b), 0);
  rows.push([null, null, null, null, null, null, '小計 ★', bldTotal, ...heirs.map((h) => {
    const t = buildings.reduce((s, b) => s + getAlloc(`buildings_${b.id}`, h.id), 0);
    return n(t);
  })]);
  starTotal += bldTotal;
  heirs.forEach((h, hi) => {
    heirStarTotals[hi] += buildings.reduce((s, b) => s + getAlloc(`buildings_${b.id}`, h.id), 0);
  });

  // ===== 有価証券 =====
  if (assets.listedStocks.length > 0) {
    rows.push(['有価証券', null, '【銘柄】', null, '【単価】', '【数量】']);
    assets.listedStocks.forEach((s, i) => {
      const { selectedPrice, totalValue } = calculateListedStockValue(s);
      const key = `listedStocks_${s.id}`;
      rows.push([null, i + 1, s.companyName, null, `${selectedPrice.toLocaleString()}円`, s.shares, null, totalValue, ...heirs.map(h => n(getAlloc(key, h.id)))]);
    });
    const stockTotal = assets.listedStocks.reduce((s, st) => s + calculateListedStockValue(st).totalValue, 0);
    rows.push([null, null, null, null, null, null, '小計 ★', stockTotal, ...heirs.map((h) => {
      const t = assets.listedStocks.reduce((s, st) => s + getAlloc(`listedStocks_${st.id}`, h.id), 0);
      return n(t);
    })]);
    starTotal += stockTotal;
    heirs.forEach((h, hi) => {
      heirStarTotals[hi] += assets.listedStocks.reduce((s, st) => s + getAlloc(`listedStocks_${st.id}`, h.id), 0);
    });
  }

  // ===== 預貯金 =====
  rows.push(['預貯金', null, '【金融機関】', '【種類】', '【口座番号】', '【名義】']);
  assets.cashDeposits.forEach((c, i) => {
    const val = calculateCashValue(c);
    const key = `cashDeposits_${c.id}`;
    rows.push([null, i + 1, c.institutionName, c.accountType, c.accountNumber || '', decedent.name, null, val, ...heirs.map(h => n(getAlloc(key, h.id)))]);
  });
  const cashTotal = assets.cashDeposits.reduce((s, c) => s + calculateCashValue(c), 0);
  rows.push([null, null, null, null, null, null, '小計 ★', cashTotal, ...heirs.map((h) => {
    const t = assets.cashDeposits.reduce((s, c) => s + getAlloc(`cashDeposits_${c.id}`, h.id), 0);
    return n(t);
  })]);
  starTotal += cashTotal;
  heirs.forEach((h, hi) => {
    heirStarTotals[hi] += assets.cashDeposits.reduce((s, c) => s + getAlloc(`cashDeposits_${c.id}`, h.id), 0);
  });

  // ===== 保険金 =====
  const deathIns = assets.insurances.filter(i => i.isDeathBenefit);
  if (deathIns.length > 0) {
    rows.push(['生保', null, '【保険会社】', '【保険種類】', '【証券番号】', '【受取人】']);
    deathIns.forEach((ins, i) => {
      const beneficiary = heirs.find(h => h.id === ins.beneficiaryHeirId);
      rows.push([null, i + 1, ins.insuranceCompany, null, ins.policyNumber, beneficiary?.name || '', null, ins.amount, ...heirs.map(h => h.id === ins.beneficiaryHeirId ? ins.amount : null)]);
    });
    const insResult = calculateInsuranceExemption(assets.insurances, legalHeirCount);
    rows.push([null, null, null, null, null, null, '小計', insResult.totalAmount]);
    rows.push([null, null, null, null, null, null, '非課税金額', -insResult.exemption]);
    rows.push([null, null, null, null, null, null, '差引 ★', insResult.taxableAmount, ...heirs.map(() => null)]);
    starTotal += insResult.taxableAmount;
  }

  // ===== 退職金 =====
  const retBenefits = assets.retirementBenefits || [];
  if (retBenefits.length > 0) {
    rows.push(['退職金', null, '【支給者】', null, '【受取人】']);
    retBenefits.forEach((rb, i) => {
      const beneficiary = heirs.find(h => h.id === rb.beneficiaryHeirId);
      rows.push([null, i + 1, rb.payerName, null, beneficiary?.name || '', null, null, rb.amount, ...heirs.map(h => h.id === rb.beneficiaryHeirId ? rb.amount : null)]);
    });
    const retTotal = retBenefits.reduce((s, r) => s + r.amount, 0);
    const retExemption = Math.min(retTotal, RETIREMENT_EXEMPTION_PER_HEIR * legalHeirCount);
    rows.push([null, null, null, null, null, null, '小計', retTotal]);
    rows.push([null, null, null, null, null, null, '非課税金額', -retExemption]);
    rows.push([null, null, null, null, null, null, '差引 ★', Math.max(0, retTotal - retExemption)]);
    starTotal += Math.max(0, retTotal - retExemption);
  }

  // ===== その他 =====
  if (assets.others.length > 0) {
    rows.push(['その他', null, '【種類】', '【名称等】']);
    assets.others.forEach((o, i) => {
      const val = calculateOtherAssetValue(o);
      const key = `others_${o.id}`;
      rows.push([null, i + 1, o.category, o.description, null, null, null, val, ...heirs.map(h => n(getAlloc(key, h.id)))]);
    });
    const otherTotal = assets.others.reduce((s, o) => s + calculateOtherAssetValue(o), 0);
    rows.push([null, null, null, null, null, null, '小計 ★', otherTotal, ...heirs.map((h) => {
      const t = assets.others.reduce((s, o) => s + getAlloc(`others_${o.id}`, h.id), 0);
      return n(t);
    })]);
    starTotal += otherTotal;
    heirs.forEach((h, hi) => {
      heirStarTotals[hi] += assets.others.reduce((s, o) => s + getAlloc(`others_${o.id}`, h.id), 0);
    });
  }

  // ===== 代償分割 =====
  rows.push(['代償分割', null, null, null, null, null, '★', 0, ...heirs.map(() => null)]);

  // ===== 取得財産の価額 =====
  rows.push(['取得財産の価額', null, '（＝★の合計）', null, null, null, null, starTotal, ...heirStarTotals.map(t => n(t))]);

  // ===== 債務・葬式費用 =====
  rows.push(['債務・葬式', null, '【種類】', '【債権者名】']);
  assets.debts.forEach((d, i) => {
    rows.push([null, i + 1, d.category || '未払金', d.creditor, null, null, null, d.amount, ...heirs.map(() => null)]);
  });
  assets.funeralExpenses.forEach((f, i) => {
    const deductible = Math.max(0, (f.amount || 0) - (f.nonDeductibleAmount || 0));
    rows.push([null, assets.debts.length + i + 1, '葬式費用', f.payee || f.description, null, null, null, deductible, ...heirs.map(() => null)]);
  });
  const debtTotal = assets.debts.reduce((s, d) => s + d.amount, 0);
  const funeralDeductible = assets.funeralExpenses.reduce((s, f) => s + Math.max(0, (f.amount || 0) - (f.nonDeductibleAmount || 0)), 0);
  rows.push([null, null, null, null, null, null, '債務・葬式費用の合計', debtTotal + funeralDeductible, ...heirs.map(() => null)]);

  // ===== 課税価格 =====
  rows.push([]);
  const taxablePrice = result.netTaxableValue;
  rows.push(['課税価格', null, '（＝〔取得財産の価額〕－〔債務・葬式費用の合計〕＋〔生前贈与加算額〕）', null, null, null, null, taxablePrice, ...result.heirTaxDetails.map(d => n(d.acquiredValue))]);

  // ===== 基礎控除額 =====
  rows.push(['基礎控除額', null, null, null, null, null, null, -result.basicDeduction, ...heirs.map(() => '-')]);

  // ===== 相続税の総額 =====
  const totalFinalTax = result.heirTaxDetails.reduce((s, d) => s + d.finalTax, 0);
  const effectiveRate = result.netTaxableValue > 0 ? (totalFinalTax / result.netTaxableValue * 100).toFixed(2) : '0';
  rows.push([`相続税の総額`, null, `（実効税率：${effectiveRate}%）`, null, null, null, null, result.totalInheritanceTax, ...result.heirTaxDetails.map(d => n(d.allocatedTax))]);

  // ===== 2割加算 =====
  rows.push(['2割加算', null, null, null, null, null, null, 0, ...heirs.map(() => 0)]);

  // ===== 税額控除 =====
  rows.push(['税額', '暦年課税の贈与税額控除', null, null, null, null, null, 0, ...heirs.map(() => 0)]);
  rows.push(['控除', '配偶者の税額軽減', null, null, null, null, null, null, ...result.heirTaxDetails.map(d => n(d.spouseDeduction))]);
  rows.push([null, '未成年者控除', null, null, null, null, null, null, ...result.heirTaxDetails.map(d => n(d.minorDeduction))]);
  rows.push([null, '障害者控除', null, null, null, null, null, null, ...result.heirTaxDetails.map(d => n(d.disabilityDeduction))]);
  rows.push([null, '相次相続控除', null, null, null, null, null, 0]);
  rows.push([null, '外国税額控除', null, null, null, null, null, 0]);
  const totalDeductions = result.heirTaxDetails.reduce((s, d) => s + d.spouseDeduction + d.minorDeduction + d.disabilityDeduction, 0);
  rows.push([null, null, null, null, null, null, '小計', totalDeductions, ...result.heirTaxDetails.map(d => n(d.spouseDeduction + d.minorDeduction + d.disabilityDeduction))]);

  // ===== 納付すべき相続税額 =====
  rows.push(['納付すべき相続税額', null, '（＝〔相続税の総額〕＋〔2割加算〕－〔税額控除〕－〔相続時精算〕）', null, null, null, null, totalFinalTax, ...result.heirTaxDetails.map(d => d.finalTax)]);

  // ===== 参考 =====
  rows.push([]);
  rows.push([null, null, null, '参考', '法定相続分', null, null, '-', ...heirs.map(h => {
    const ratio = legalRatios.get(h.id) || 0;
    return ratio > 0 ? `${Math.round(ratio * 1000) / 10}%` : '-';
  })]);

  const netEstate = starTotal - debtTotal - funeralDeductible;
  rows.push([null, null, null, null, '財産総額（＝資産総額－債務・葬式費用）', null, null, netEstate, ...heirStarTotals.map(t => n(t))]);

  // シート作成
  const ws = XLSX.utils.aoa_to_sheet(rows);

  // 列幅設定
  ws['!cols'] = [
    { wch: 8 }, { wch: 5 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 18 }, { wch: 16 },
    ...heirNames.map(() => ({ wch: 14 })),
  ];

  fmt(ws);

  XLSX.utils.book_append_sheet(wb, ws, '財産分割案');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  saveAs(new Blob([buf]), `財産分割案＆相続税概算_${decedent.name || '未入力'}.xlsx`);
}
