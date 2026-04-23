'use client';

import { useCaseStore } from '@/lib/store/case-store';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/components/common/currency-input';
import { calculateDeductibleFuneralExpenses } from '@/lib/tax/asset-valuation';
import { Plus, Trash2 } from 'lucide-react';
import { useState, useCallback } from 'react';

const inputClass =
  'w-full border border-gray-300 rounded px-1.5 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500';

/* ── number formatting helpers ── */
function formatNum(n: number): string {
  if (!n) return '';
  return n.toLocaleString('ja-JP');
}

function parseNum(s: string): number {
  return Number(s.replace(/,/g, '')) || 0;
}

/* ── inline money input ── */
function MoneyCell({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [focused, setFocused] = useState(false);
  const [raw, setRaw] = useState('');

  const handleFocus = useCallback(() => {
    setFocused(true);
    setRaw(value ? String(value) : '');
  }, [value]);

  const handleBlur = useCallback(() => {
    setFocused(false);
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const digits = e.target.value.replace(/[^0-9]/g, '');
      setRaw(digits);
      onChange(Number(digits) || 0);
    },
    [onChange],
  );

  return (
    <input
      type="text"
      inputMode="numeric"
      value={focused ? raw : formatNum(value)}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={`${inputClass} text-right`}
    />
  );
}

export default function FuneralPage() {
  const currentCase = useCaseStore(s => s.getCurrentCase());
  const addAsset = useCaseStore(s => s.addAsset);
  const updateAsset = useCaseStore(s => s.updateAsset);
  const removeAsset = useCaseStore(s => s.removeAsset);

  if (!currentCase) return <p className="text-gray-500">案件を選択してください</p>;

  const items = currentCase.assets.funeralExpenses;
  const deductibleTotal = calculateDeductibleFuneralExpenses(items);
  const nonDeductibleTotal = items
    .filter(e => !e.isDeductible)
    .reduce((s, e) => s + e.amount, 0);
  const total = items.reduce((sum, item) => sum + item.amount, 0);

  const handleAdd = () => {
    addAsset('funeralExpenses', {
      description: '',
      amount: 0,
      isDeductible: true,
      note: '',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">葬式費用</h1>
        <Button onClick={handleAdd}>
          <Plus size={18} className="mr-2" />
          追加
        </Button>
      </div>

      {/* Summary */}
      <div className="flex gap-6 rounded border border-blue-200 bg-blue-50 px-4 py-3 text-sm">
        <div>
          <span className="text-gray-600">控除対象合計：</span>
          <span className="font-semibold text-green-700">
            {formatCurrency(deductibleTotal)}
          </span>
        </div>
        <div>
          <span className="text-gray-600">控除対象外合計：</span>
          <span className="font-semibold text-gray-500">
            {formatCurrency(nonDeductibleTotal)}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100 border-b">
              <th className="p-2 text-center border border-gray-300 w-12">No</th>
              <th className="p-2 text-center border border-gray-300">内容</th>
              <th className="p-2 text-center border border-gray-300">金額</th>
              <th className="p-2 text-center border border-gray-300 w-20">控除対象</th>
              <th className="p-2 text-center border border-gray-300">備考</th>
              <th className="p-2 text-center border border-gray-300 w-12">削除</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={item.id} className={i % 2 === 0 ? '' : 'bg-gray-50'}>
                <td className="p-2 border border-gray-300 text-center">{i + 1}</td>
                <td className="p-2 border border-gray-300">
                  <input
                    type="text"
                    value={item.description}
                    onChange={e =>
                      updateAsset('funeralExpenses', item.id, {
                        description: e.target.value,
                      })
                    }
                    className={inputClass}
                    placeholder="通夜・告別式費用、火葬費用等"
                  />
                </td>
                <td className="p-2 border border-gray-300">
                  <MoneyCell
                    value={item.amount}
                    onChange={v =>
                      updateAsset('funeralExpenses', item.id, { amount: v })
                    }
                  />
                </td>
                <td className="p-2 border border-gray-300 text-center">
                  <input
                    type="checkbox"
                    checked={item.isDeductible}
                    onChange={e =>
                      updateAsset('funeralExpenses', item.id, {
                        isDeductible: e.target.checked,
                      })
                    }
                    className="h-4 w-4"
                  />
                </td>
                <td className="p-2 border border-gray-300">
                  <input
                    type="text"
                    value={item.note}
                    onChange={e =>
                      updateAsset('funeralExpenses', item.id, {
                        note: e.target.value,
                      })
                    }
                    className={inputClass}
                  />
                </td>
                <td className="p-2 border border-gray-300 text-center">
                  <button
                    type="button"
                    onClick={() => removeAsset('funeralExpenses', item.id)}
                    className="text-red-600 hover:text-red-800"
                    aria-label="削除"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-100 font-semibold border-t-2">
              <td colSpan={2} className="p-2 text-right border border-gray-300">
                合計
              </td>
              <td className="p-2 text-right border border-gray-300">
                {formatCurrency(total)}
              </td>
              <td className="border border-gray-300" colSpan={3}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
