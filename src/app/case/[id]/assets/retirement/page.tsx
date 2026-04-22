'use client';

import React from 'react';
import { useCaseStore } from '@/lib/store/case-store';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/components/common/currency-input';
import { countLegalHeirs } from '@/lib/tax/deductions';
import { RETIREMENT_EXEMPTION_PER_HEIR } from '@/lib/tax/tax-tables';
import { Plus, Trash2 } from 'lucide-react';

const inputClass = 'w-full border border-gray-300 rounded px-2 py-1 text-sm';
const inputClassRight = `${inputClass} text-right`;

function parseNumber(s: string): number {
  return Number(s.replace(/,/g, '')) || 0;
}

function formatNumber(n: number): string {
  if (n === 0) return '';
  return n.toLocaleString('ja-JP');
}

export default function RetirementBenefitPage() {
  const currentCase = useCaseStore(s => s.getCurrentCase());
  const addAsset = useCaseStore(s => s.addAsset);
  const updateAsset = useCaseStore(s => s.updateAsset);
  const removeAsset = useCaseStore(s => s.removeAsset);

  if (!currentCase) return <p className="text-gray-500">案件を選択してください</p>;

  const items = currentCase.assets.retirementBenefits;
  const heirs = currentCase.heirs;
  const legalHeirCount = countLegalHeirs(heirs);

  const totalAmount = items.reduce((s, i) => s + i.amount, 0);
  const exemption = RETIREMENT_EXEMPTION_PER_HEIR * legalHeirCount;
  const taxableAmount = Math.max(0, totalAmount - exemption);

  function handleAdd() {
    addAsset('retirementBenefits', {
      payerName: '',
      beneficiaryHeirId: '',
      amount: 0,
      note: '',
    });
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">退職金</h1>
        <Button size="sm" onClick={handleAdd}>
          <Plus size={16} className="mr-1" />追加
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-300">
              <th className="p-2 text-center border border-gray-300 whitespace-nowrap">No</th>
              <th className="p-2 text-center border border-gray-300 whitespace-nowrap">支給者名</th>
              <th className="p-2 text-center border border-gray-300 whitespace-nowrap">受取人</th>
              <th className="p-2 text-center border border-gray-300 whitespace-nowrap">金額</th>
              <th className="p-2 text-center border border-gray-300 whitespace-nowrap">備考</th>
              <th className="p-2 text-center border border-gray-300 whitespace-nowrap w-10">削除</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-gray-400 border border-gray-300">
                  データがありません。「追加」ボタンで退職金を登録してください。
                </td>
              </tr>
            )}
            {items.map((item, i) => (
              <tr key={item.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="p-1 border border-gray-300 text-center">{i + 1}</td>
                <td className="p-1 border border-gray-300">
                  <input
                    className={inputClass}
                    value={item.payerName}
                    onChange={e => updateAsset('retirementBenefits', item.id, { payerName: e.target.value })}
                    placeholder="支給者名"
                  />
                </td>
                <td className="p-1 border border-gray-300">
                  <select
                    className={inputClass}
                    value={item.beneficiaryHeirId}
                    onChange={e => updateAsset('retirementBenefits', item.id, { beneficiaryHeirId: e.target.value })}
                  >
                    <option value="">選択してください</option>
                    {heirs.map(h => (
                      <option key={h.id} value={h.id}>{h.name || '（未入力）'}</option>
                    ))}
                  </select>
                </td>
                <td className="p-1 border border-gray-300">
                  <input
                    type="text"
                    className={inputClassRight}
                    value={formatNumber(item.amount)}
                    onChange={e => updateAsset('retirementBenefits', item.id, { amount: parseNumber(e.target.value) })}
                    placeholder="0"
                  />
                </td>
                <td className="p-1 border border-gray-300">
                  <input
                    className={inputClass}
                    value={item.note}
                    onChange={e => updateAsset('retirementBenefits', item.id, { note: e.target.value })}
                    placeholder="備考"
                  />
                </td>
                <td className="p-1 border border-gray-300 text-center">
                  <button
                    className="text-red-500 hover:text-red-700 p-1"
                    onClick={() => removeAsset('retirementBenefits', item.id)}
                    title="削除"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          {items.length > 0 && (
            <tfoot>
              <tr className="bg-gray-100 font-semibold border-t-2 border-gray-400">
                <td colSpan={3} className="p-2 text-right border border-gray-300">合計</td>
                <td className="p-2 text-right border border-gray-300">
                  {formatCurrency(totalAmount)}
                </td>
                <td colSpan={2} className="border border-gray-300"></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Summary: 非課税枠 */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-gray-600">退職金合計</p>
            <p className="font-semibold">{formatCurrency(totalAmount)}</p>
          </div>
          <div>
            <p className="text-gray-600">非課税枠（500万円 × {legalHeirCount}人）</p>
            <p className="font-semibold text-green-700">▲ {formatCurrency(exemption)}</p>
          </div>
          <div>
            <p className="text-gray-600">課税対象額</p>
            <p className="font-semibold text-blue-700">{formatCurrency(taxableAmount)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
