'use client';

import { useCaseStore } from '@/lib/store/case-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatManyen } from '@/components/common/currency-input';
import { calculateInheritanceTax } from '@/lib/tax/inheritance-tax';
import { RELATIONSHIP_LABELS } from '@/types';

export default function SimulationPage() {
  const currentCase = useCaseStore(s => s.getCurrentCase());

  if (!currentCase) return <p className="text-gray-500">案件を選択してください</p>;
  if (currentCase.heirs.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">相続人を登録してからシミュレーションを実行してください</p>
      </div>
    );
  }

  const result = calculateInheritanceTax(currentCase);
  const totalFinalTax = result.heirTaxDetails.reduce((s, h) => s + h.finalTax, 0);

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">相続税シミュレーション結果</h1>

      {/* 概要 */}
      <Card>
        <CardHeader><CardTitle>計算概要</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <tbody>
              {[
                ['財産総額（保険金含む）', result.totalAssetValue],
                ['債務・葬式費用', -result.totalDeductions],
                ['保険金非課税枠', -result.insuranceExemption],
                ['課税価格合計', result.netTaxableValue],
                ['基礎控除額', -result.basicDeduction],
                ['課税遺産総額', result.taxableAmount],
              ].map(([label, value]) => (
                <tr key={String(label)} className="border-b">
                  <td className="py-2 text-gray-600">{label}</td>
                  <td className="py-2 text-right font-mono">
                    <span className={(value as number) < 0 ? 'text-red-600' : ''}>
                      {(value as number) < 0 ? '▲ ' : ''}{formatCurrency(Math.abs(value as number))}
                    </span>
                  </td>
                </tr>
              ))}
              <tr className="border-b-2 border-blue-500">
                <td className="py-2 font-semibold text-gray-900">相続税の総額</td>
                <td className="py-2 text-right font-mono font-semibold text-blue-700">
                  {formatCurrency(result.totalInheritanceTax)}
                </td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* 各相続人の詳細 */}
      <Card>
        <CardHeader><CardTitle>各相続人の相続税額</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 bg-gray-50">
                  <th className="py-2 px-3 text-left">相続人</th>
                  <th className="py-2 px-3 text-right">取得額</th>
                  <th className="py-2 px-3 text-right">法定相続分</th>
                  <th className="py-2 px-3 text-right">按分税額</th>
                  <th className="py-2 px-3 text-right">控除合計</th>
                  <th className="py-2 px-3 text-right font-semibold">納付税額</th>
                </tr>
              </thead>
              <tbody>
                {result.heirTaxDetails.map(detail => {
                  const heir = currentCase.heirs.find(h => h.id === detail.heirId);
                  const totalDeduction = detail.spouseDeduction + detail.minorDeduction + detail.disabilityDeduction;
                  return (
                    <tr key={detail.heirId} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-3">
                        <div>{detail.heirName || '（未入力）'}</div>
                        <div className="text-xs text-gray-500">
                          {heir ? RELATIONSHIP_LABELS[heir.relationship] : ''}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-right font-mono">{formatManyen(detail.acquiredValue)}</td>
                      <td className="py-2 px-3 text-right">{(detail.legalShareRatio * 100).toFixed(1)}%</td>
                      <td className="py-2 px-3 text-right font-mono">{formatManyen(detail.allocatedTax)}</td>
                      <td className="py-2 px-3 text-right font-mono text-red-600">
                        {totalDeduction > 0 ? `▲${formatManyen(totalDeduction)}` : '-'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-semibold text-blue-700">
                        {formatCurrency(detail.finalTax)}
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-blue-500 bg-blue-50">
                  <td className="py-2 px-3 font-semibold" colSpan={5}>合計納付税額</td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-blue-700 text-lg">
                    {formatCurrency(totalFinalTax)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 控除詳細 */}
      {result.heirTaxDetails.some(d => d.spouseDeduction > 0 || d.minorDeduction > 0 || d.disabilityDeduction > 0) && (
        <Card>
          <CardHeader><CardTitle>税額控除の内訳</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="py-2 px-3 text-left">相続人</th>
                  <th className="py-2 px-3 text-right">配偶者控除</th>
                  <th className="py-2 px-3 text-right">未成年者控除</th>
                  <th className="py-2 px-3 text-right">障害者控除</th>
                </tr>
              </thead>
              <tbody>
                {result.heirTaxDetails
                  .filter(d => d.spouseDeduction > 0 || d.minorDeduction > 0 || d.disabilityDeduction > 0)
                  .map(detail => (
                    <tr key={detail.heirId} className="border-b">
                      <td className="py-2 px-3">{detail.heirName}</td>
                      <td className="py-2 px-3 text-right font-mono">
                        {detail.spouseDeduction > 0 ? formatManyen(detail.spouseDeduction) : '-'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono">
                        {detail.minorDeduction > 0 ? formatManyen(detail.minorDeduction) : '-'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono">
                        {detail.disabilityDeduction > 0 ? formatManyen(detail.disabilityDeduction) : '-'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
