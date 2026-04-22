'use client';

import React, { useState, useMemo } from 'react';
import { useCaseStore } from '@/lib/store/case-store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CurrencyInput, formatCurrency, formatManyen } from '@/components/common/currency-input';
import { calculateInheritanceTax } from '@/lib/tax/inheritance-tax';
import { simulateGiftTax } from '@/lib/tax/gift-tax';
import { countLegalHeirs } from '@/lib/tax/deductions';
import { calculateInsuranceExemption } from '@/lib/tax/asset-valuation';
import { INSURANCE_EXEMPTION_PER_HEIR, BASIC_DEDUCTION_PER_HEIR } from '@/lib/tax/tax-tables';
import { RELATIONSHIP_LABELS } from '@/types';
import type { GiftPlanEntry, GiftTaxSystem } from '@/types';
import { Calculator, Plus, Trash2, Shield, Home, Users, Gift, Building2, TrendingDown } from 'lucide-react';

// 節税対策の種類
interface TaxStrategy {
  id: string;
  type: string;
  enabled: boolean;
  // 生前贈与
  giftEntries?: GiftPlanEntry[];
  // 生命保険
  additionalInsurance?: number;
  // 養子縁組
  adoptionCount?: number;
  // 教育資金
  educationFundAmount?: number;
  // 住宅取得資金
  housingFundAmount?: number;
  // 不動産活用
  realEstateInvestment?: number;
  // 汎用
  estimatedReduction?: number;
  description?: string;
}

function estimateMarginalRate(taxableAmount: number): number {
  if (taxableAmount <= 10_000_000) return 0.10;
  if (taxableAmount <= 30_000_000) return 0.15;
  if (taxableAmount <= 50_000_000) return 0.20;
  if (taxableAmount <= 100_000_000) return 0.30;
  if (taxableAmount <= 200_000_000) return 0.40;
  if (taxableAmount <= 300_000_000) return 0.45;
  if (taxableAmount <= 600_000_000) return 0.50;
  return 0.55;
}

const STRATEGY_OPTIONS = [
  { value: 'gift', label: '生前贈与', icon: Gift },
  { value: 'life_insurance', label: '生命保険活用', icon: Shield },
  { value: 'adoption', label: '養子縁組', icon: Users },
  { value: 'housing_fund', label: '住宅取得資金贈与', icon: Home },
  { value: 'real_estate', label: '不動産活用', icon: Building2 },
];

