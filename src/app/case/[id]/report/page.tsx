'use client';

import React, { useMemo } from 'react';
import { useCaseStore } from '@/lib/store/case-store';
import { calculateInheritanceTax, calculateTotalAssetValue } from '@/lib/tax/inheritance-tax';
import {
  calculateLandValue, calculateBuildingValue, calculateCashValue,
  calculateListedStockValue, calculateUnlistedStockValue, calculateOtherAssetValue,
  calculateInsuranceExemption, calculateRetirementExemption, calculateDeductibleFuneralExpenses,
} from '@/lib/tax/asset-valuation';
import { countLegalHeirs } from '@/lib/tax/deductions';
import { getDisplayRelationship } from '@/types';
import { toWareki } from '@/lib/dates/wareki';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

function fmt(n: number): string { return n.toLocaleString('ja-JP'); }
function fmtMan(n: number): string {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}億円`;
  if (n >= 10_000) return `${Math.floor(n / 10_000).toLocaleString()}万円`;
  return `${fmt(n)}円`;
}

export default function ReportPage() {
  const currentCase = useCaseStore(s => s.getCurrentCase());
  if (!currentCase) return <p className="text-gray-500 p-8">案件を選択してください</p>;

  const { decedent, heirs, assets, referenceDate } = currentCase;
  const result = useMemo(() => {
    try { return calculateInheritanceTax(currentCase); } catch { return null; }
  }, [currentCase]);

  if (!result) return <p className="text-red-500 p-8">計算エラー</p>;

  const legalHeirCount = countLegalHeirs(heirs);
  const totalTax = result.heirTaxDetails.reduce((s, d) => s + d.finalTax, 0);
  const effectiveRate = result.netTaxableValue > 0 ? (totalTax / result.netTaxableValue * 100).toFixed(2) : '0';

  // 財産区分別
  const landTotal = assets.lands.reduce((s, l) => {
    const lb = l.linkedBuildingId ? assets.buildings.find(b => b.id === l.linkedBuildingId) : undefined;
    return s + calculateLandValue(l, lb, referenceDate);
  }, 0);
  const bldTotal = assets.buildings.reduce((s, b) => s + calculateBuildingValue(b), 0);
  const cashTotal = assets.cashDeposits.reduce((s, c) => s + calculateCashValue(c), 0);
  const stockTotal = assets.listedStocks.reduce((s, st) => s + calculateListedStockValue(st).totalValue, 0)
    + assets.unlistedStocks.reduce((s, st) => s + calculateUnlistedStockValue(st), 0);
  const insTotal = assets.insurances.reduce((s, i) => s + i.amount, 0);
  const retTotal = (assets.retirementBenefits || []).reduce((s, r) => s + r.amount, 0);
  const otherTotal = assets.others.reduce((s, o) => s + calculateOtherAssetValue(o), 0);
  const debtTotal = assets.debts.reduce((s, d) => s + d.amount, 0);
  const funeralTotal = assets.funeralExpenses.reduce((s, f) => s + Math.max(0, (f.amount || 0) - (f.nonDeductibleAmount || 0)), 0);
  const grossAssets = landTotal + bldTotal + cashTotal + stockTotal + insTotal + retTotal + otherTotal;

  const spouseHeirs = heirs.filter(h => h.relationship === 'spouse');
  const childHeirs = heirs.filter(h => ['child', 'adopted', 'grandchild_proxy'].includes(h.relationship));

  const categories = [
    { label: '不動産（土地）', amount: landTotal, color: '#D4AF37' },
    { label: '不動産（建物）', amount: bldTotal, color: '#B8860B' },
    { label: '預貯金', amount: cashTotal, color: '#1F4E79' },
    { label: '有価証券', amount: stockTotal, color: '#2E75B6' },
    { label: '保険金・退職金', amount: insTotal + retTotal, color: '#4A90D9' },
    { label: 'その他財産', amount: otherTotal, color: '#95B3D7' },
  ].filter(c => c.amount > 0);

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #report-container, #report-container * { visibility: visible; }
          #report-container { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          @page { size: A4 landscape; margin: 10mm; }
        }
      `}</style>

      <div className="no-print mb-4 flex items-center gap-3">
        <Button onClick={() => window.print()} variant="secondary">
          <Printer size={16} className="mr-2" />印刷 / PDF保存
        </Button>
        <span className="text-xs text-gray-500">ブラウザの印刷機能でPDF保存できます</span>
      </div>

      <div id="report-container" className="bg-white max-w-[1200px] mx-auto shadow-lg">
        {/* ヘッダー */}
        <div style={{ backgroundColor: '#1F4E79', padding: '24px 40px', color: 'white' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', letterSpacing: '4px', textAlign: 'center' }}>
            相続税試算のご説明
          </h1>
          <p style={{ textAlign: 'center', fontSize: '12px', opacity: 0.8, marginTop: '8px' }}>
            ご家族にわかりやすく、財産の全体像と税額の目安を整理したご説明資料
          </p>
        </div>

        <div style={{ padding: '32px 40px' }}>
          {/* セクション1＆2 横並び */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>

            {/* 1. ご家族構成 */}
            <div style={{ border: '1px solid #e0e0e0', borderRadius: '8px', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <span style={{ backgroundColor: '#1F4E79', color: 'white', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold' }}>1</span>
                <span style={{ fontWeight: 'bold', color: '#1F4E79', fontSize: '14px' }}>ご家族構成</span>
              </div>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <div style={{ backgroundColor: '#1F4E79', color: 'white', padding: '10px 16px', borderRadius: '6px', textAlign: 'center', minWidth: '80px' }}>
                  <div style={{ fontSize: '10px', opacity: 0.8 }}>被相続人</div>
                  <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{decedent.name || '（未入力）'}</div>
                </div>
                {heirs.map(h => (
                  <div key={h.id} style={{ backgroundColor: '#f5f5f5', border: '1px solid #ddd', padding: '10px 16px', borderRadius: '6px', textAlign: 'center', minWidth: '80px' }}>
                    <div style={{ fontSize: '10px', color: '#888' }}>{getDisplayRelationship(h)}</div>
                    <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#333' }}>{h.name || '（未入力）'}</div>
                  </div>
                ))}
              </div>
              <div style={{ backgroundColor: '#f0f4f8', padding: '8px 12px', borderRadius: '4px', fontSize: '12px', color: '#555' }}>
                法定相続人：{legalHeirCount}名（{spouseHeirs.length > 0 ? `配偶者${spouseHeirs.length}名・` : ''}子{childHeirs.length}名）
              </div>
            </div>

            {/* 2. 財産の内訳 */}
            <div style={{ border: '1px solid #e0e0e0', borderRadius: '8px', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <span style={{ backgroundColor: '#1F4E79', color: 'white', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold' }}>2</span>
                <span style={{ fontWeight: 'bold', color: '#1F4E79', fontSize: '14px' }}>財産の内訳</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
                {categories.map(c => (
                  <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '12px', height: '12px', backgroundColor: c.color, borderRadius: '2px', flexShrink: 0 }} />
                    <span style={{ fontSize: '12px', color: '#555', flex: 1 }}>{c.label}</span>
                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#333' }}>{fmtMan(c.amount)}</span>
                  </div>
                ))}
                {(debtTotal + funeralTotal) > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '12px', height: '12px', backgroundColor: '#cc0000', borderRadius: '2px', flexShrink: 0 }} />
                    <span style={{ fontSize: '12px', color: '#cc0000', flex: 1 }}>債務・葬式費用</span>
                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#cc0000' }}>▲{fmtMan(debtTotal + funeralTotal)}</span>
                  </div>
                )}
              </div>
              <div style={{ backgroundColor: '#FFF8E7', border: '2px solid #D4AF37', borderRadius: '6px', padding: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#888' }}>正味遺産額</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1F4E79' }}>{fmtMan(result.netTaxableValue)}</div>
              </div>
            </div>
          </div>

          {/* セクション3＆4 横並び */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>

            {/* 3. 相続税試算の概要 */}
            <div style={{ border: '1px solid #e0e0e0', borderRadius: '8px', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <span style={{ backgroundColor: '#1F4E79', color: 'white', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold' }}>3</span>
                <span style={{ fontWeight: 'bold', color: '#1F4E79', fontSize: '14px' }}>相続税試算の概要</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px' }}>
                {[
                  { icon: '🏛', label: '財産総額', value: fmt(result.totalAssetValue), prefix: '' },
                  { icon: '➖', label: '債務・葬式費用', value: fmt(result.totalDeductions), prefix: '△' },
                  { icon: '＝', label: '正味遺産額', value: fmt(result.netTaxableValue), prefix: '' },
                  { icon: '➖', label: '基礎控除額', value: fmt(result.basicDeduction), prefix: '△' },
                  { icon: '＝', label: '課税価格合計', value: fmt(result.taxableAmount), prefix: '' },
                ].map((row, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', backgroundColor: i === 4 ? '#f0f4f8' : 'transparent', borderRadius: '4px' }}>
                    <span style={{ fontSize: '14px', width: '20px', textAlign: 'center' }}>{row.icon}</span>
                    <span style={{ fontSize: '12px', color: '#555', flex: 1 }}>{row.label}</span>
                    <span style={{ fontSize: '13px', fontWeight: i === 4 ? 'bold' : 'normal', color: row.prefix ? '#cc0000' : '#333' }}>
                      {row.prefix}{row.value}円
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1, backgroundColor: '#1F4E79', color: 'white', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', opacity: 0.8 }}>相続税総額（概算）</div>
                  <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{fmtMan(result.totalInheritanceTax)}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px' }}>
                  <div style={{ fontSize: '10px', color: '#888' }}>実効税率</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1F4E79' }}>{effectiveRate}%</div>
                </div>
              </div>
            </div>

            {/* 4. 想定取得額と税額イメージ */}
            <div style={{ border: '1px solid #e0e0e0', borderRadius: '8px', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <span style={{ backgroundColor: '#1F4E79', color: 'white', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold' }}>4</span>
                <span style={{ fontWeight: 'bold', color: '#1F4E79', fontSize: '14px' }}>想定取得額と税額イメージ</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#1F4E79', color: 'white' }}>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>相続人</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>想定取得額</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>概算税額</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>備考</th>
                  </tr>
                </thead>
                <tbody>
                  {result.heirTaxDetails.map((d, i) => {
                    const heir = heirs.find(h => h.id === d.heirId);
                    const notes: string[] = [];
                    if (d.spouseDeduction > 0) notes.push('配偶者の税額軽減を考慮');
                    if (d.surchargeAmount > 0) notes.push('2割加算');
                    if (d.minorDeduction > 0) notes.push('未成年者控除');
                    if (d.disabilityDeduction > 0) notes.push('障害者控除');
                    if (notes.length === 0) notes.push('概算');
                    return (
                      <tr key={d.heirId} style={{ backgroundColor: i % 2 === 0 ? '#f9f9f9' : 'white', borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '8px 10px' }}>
                          <strong>{d.heirName}</strong>
                          <span style={{ fontSize: '10px', color: '#888', marginLeft: '4px' }}>
                            ({heir ? getDisplayRelationship(heir) : ''})
                          </span>
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 'bold' }}>{fmtMan(d.acquiredValue)}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 'bold', color: d.finalTax === 0 ? '#2e7d32' : '#1F4E79' }}>
                          {d.finalTax === 0 ? '0円' : fmtMan(d.finalTax)}
                        </td>
                        <td style={{ padding: '8px 10px', fontSize: '10px', color: '#888' }}>{notes.join('、')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ご説明のポイント */}
          <div style={{ backgroundColor: '#f8f6f0', border: '1px solid #D4AF37', borderRadius: '8px', padding: '16px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{ fontSize: '16px' }}>💡</span>
              <span style={{ fontWeight: 'bold', color: '#D4AF37', fontSize: '13px' }}>ご説明のポイント</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', fontSize: '11px', color: '#555', lineHeight: 1.7 }}>
              <div>
                <span style={{ color: '#2e7d32', marginRight: '4px' }}>✓</span>
                「配偶者の税額軽減」により、配偶者の負担は大きく抑えられる見込みです。
              </div>
              <div>
                <span style={{ color: '#2e7d32', marginRight: '4px' }}>✓</span>
                不動産評価・非上場株式・債務の整理により、税額が変動する可能性があります。
              </div>
              <div>
                <span style={{ color: '#2e7d32', marginRight: '4px' }}>✓</span>
                今後は、財産資料の確認と分割方針の整理を進めることで、より精緻な試算が可能です。
              </div>
            </div>
          </div>

          {/* フッター */}
          <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #ddd', textAlign: 'center', fontSize: '9px', color: '#aaa' }}>
            基準日: {toWareki(referenceDate)} ／ 作成日: {toWareki(new Date().toISOString().split('T')[0])} ／ ※本資料は概算であり、正確な税額は税理士にご確認ください。
          </div>
        </div>
      </div>
    </>
  );
}
