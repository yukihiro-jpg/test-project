'use client';

import { useCaseStore } from '@/lib/store/case-store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CurrencyInput, formatCurrency, formatManyen } from '@/components/common/currency-input';
import { calculateInsuranceExemption } from '@/lib/tax/asset-valuation';
import { countLegalHeirs } from '@/lib/tax/deductions';
import { Plus, Trash2 } from 'lucide-react';

export default function InsurancePage() {
  const currentCase = useCaseStore(s => s.getCurrentCase());
  const addAsset = useCaseStore(s => s.addAsset);
  const updateAsset = useCaseStore(s => s.updateAsset);
  const removeAsset = useCaseStore(s => s.removeAsset);

  if (!currentCase) return <p className="text-gray-500">案件を選択してください</p>;
  const items = currentCase.assets.insurances;
  const heirs = currentCase.heirs;
  const legalHeirCount = countLegalHeirs(heirs);
  const { totalAmount, exemption, taxableAmount } = calculateInsuranceExemption(items, legalHeirCount);

  const heirOptions = heirs.map(h => ({ value: h.id, label: h.name || '（未入力）' }));

  const handleAdd = () => {
    addAsset('insurances', {
      insuranceCompany: '', policyNumber: '', beneficiaryHeirId: '',
      amount: 0, isDeathBenefit: true, note: '',
    });
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">保険金</h1>
        <Button onClick={handleAdd}><Plus size={18} className="mr-2" />追加</Button>
      </div>

      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="py-4">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-600">保険金合計</p>
              <p className="font-semibold">{formatManyen(totalAmount)}</p>
            </div>
            <div>
              <p className="text-gray-600">非課税枠（500万×{legalHeirCount}人）</p>
              <p className="font-semibold text-green-700">▲{formatManyen(exemption)}</p>
            </div>
            <div>
              <p className="text-gray-600">課税対象額</p>
              <p className="font-semibold text-blue-700">{formatManyen(taxableAmount)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {items.map((item, i) => (
        <Card key={item.id}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>保険金 {i + 1}</CardTitle>
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold text-blue-700">{formatCurrency(item.amount)}</span>
              <Button variant="danger" size="sm" onClick={() => removeAsset('insurances', item.id)}>
                <Trash2 size={16} />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="保険会社名" value={item.insuranceCompany}
                onChange={e => updateAsset('insurances', item.id, { insuranceCompany: e.target.value })} />
              <Input label="証券番号" value={item.policyNumber}
                onChange={e => updateAsset('insurances', item.id, { policyNumber: e.target.value })} />
            </div>
            <Select label="受取人" value={item.beneficiaryHeirId}
              onChange={e => updateAsset('insurances', item.id, { beneficiaryHeirId: e.target.value })}
              options={heirOptions} />
            <CurrencyInput label="保険金額" value={item.amount}
              onChange={v => updateAsset('insurances', item.id, { amount: v })} />
            <Checkbox label="死亡保険金（みなし相続財産）" checked={item.isDeathBenefit}
              onChange={e => updateAsset('insurances', item.id, { isDeathBenefit: (e.target as HTMLInputElement).checked })} />
            <Input label="備考" value={item.note}
              onChange={e => updateAsset('insurances', item.id, { note: e.target.value })} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