export default function TaxSavingPage() {
  const currentCase = useCaseStore(s => s.getCurrentCase());
  const updateGiftPlan = useCaseStore(s => s.updateGiftPlan);
  const updateCurrentCase = useCaseStore(s => s.updateCurrentCase);

  const [strategies, setStrategies] = useState<TaxStrategy[]>(currentCase?.taxSavingStrategies as any[] || []);
  const [showResult, setShowResult] = useState(false);

  if (!currentCase) return <p className="text-gray-500">案件を選択してください</p>;
  if (currentCase.heirs.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">相続人を登録してからシミュレーションを実行してください</p>
      </div>
    );
  }

  const heirs = currentCase.heirs;
  const heirOptions = heirs.map(h => ({ value: h.id, label: `${h.name || '（未入力）'}（${RELATIONSHIP_LABELS[h.relationship]}）` }));
  const currentYear = new Date(currentCase.referenceDate).getFullYear() || new Date().getFullYear();

  const primaryResult = useMemo(() => calculateInheritanceTax(currentCase), [currentCase]);
  const primaryTotalTax = primaryResult.heirTaxDetails.reduce((s, h) => s + h.finalTax, 0);
  const marginalRate = estimateMarginalRate(primaryResult.taxableAmount);
  const legalHeirCount = countLegalHeirs(heirs);

  const addStrategy = (type: string) => {
    const id = `${type}_${Date.now()}`;
    const base: TaxStrategy = { id, type, enabled: true };
    switch (type) {
      case 'gift':
        base.giftEntries = [{
          heirId: heirs[0]?.id || '',
          annualAmount: 1_100_000,
          years: 10,
          startYear: currentYear,
          taxSystem: 'calendar' as GiftTaxSystem,
        }];
        break;
      case 'life_insurance':
        base.additionalInsurance = 5_000_000;
        break;
      case 'adoption':
        base.adoptionCount = 1;
        break;
      case 'housing_fund':
        base.housingFundAmount = 10_000_000;
        break;
      case 'real_estate':
        base.realEstateInvestment = 50_000_000;
        break;
    }
    setStrategies(prev => [...prev, base]);
    setShowResult(false);
  };

  const removeStrategy = (id: string) => {
    setStrategies(prev => prev.filter(s => s.id !== id));
    setShowResult(false);
  };

  const updateStrategy = (id: string, updates: Partial<TaxStrategy>) => {
    setStrategies(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    setShowResult(false);
  };

  const handleSave = () => {
    updateCurrentCase({ taxSavingStrategies: strategies as any });
    alert('節税対策を保存しました');
  };

  // 各対策の節税効果を計算
  const simulationResults = useMemo(() => {
    if (!showResult) return null;

    const results: Array<{ id: string; type: string; label: string; saving: number; giftTax: number; detail: string }> = [];

    for (const strategy of strategies.filter(s => s.enabled)) {
      switch (strategy.type) {
        case 'gift': {
          if (strategy.giftEntries && strategy.giftEntries.length > 0) {
            const giftResult = simulateGiftTax(
              { entries: strategy.giftEntries },
              heirs,
              currentCase.referenceDate,
              primaryResult
            );
            results.push({
              id: strategy.id, type: strategy.type,
              label: '生前贈与',
              saving: giftResult.taxSaving,
              giftTax: giftResult.totalGiftTax,
              detail: `贈与税${formatManyen(giftResult.totalGiftTax)}を含めた純節税額`,
            });
          }
          break;
        }
        case 'life_insurance': {
          const currentInsTotal = currentCase.assets.insurances
            .filter(i => i.isDeathBenefit)
            .reduce((s, i) => s + i.amount, 0);
          const maxExemption = INSURANCE_EXEMPTION_PER_HEIR * legalHeirCount;
          const currentExemptionUsed = Math.min(currentInsTotal, maxExemption);
          const remainingExemption = maxExemption - currentExemptionUsed;
          const additionalAmount = strategy.additionalInsurance || 0;
          const sheltered = Math.min(additionalAmount, remainingExemption);
          const saving = Math.floor(sheltered * marginalRate);
          results.push({
            id: strategy.id, type: strategy.type,
            label: '生命保険活用',
            saving,
            giftTax: 0,
            detail: `非課税枠残${formatManyen(remainingExemption)}のうち${formatManyen(sheltered)}を活用（税率${(marginalRate * 100).toFixed(0)}%）`,
          });
          break;
        }
        case 'adoption': {
          const count = strategy.adoptionCount || 1;
          const additionalDeduction = BASIC_DEDUCTION_PER_HEIR * count;
          const additionalInsExemption = INSURANCE_EXEMPTION_PER_HEIR * count;
          const totalReduction = additionalDeduction + additionalInsExemption;
          const saving = Math.floor(totalReduction * marginalRate);
          results.push({
            id: strategy.id, type: strategy.type,
            label: '養子縁組',
            saving,
            giftTax: 0,
            detail: `基礎控除+${formatManyen(additionalDeduction)}、保険非課税枠+${formatManyen(additionalInsExemption)}`,
          });
          break;
        }
        case 'housing_fund': {
          const amount = Math.min(strategy.housingFundAmount || 0, 10_000_000);
          const saving = Math.floor(amount * marginalRate);
          results.push({
            id: strategy.id, type: strategy.type,
            label: '住宅取得資金贈与',
            saving,
            giftTax: 0,
            detail: `最大1,000万円まで非課税（住宅の種類による）`,
          });
          break;
        }
        case 'real_estate': {
          const investment = strategy.realEstateInvestment || 0;
          // 現金→賃貸不動産：評価額 ≈ 投資額 × 42%（建物60% × 借家権30%控除）
          const valuationReduction = Math.floor(investment * 0.58);
          const saving = Math.floor(valuationReduction * marginalRate);
          results.push({
            id: strategy.id, type: strategy.type,
            label: '不動産活用',
            saving,
            giftTax: 0,
            detail: `現金${formatManyen(investment)}→賃貸不動産化で評価額約${(58)}%圧縮`,
          });
          break;
        }
      }
    }

    const totalSaving = results.reduce((s, r) => s + r.saving, 0);
    const totalGiftTax = results.reduce((s, r) => s + r.giftTax, 0);
    const afterTax = Math.max(0, primaryTotalTax - totalSaving);

    return { results, totalSaving, totalGiftTax, afterTax };
  }, [showResult, strategies, currentCase, heirs, primaryResult, primaryTotalTax, marginalRate, legalHeirCount]);

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">節税シミュレーション</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleSave} disabled={strategies.length === 0}>
            保存
          </Button>
          <Button onClick={() => { updateCurrentCase({ taxSavingStrategies: strategies as any }); setShowResult(true); }} disabled={strategies.filter(s => s.enabled).length === 0}>
            <Calculator size={18} className="mr-2" />シミュレーション実行
          </Button>
        </div>
      </div>

      {/* 現在の相続税 */}
      <Card className="bg-gray-50">
        <CardContent className="py-4">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-600">現在の相続税（対策前）</p>
              <p className="font-semibold text-xl text-blue-700">{formatManyen(primaryTotalTax)}</p>
            </div>
            <div>
              <p className="text-gray-600">課税遺産総額</p>
              <p className="font-semibold">{formatManyen(primaryResult.taxableAmount)}</p>
            </div>
            <div>
              <p className="text-gray-600">限界税率</p>
              <p className="font-semibold">{(marginalRate * 100).toFixed(0)}%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 対策追加ボタン */}
      <Card>
        <CardHeader><CardTitle>節税対策を追加</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {STRATEGY_OPTIONS.map(opt => {
              const Icon = opt.icon;
              return (
                <Button
                  key={opt.value}
                  variant="secondary"
                  size="sm"
                  onClick={() => addStrategy(opt.value)}
                  className="flex items-center gap-2 justify-start"
                >
                  <Icon size={16} />
                  {opt.label}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 各対策の設定 */}
      {strategies.map(strategy => (
        <Card key={strategy.id} className={strategy.enabled ? '' : 'opacity-50'}>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <Checkbox
                label=""
                checked={strategy.enabled}
                onChange={e => updateStrategy(strategy.id, { enabled: (e.target as HTMLInputElement).checked })}
              />
              <CardTitle className="text-base">
                {STRATEGY_OPTIONS.find(o => o.value === strategy.type)?.label || strategy.type}
              </CardTitle>
            </div>
            <Button variant="danger" size="sm" onClick={() => removeStrategy(strategy.id)}>
              <Trash2 size={16} />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 生前贈与 */}
            {strategy.type === 'gift' && strategy.giftEntries && (
              <div className="space-y-3">
                {strategy.giftEntries.map((entry, i) => (
                  <div key={i} className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
                    <Select label="受贈者" value={entry.heirId}
                      onChange={e => {
                        const newEntries = [...(strategy.giftEntries || [])];
                        newEntries[i] = { ...newEntries[i], heirId: e.target.value };
                        updateStrategy(strategy.id, { giftEntries: newEntries });
                      }}
                      options={heirOptions} />
                    <Select label="方式" value={entry.taxSystem}
                      onChange={e => {
                        const newEntries = [...(strategy.giftEntries || [])];
                        newEntries[i] = { ...newEntries[i], taxSystem: e.target.value as GiftTaxSystem };
                        updateStrategy(strategy.id, { giftEntries: newEntries });
                      }}
                      options={[{ value: 'calendar', label: '暦年課税' }, { value: 'settlement', label: '精算課税' }]} />
                    <CurrencyInput label="年間額" value={entry.annualAmount}
                      onChange={v => {
                        const newEntries = [...(strategy.giftEntries || [])];
                        newEntries[i] = { ...newEntries[i], annualAmount: v };
                        updateStrategy(strategy.id, { giftEntries: newEntries });
                      }} />
                    <Input label="年数" type="number" value={entry.years} suffix="年"
                      onChange={e => {
                        const newEntries = [...(strategy.giftEntries || [])];
                        newEntries[i] = { ...newEntries[i], years: Number(e.target.value) };
                        updateStrategy(strategy.id, { giftEntries: newEntries });
                      }} />
                    <Input label="開始年" type="number" value={entry.startYear}
                      onChange={e => {
                        const newEntries = [...(strategy.giftEntries || [])];
                        newEntries[i] = { ...newEntries[i], startYear: Number(e.target.value) };
                        updateStrategy(strategy.id, { giftEntries: newEntries });
                      }} />
                  </div>
                ))}
                <Button variant="secondary" size="sm" onClick={() => {
                  const newEntries = [...(strategy.giftEntries || []), {
                    heirId: heirs[0]?.id || '', annualAmount: 1_100_000, years: 10,
                    startYear: currentYear, taxSystem: 'calendar' as GiftTaxSystem,
                  }];
                  updateStrategy(strategy.id, { giftEntries: newEntries });
                }}>
                  <Plus size={14} className="mr-1" />受贈者追加
                </Button>
              </div>
            )}

            {/* 生命保険 */}
            {strategy.type === 'life_insurance' && (
              <div className="space-y-2">
                <CurrencyInput label="新規加入保険金額（一時払い）" value={strategy.additionalInsurance || 0}
                  onChange={v => updateStrategy(strategy.id, { additionalInsurance: v })} />
                <p className="text-xs text-gray-500">
                  現在の保険金非課税枠: 500万円 × {legalHeirCount}人 = {formatManyen(INSURANCE_EXEMPTION_PER_HEIR * legalHeirCount)}
                </p>
              </div>
            )}

            {/* 養子縁組 */}
            {strategy.type === 'adoption' && (
              <div className="space-y-2">
                <Input label="養子の人数" type="number" value={strategy.adoptionCount || 1}
                  onChange={e => updateStrategy(strategy.id, { adoptionCount: Math.min(2, Math.max(1, Number(e.target.value))) })} />
                <p className="text-xs text-gray-500">
                  実子がいる場合は1人、いない場合は2人までが法定相続人にカウントされます。
                  基礎控除が600万円、保険金非課税枠が500万円増加します。
                </p>
              </div>
            )}

            {/* 住宅取得資金 */}
            {strategy.type === 'housing_fund' && (
              <div className="space-y-2">
                <CurrencyInput label="贈与額" value={strategy.housingFundAmount || 0}
                  onChange={v => updateStrategy(strategy.id, { housingFundAmount: Math.min(v, 10_000_000) })} />
                <p className="text-xs text-gray-500">
                  子・孫の住宅取得資金として贈与。省エネ住宅は最大1,000万円まで非課税。
                </p>
              </div>
            )}

            {/* 不動産活用 */}
            {strategy.type === 'real_estate' && (
              <div className="space-y-2">
                <CurrencyInput label="投資額（現金から不動産へ）" value={strategy.realEstateInvestment || 0}
                  onChange={v => updateStrategy(strategy.id, { realEstateInvestment: v })} />
                <p className="text-xs text-gray-500">
                  現金を賃貸不動産に転換すると、相続税評価額が約42%に圧縮されます。
                  （建物の固定資産税評価額 ≈ 60% × 借家権割合30%控除）
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* シミュレーション結果 */}
      {simulationResults && (
        <>
          <Card className="border-green-300 bg-green-50">
            <CardHeader><CardTitle className="text-green-800">節税シミュレーション結果</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-sm text-gray-600">対策前</p>
                  <p className="text-xl font-bold">{formatManyen(primaryTotalTax)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">対策後（推定）</p>
                  <p className="text-xl font-bold text-blue-700">{formatManyen(simulationResults.afterTax)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">節税額</p>
                  <p className="text-xl font-bold text-green-700">▲{formatManyen(simulationResults.totalSaving)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">贈与税等コスト</p>
                  <p className="text-xl font-bold text-orange-600">{formatManyen(simulationResults.totalGiftTax)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>対策別 効果一覧</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-100 border-b">
                    <th className="p-2 text-left">対策</th>
                    <th className="p-2 text-right">節税効果</th>
                    <th className="p-2 text-left">内容</th>
                  </tr>
                </thead>
                <tbody>
                  {simulationResults.results.map((r, i) => (
                    <tr key={r.id} className={`border-b ${i % 2 === 0 ? '' : 'bg-gray-50'}`}>
                      <td className="p-2 font-medium">{r.label}</td>
                      <td className="p-2 text-right font-mono text-green-700">▲{formatManyen(r.saving)}</td>
                      <td className="p-2 text-gray-600 text-xs">{r.detail}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-bold bg-gray-100">
                    <td className="p-2">合計節税額</td>
                    <td className="p-2 text-right font-mono text-green-700">▲{formatManyen(simulationResults.totalSaving)}</td>
                    <td className="p-2"></td>
                  </tr>
                </tfoot>
              </table>
            </CardContent>
          </Card>

          <Card className="bg-yellow-50 border-yellow-200">
            <CardContent className="py-4 text-xs text-gray-600">
              <p className="font-medium mb-1">注意事項</p>
              <ul className="list-disc list-inside space-y-1">
                <li>各対策の効果は概算です。複数対策の相互影響は考慮されていません。</li>
                <li>実際の節税対策は税理士等の専門家と相談の上実施してください。</li>
                <li>贈与税の計算は暦年課税・相続時精算課税の基本計算に基づいています。</li>
                <li>不動産活用の評価額圧縮率は一般的な目安です。</li>
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
