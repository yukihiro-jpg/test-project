'use client';

import { useCaseStore } from '@/lib/store/case-store';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/components/common/currency-input';
import { getDisplayRelationship } from '@/types';
import { Plus, Trash2, Link } from 'lucide-react';
import { useState, useCallback } from 'react';

type DebtCategory = '公租公課' | '未払金' | '借入金' | '預り敷金' | 'その他';
const DEBT_CATEGORIES: DebtCategory[] = ['公租公課', '未払金', '借入金', '預り敷金', 'その他'];

const inputClass =
  'w-full border border-gray-300 rounded px-1.5 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500';

function formatNum(n: number): string {
  if (!n) return '';
  return n.toLocaleString('ja-JP');
}

function MoneyCell({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [focused, setFocused] = useState(false);
  const [raw, setRaw] = useState('');

  const handleFocus = useCallback(() => {
    setFocused(true);
    setRaw(value ? String(value) : '');
  }, [value]);
  const handleBlur = useCallback(() => setFocused(false), []);
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

export default function DebtPage() {
  const currentCase = useCaseStore(s => s.getCurrentCase());
  const addAsset = useCaseStore(s => s.addAsset);
  const updateAsset = useCaseStore(s => s.updateAsset);
  const removeAsset = useCaseStore(s => s.removeAsset);

  if (!currentCase) return <p className="text-gray-500">案件を選択してください</p>;

  const items = currentCase.assets.debts;
  const heirs = currentCase.heirs;
  const total = items.reduce((sum, item) => sum + item.amount, 0);

  const handleAdd = () => {
    addAsset('debts', {
      category: '未払金',
      subCategory: '',
      creditor: '',
      creditorAddress: '',
      description: '',
      debtDate: '',
      dueDate: '',
      payerHeirId: '',
      amount: 0,
      note: '',
    });
  };

  const isAutoSynced = (note: string) => note.startsWith('[自動連動]');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">債務</h1>
        <Button onClick={handleAdd}>
          <Plus size={18} className="mr-2" />追加
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="border-collapse text-sm w-max">
          <thead>
            <tr className="bg-gray-100 border-b">
              <th className="p-2 text-center border border-gray-300 w-12">No</th>
              <th className="p-2 text-center border border-gray-300" style={{ minWidth: '100px' }}>種類</th>
              <th className="p-2 text-center border border-gray-300" style={{ minWidth: '120px' }}>細目</th>
              <th className="p-2 text-center border border-gray-300" style={{ minWidth: '140px' }}>債権者</th>
              <th className="p-2 text-center border border-gray-300" style={{ minWidth: '180px' }}>債権者住所</th>
              <th className="p-2 text-center border border-gray-300" style={{ minWidth: '130px' }}>発生年月日</th>
              <th className="p-2 text-center border border-gray-300" style={{ minWidth: '130px' }}>弁済期日</th>
              <th className="p-2 text-center border border-gray-300" style={{ minWidth: '140px' }}>支払者</th>
              <th className="p-2 text-center border border-gray-300" style={{ minWidth: '140px' }}>内容</th>
              <th className="p-2 text-center border border-gray-300" style={{ minWidth: '130px' }}>金額</th>
              <th className="p-2 text-center border border-gray-300" style={{ minWidth: '140px' }}>備考</th>
              <th className="p-2 text-center border border-gray-300 w-12">削除</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={item.id} className={i % 2 === 0 ? '' : 'bg-gray-50'}>
                <td className="p-1 border border-gray-300 text-center">{i + 1}</td>
                <td className="p-1 border border-gray-300">
                  <select
                    value={item.category || '未払金'}
                    onChange={e => updateAsset('debts', item.id, { category: e.target.value as DebtCategory })}
                    className={`${inputClass} pr-6`}
                  >
                    {DEBT_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </td>
                <td className="p-1 border border-gray-300">
                  <input type="text" value={item.subCategory || ''}
                    onChange={e => updateAsset('debts', item.id, { subCategory: e.target.value })}
                    className={inputClass} placeholder="固定資産税,医療費等" />
                </td>
                <td className="p-1 border border-gray-300">
                  <input type="text" value={item.creditor}
                    onChange={e => updateAsset('debts', item.id, { creditor: e.target.value })}
                    className={inputClass} placeholder="債権者名" />
                </td>
                <td className="p-1 border border-gray-300">
                  <input type="text" value={item.creditorAddress || ''}
                    onChange={e => updateAsset('debts', item.id, { creditorAddress: e.target.value })}
                    className={inputClass} placeholder="住所" />
                </td>
                <td className="p-1 border border-gray-300">
                  <input type="date" value={item.debtDate || ''}
                    onChange={e => updateAsset('debts', item.id, { debtDate: e.target.value })}
                    className={inputClass} />
                </td>
                <td className="p-1 border border-gray-300">
                  <input type="date" value={item.dueDate || ''}
                    onChange={e => updateAsset('debts', item.id, { dueDate: e.target.value })}
                    className={inputClass} />
                </td>
                <td className="p-1 border border-gray-300">
                  <select value={item.payerHeirId || ''}
                    onChange={e => updateAsset('debts', item.id, { payerHeirId: e.target.value })}
                    className={`${inputClass} pr-6`}>
                    <option value="">未指定</option>
                    {heirs.map(h => (
                      <option key={h.id} value={h.id}>
                        {h.name || '（未入力）'}（{getDisplayRelationship(h)}）
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-1 border border-gray-300">
                  <input type="text" value={item.description}
                    onChange={e => updateAsset('debts', item.id, { description: e.target.value })}
                    className={inputClass} />
                </td>
                <td className="p-1 border border-gray-300">
                  <MoneyCell value={item.amount}
                    onChange={v => updateAsset('debts', item.id, { amount: v })} />
                </td>
                <td className="p-1 border border-gray-300">
                  <div className="flex items-center gap-1">
                    {isAutoSynced(item.note) && <Link size={14} className="text-blue-500 shrink-0" />}
                    <input type="text" value={item.note}
                      onChange={e => updateAsset('debts', item.id, { note: e.target.value })}
                      className={inputClass} />
                  </div>
                </td>
                <td className="p-1 border border-gray-300 text-center">
                  <button type="button" onClick={() => removeAsset('debts', item.id)}
                    className="text-red-600 hover:text-red-800" aria-label="削除">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-100 font-semibold border-t-2">
              <td colSpan={9} className="p-2 text-right border border-gray-300">合計</td>
              <td className="p-2 text-right border border-gray-300">{formatCurrency(total)}</td>
              <td className="border border-gray-300" colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
