'use client';

import React, { useState, useMemo } from 'react';
import { useCaseStore } from '@/lib/store/case-store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CurrencyInput, formatCurrency, formatManyen } from '@/components/common/currency-input';
import { calculateInheritanceTax } from '@/lib/tax/inheritance-tax';
import { calculateAge } from '@/lib/dates/wareki';
import { RELATIONSHIP_LABELS } from '@/types';
import type { SecondaryInheritanceConfig } from '@/types';
import { Calculator, TrendingDown, ArrowRight } from 'lucide-react';

export default function SecondaryInheritancePage() {
  const currentCase = useCaseStore(s => s.getCurrentCase());
  const updateCurrentCase = useCaseStore(s => s.updateCurrentCase);

  const [config, setConfig] = useState<SecondaryInheritanceConfig>(
    currentCase?.secondaryConfig || {
      spouseAcquisitionRatio: 0.5,
      spouseOwnAssets: 0,
      spouseExpectedDeathAge: 85,
      estimatedAssetChangeRate: -0.01,
    }
  );
  const [showResult, setShowResult] = useState(false);

  if (!currentCase) return <p className="text-gray-500">案件を選択してください</p>;

  const heirs = currentCase.heirs;
  const spouse = heirs.find(h => h.relationship === 'spouse');
  const children = heirs.filter(h => ['child', 'adopted', 'grandchild_proxy'].includes(h.relationship));

  if (!spouse) {
    return (
      <div className="max-w-4xl space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">二次相続シミュレーション</h1>
        <Card className="bg-yellow-50 border-yellow-200">
          <CardContent className="py-6 text-center">
            <p className="text-gray-700">配偶者が相続人に登録されていないため、二次相続シミュレーションは利用できません。</p>
            <p className="text-sm text-gray-500 mt-2">相続人情報から配偶者を登録してください。</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <div className="max-w-4xl space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">二次相続シミュレーション</h1>
        <Card className="bg-yellow-50 border-yellow-200">
          <CardContent className="py-6 text-center">
            <p className="text-gray-700">子・養子が相続人に登録されていないため、二次相続シミュレーションは利用できません。</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const spouseAge = calculateAge(spouse.birthDate, currentCase.referenceDate);
  const yearsUntilSecondary = Math.max(1, config.spouseExpectedDeathAge - spouseAge);

  const primaryResult = useMemo(() => calculateInheritanceTax(currentCase), [currentCase]);
  const primaryTotalTax = primaryResult.heirTaxDetails.reduce((s, h) => s + h.finalTax, 0);

  const handleSimulate = async () => {
    updateCurrentCase({ secondaryConfig: config });
    setShowResult(true);
  };

  // 二次相続の簡易計算
  const secondaryCalc = useMemo(() => {
    if (!showResult) return null;

    const results: Array<{
      ratio: number;
      label: string;
      primaryTax: number;
      secondaryTax: number;
      combinedTax: number;
    }> = [];

    const ratios = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];

    for (const ratio of ratios) {
      // 一次相続：配偶者の取得額
      const spouseAcquired = Math.floor(primaryResult.netTaxableValue * ratio);

      // 一次相続の相続税（配偶者控除を考慮した簡易計算）
      const spouseTaxBeforeDeduction = primaryResult.totalInheritanceTax > 0
        ? Math.floor(primaryResult.totalInheritanceTax * ratio)
        : 0;

      // 配偶者控除
      const spouseLegalRatio = heirs.some(h => ['child', 'adopted', 'grandchild_proxy'].includes(h.relationship)) ? 0.5
        : heirs.some(h => h.relationship === 'parent' || h.relationship === 'grandparent') ? 2/3
        : 0.75;
      const spouseLimit = Math.max(160_000_000, primaryResult.netTaxableValue * spouseLegalRatio);
      const spouseDeduction = spouseAcquired <= spouseLimit ? spouseTaxBeforeDeduction : 0;

      const primaryOtherTax = primaryResult.totalInheritanceTax - spouseTaxBeforeDeduction;
      const primaryTax = Math.max(0, primaryOtherTax + spouseTaxBeforeDeduction - spouseDeduction);

      // 二次相続：配偶者が持つ財産
      const spouseEstate = (spouseAcquired + config.spouseOwnAssets) *
        Math.pow(1 + config.estimatedAssetChangeRate, yearsUntilSecondary);
      const secondaryHeirCount = children.length;
      const secondaryBasicDeduction = 30_000_000 + 6_000_000 * secondaryHeirCount;
      const secondaryTaxable = Math.max(0, Math.floor(spouseEstate) - secondaryBasicDeduction);

      // 二次相続の税額（法定相続分で計算）
      let secondaryTax = 0;
      if (secondaryTaxable > 0 && secondaryHeirCount > 0) {
        const perHeirShare = Math.floor(secondaryTaxable / secondaryHeirCount);
        // 速算表で計算
        const brackets = [
          { threshold: 10_000_000, rate: 0.10, deduction: 0 },
          { threshold: 30_000_000, rate: 0.15, deduction: 500_000 },
          { threshold: 50_000_000, rate: 0.20, deduction: 2_000_000 },
          { threshold: 100_000_000, rate: 0.30, deduction: 7_000_000 },
          { threshold: 200_000_000, rate: 0.40, deduction: 17_000_000 },
          { threshold: 300_000_000, rate: 0.45, deduction: 27_000_000 },
          { threshold: 600_000_000, rate: 0.50, deduction: 42_000_000 },
          { threshold: Infinity, rate: 0.55, deduction: 72_000_000 },
        ];
        for (const bracket of brackets) {
          if (perHeirShare <= bracket.threshold) {
            secondaryTax = Math.floor(perHeirShare * bracket.rate - bracket.deduction) * secondaryHeirCount;
            break;
          }
        }
      }

      results.push({
        ratio,
        label: ratio === spouseLegalRatio ? `${(ratio * 100).toFixed(0)}%（法定相続分）` : `${(ratio * 100).toFixed(0)}%`,
        primaryTax,
        secondaryTax: Math.max(0, secondaryTax),
        combinedTax: primaryTax + Math.max(0, secondaryTax),
      });
    }

    const optimal = results.reduce((min, r) => r.combinedTax < min.combinedTax ? r : min);
    return { results, optimal };
  }, [showResult, config, primaryResult, heirs, children, yearsUntilSecondary]);

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">二次相続シミュレーション</h1>
        <Button onClick={handleSimulate}>
          <Calculator size={18} className="mr-2" />シミュレーション実行
        </Button>
      </div>

      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="py-4 text-sm text-gray-700">
          <p>一次相続（現在のシミュレーション）で配偶者に多く財産を渡すと配偶者控除で一次相続の税額は下がりますが、
          二次相続（配偶者死亡時）の税額が増える場合があります。</p>
          <p className="mt-1">一次＋二次の合計税額が最小になる配偶者の取得割合を見つけるシミュレーションです。</p>
        </CardContent>
      </Card>

      {/* 前提条件入力 */}
      <Card>
        <CardHeader><CardTitle>前提条件</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-700">配偶者: {spouse.name}（現在{spouseAge}歳）</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-700">二次相続人: {children.map(c => c.name).join('、')}（{children.length}名）</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CurrencyInput
              label="配偶者の固有財産（相続以外で持っている財産）"
              value={config.spouseOwnAssets}
              onChange={v => setConfig(prev => ({ ...prev, spouseOwnAssets: v }))}
            />
            <Input
              label="配偶者の推定死亡年齢"
              type="number"
              value={config.spouseExpectedDeathAge}
              suffix="歳"
              onChange={e => setConfig(prev => ({ ...prev, spouseExpectedDeathAge: Number(e.target.value) }))}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="財産の年間増減率（マイナス=消費による減少）"
              type="number"
              value={(config.estimatedAssetChangeRate * 100)}
              suffix="%/年"
              step="0.5"
              onChange={e => setConfig(prev => ({ ...prev, estimatedAssetChangeRate: Number(e.target.value) / 100 }))}
            />
            <div className="space-y-1">
              <p className="text-sm text-gray-500">二次相続までの期間（推定）</p>
              <p className="text-lg font-semibold">{yearsUntilSecondary}年後</p>
            </div>
          </div>

          <Card className="bg-gray-50">
            <CardContent className="py-3 text-sm">
              <p>一次相続の課税価格合計: <span className="font-semibold">{formatManyen(primaryResult.netTaxableValue)}</span></p>
              <p>一次相続の相続税の総額: <span className="font-semibold">{formatManyen(primaryResult.totalInheritanceTax)}</span></p>
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      {/* シミュレーション結果 */}
      {secondaryCalc && (
        <>
          {/* 最適割合 */}
          <Card className="border-green-300 bg-green-50">
            <CardHeader><CardTitle className="text-green-800">最適な配偶者取得割合</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-6 text-center">
                <div>
                  <p className="text-sm text-gray-600">最適割合</p>
                  <p className="text-3xl font-bold text-green-700">{(secondaryCalc.optimal.ratio * 100).toFixed(0)}%</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">一次＋二次合計税額</p>
                  <p className="text-2xl font-bold">{formatManyen(secondaryCalc.optimal.combinedTax)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">法定相続分との差額</p>
                  {(() => {
                    const legalResult = secondaryCalc.results.find(r => r.ratio === 0.5);
                    const diff = legalResult ? legalResult.combinedTax - secondaryCalc.optimal.combinedTax : 0;
                    return (
                      <p className={`text-2xl font-bold ${diff > 0 ? 'text-green-700' : ''}`}>
                        {diff > 0 ? '▲' : ''}{formatManyen(diff)}
                      </p>
                    );
                  })()}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 比較テーブル */}
          <Card>
            <CardHeader><CardTitle>配偶者取得割合別 税額比較</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100 border-b">
                      <th className="p-2 text-left">配偶者取得割合</th>
                      <th className="p-2 text-right">一次相続税</th>
                      <th className="p-2 text-right">二次相続税</th>
                      <th className="p-2 text-right font-bold">合計税額</th>
                      <th className="p-2 text-center">グラフ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {secondaryCalc.results.map((r, i) => {
                      const isOptimal = r.ratio === secondaryCalc.optimal.ratio;
                      const maxCombined = Math.max(...secondaryCalc.results.map(x => x.combinedTax));
                      const barWidth = maxCombined > 0 ? (r.combinedTax / maxCombined * 100) : 0;
                      const primaryWidth = maxCombined > 0 ? (r.primaryTax / maxCombined * 100) : 0;
                      const secondaryWidth = maxCombined > 0 ? (r.secondaryTax / maxCombined * 100) : 0;
                      return (
                        <tr key={r.ratio} className={`border-b ${isOptimal ? 'bg-green-50 font-semibold' : i % 2 === 0 ? '' : 'bg-gray-50'}`}>
                          <td className="p-2">
                            {r.label}
                            {isOptimal && <span className="ml-2 text-xs text-green-700 bg-green-100 px-1.5 py-0.5 rounded">最適</span>}
                          </td>
                          <td className="p-2 text-right font-mono">{formatManyen(r.primaryTax)}</td>
                          <td className="p-2 text-right font-mono">{formatManyen(r.secondaryTax)}</td>
                          <td className="p-2 text-right font-mono font-bold">{formatManyen(r.combinedTax)}</td>
                          <td className="p-2">
                            <div className="flex h-4 rounded overflow-hidden bg-gray-200" style={{ width: '120px' }}>
                              <div className="bg-blue-500 h-full" style={{ width: `${primaryWidth}%` }} />
                              <div className="bg-orange-400 h-full" style={{ width: `${secondaryWidth}%` }} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="flex gap-4 mt-2 text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-blue-500 rounded" />一次相続税
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-orange-400 rounded" />二次相続税
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
