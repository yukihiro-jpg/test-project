'use client';

import React, { useState } from 'react';
import { useCaseStore } from '@/lib/store/case-store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { CurrencyInput, formatCurrency, formatManyen } from '@/components/common/currency-input';
import { calculateInsuranceExemption } from '@/lib/tax/asset-valuation';
import { countLegalHeirs } from '@/lib/tax/deductions';
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';

export default function InsurancePage() {
  const currentCase = useCaseStore(s => s.getCurrentCase());
  const addAsset = useCaseStore(s => s.addAsset);
  const updateAsset = useCaseStore(s => s.updateAsset);
  const removeAsset = useCaseStore(s => s.removeAsset);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!currentCase) return <p className="text-gray-500">案件を選択してください</p>;
  const items = currentCase.assets.insurances;
  const heirs = currentCase.heirs;
  const legalHeirCount = countLegalHeirs(heirs);
  const { totalAmount, exemption, taxableAmount } = calculateInsuranceExemption(items, legalHeirCount);

  const heirOptions = heirs.map(h => ({ value: h.id, label: h.name || '（未入力）' }));

  const handleAdd = () => {
    const id = addAsset('insurances', {
      insuranceCompany: '', policyNumber: '', beneficiaryHeirId: '',
      amount: 0, isDeathBenefit: true, note: '',
    });
    setExpandedId(id);
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

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 border-b">
              <th className="p-2 text-left w-8"></th>
              <th className="p-2 text-left w-8">No</th>
              <th className="p-2 text-left">保険会社</th>
              <th className="p-2 text-left">証券番号</th>
              <th className="p-2 text-right">保険金額</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <React.Fragment key={item.id}>
                <tr
                  className={`border-b cursor-pointer hover:bg-blue-50 ${i % 2 === 0 ? '' : 'bg-gray-50'} ${expandedId === item.id ? 'bg-blue-50' : ''}`}
                  onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                >
                  <td className="p-2">
                    {expandedId === item.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </td>
                  <td className="p-2">{i + 1}</td>
                  <td className="p-2">{item.insuranceCompany || '（未入力）'}</td>
                  <td className="p-2">{item.policyNumber || '-'}</td>
                  <td className="p-2 text-right font-medium">{formatCurrency(item.amount)}</td>
                </tr>
                {expandedId === item.id && (
                  <tr><td colSpan={5} className="p-0">
                    <div className="p-4 bg-white border-l-4 border-blue-400 space-y-4">
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
                      <div className="flex justify-end">
                        <Button variant="danger" size="sm" onClick={() => removeAsset('insurances', item.id)}>
                          <Trash2 size={16} className="mr-1" />削除
                        </Button>
                      </div>
                    </div>
                  </td></tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 font-semibold bg-gray-100">
              <td colSpan={4} className="p-2 text-right">合計</td>
              <td className="p-2 text-right">{formatCurrency(totalAmount)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
