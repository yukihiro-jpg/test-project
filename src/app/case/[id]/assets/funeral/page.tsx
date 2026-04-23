'use client';

import { useState } from 'react';
import { useCaseStore } from '@/lib/store/case-store';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/components/common/currency-input';
import type { PayerShare, FuneralExpense } from '@/types';
import { Plus, Trash2, Users } from 'lucide-react';

const inputClass =
  'w-full border border-gray-300 rounded px-1.5 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500';

function formatNum(n: number): string {
  if (!n) return '';
  return n.toLocaleString('ja-JP');
}

function MoneyCell({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [focused, setFocused] = useState(false);
  const [raw, setRaw] = useState('');
  return (
    <input
      type="text"
      inputMode="numeric"
      value={focused ? raw : formatNum(value)}
      onChange={e => {
        const d = e.target.value.replace(/[^0-9]/g, '');
        setRaw(d);
        onChange(Number(d) || 0);
      }}
      onFocus={() => { setFocused(true); setRaw(value ? String(value) : ''); }}
      onBlur={() => setFocused(false)}
      className={`${inputClass} text-right`}
    />
  );
}

function BearersEditor({
  bearers,
  heirs,
  onChange,
}: {
  bearers: PayerShare[];
  heirs: { id: string; name: string }[];
  onChange: (b: PayerShare[]) => void;
}) {
  const [open, setOpen] = useState(false);

  const toggleHeir = (heirId: string) => {
    const exists = bearers.find(b => b.heirId === heirId);
    if (exists) {
      onChange(bearers.filter(b => b.heirId !== heirId));
    } else {
      const newBearers = [...bearers, { heirId, ratio: 0 }];
      const eq = 1 / newBearers.length;
      onChange(newBearers.map(b => ({ ...b, ratio: eq })));
    }
  };

  const updateRatio = (heirId: string, ratio: number) => {
    onChange(bearers.map(b => b.heirId === heirId ? { ...b, ratio } : b));
  };

  const totalRatio = bearers.reduce((s, b) => s + b.ratio, 0);
  const summary = bearers.length === 0 ? '未指定' :
    bearers.length === 1 ? (heirs.find(h => h.id === bearers[0].heirId)?.name || '?') :
    `${bearers.length}名`;

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(!open)}
        className={`${inputClass} flex items-center justify-between gap-1 text-left ${bearers.length > 1 ? 'text-blue-700' : ''}`}>
        <span className="truncate">{summary}</span>
        <Users size={12} className="shrink-0" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 top-full left-0 mt-1 w-72 bg-white border border-gray-300 rounded shadow-lg p-2">
            <div className="text-xs font-medium text-gray-700 mb-1">負担者（複数選択可）</div>
            <div className="space-y-1 max-h-56 overflow-y-auto">
              {heirs.map(h => {
                const bearer = bearers.find(b => b.heirId === h.id);
                return (
                  <div key={h.id} className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={!!bearer}
                      onChange={() => toggleHeir(h.id)} className="w-3 h-3" />
                    <span className="flex-1 truncate">{h.name || '（未入力）'}</span>
                    {bearer && (
                      <input type="number" step="0.01" min="0" max="1"
                        value={bearer.ratio.toFixed(2)}
                        onChange={e => updateRatio(h.id, parseFloat(e.target.value) || 0)}
                        className="w-16 border border-gray-300 rounded px-1 py-0.5 text-xs text-right" />
                    )}
                  </div>
                );
              })}
            </div>
            {bearers.length > 0 && (
              <div className={`text-xs mt-2 pt-2 border-t ${Math.abs(totalRatio - 1) < 0.01 ? 'text-green-700' : 'text-red-600'}`}>
                合計割合: {(totalRatio * 100).toFixed(0)}%{Math.abs(totalRatio - 1) > 0.01 && '（100%にしてください）'}
              </div>
            )}
            <div className="flex gap-1 mt-2">
              <button type="button"
                onClick={() => {
                  const n = bearers.length;
                  if (n > 0) {
                    const eq = 1 / n;
                    onChange(bearers.map(b => ({ ...b, ratio: eq })));
                  }
                }}
                className="text-xs bg-gray-100 hover:bg-gray-200 rounded px-2 py-1">均等割</button>
              <button type="button" onClick={() => setOpen(false)}
                className="text-xs bg-blue-500 hover:bg-blue-600 text-white rounded px-2 py-1 ml-auto">閉じる</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function FuneralPage() {
  const currentCase = useCaseStore(s => s.getCurrentCase());
  const addAsset = useCaseStore(s => s.addAsset);
  const updateAsset = useCaseStore(s => s.updateAsset);
  const removeAsset = useCaseStore(s => s.removeAsset);

  if (!currentCase) return <p className="text-gray-500">案件を選択してください</p>;

  const items = currentCase.assets.funeralExpenses;
  const heirs = currentCase.heirs;

  const getDeductible = (f: FuneralExpense) =>
    Math.max(0, (f.amount || 0) - (f.nonDeductibleAmount || 0));

  const totalRequest = items.reduce((s, f) => s + (f.amount || 0), 0);
  const totalNonDeductible = items.reduce((s, f) => s + (f.nonDeductibleAmount || 0), 0);
  const totalDeductible = items.reduce((s, f) => s + getDeductible(f), 0);

  const handleAdd = () => {
    addAsset('funeralExpenses', {
      description: '',
      payee: '',
      payeeAddress: '',
      paymentDate: '',
      amount: 0,
      nonDeductibleAmount: 0,
      bearers: [],
      isDeductible: true,
      note: '',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">葬式費用</h1>
        <Button onClick={handleAdd}><Plus size={18} className="mr-2" />追加</Button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm grid grid-cols-3 gap-4">
        <div>
          <div className="text-gray-600 text-xs">請求金額合計</div>
          <div className="font-semibold">{formatCurrency(totalRequest)}</div>
        </div>
        <div>
          <div className="text-gray-600 text-xs">葬式費用対象外（香典返し等）</div>
          <div className="font-semibold text-red-600">▲{formatCurrency(totalNonDeductible)}</div>
        </div>
        <div>
          <div className="text-gray-600 text-xs">相続税申告計上額（自動計算）</div>
          <div className="font-semibold text-blue-700">{formatCurrency(totalDeductible)}</div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="border-collapse text-sm w-max">
          <thead>
            <tr className="bg-gray-100 border-b">
              <th className="p-2 text-center border border-gray-300 w-12">No</th>
              <th className="p-2 text-center border border-gray-300" style={{ minWidth: '140px' }}>費目内容</th>
              <th className="p-2 text-center border border-gray-300" style={{ minWidth: '140px' }}>支払先</th>
              <th className="p-2 text-center border border-gray-300" style={{ minWidth: '180px' }}>支払先住所</th>
              <th className="p-2 text-center border border-gray-300" style={{ minWidth: '130px' }}>支払年月日</th>
              <th className="p-2 text-center border border-gray-300" style={{ minWidth: '140px' }}>請求金額</th>
              <th className="p-2 text-center border border-gray-300" style={{ minWidth: '140px' }}>
                <div>葬式費用対象外</div>
                <div className="text-xs font-normal text-gray-500">香典返し等</div>
              </th>
              <th className="p-2 text-center border border-gray-300" style={{ minWidth: '130px' }}>
                <div>計上額</div>
                <div className="text-xs font-normal text-gray-500">自動</div>
              </th>
              <th className="p-2 text-center border border-gray-300" style={{ minWidth: '130px' }}>負担者</th>
              <th className="p-2 text-center border border-gray-300" style={{ minWidth: '140px' }}>備考</th>
              <th className="p-2 text-center border border-gray-300 w-12">削除</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const deductible = getDeductible(item);
              return (
                <tr key={item.id} className={i % 2 === 0 ? '' : 'bg-gray-50'}>
                  <td className="p-1 border border-gray-300 text-center">{i + 1}</td>
                  <td className="p-1 border border-gray-300">
                    <input type="text" value={item.description}
                      onChange={e => updateAsset('funeralExpenses', item.id, { description: e.target.value })}
                      className={inputClass} placeholder="通夜・告別式等" />
                  </td>
                  <td className="p-1 border border-gray-300">
                    <input type="text" value={item.payee || ''}
                      onChange={e => updateAsset('funeralExpenses', item.id, { payee: e.target.value })}
                      className={inputClass} placeholder="支払先名称" />
                  </td>
                  <td className="p-1 border border-gray-300">
                    <input type="text" value={item.payeeAddress || ''}
                      onChange={e => updateAsset('funeralExpenses', item.id, { payeeAddress: e.target.value })}
                      className={inputClass} placeholder="住所" />
                  </td>
                  <td className="p-1 border border-gray-300">
                    <input type="date" value={item.paymentDate || ''}
                      onChange={e => updateAsset('funeralExpenses', item.id, { paymentDate: e.target.value })}
                      className={inputClass} />
                  </td>
                  <td className="p-1 border border-gray-300">
                    <MoneyCell value={item.amount}
                      onChange={v => updateAsset('funeralExpenses', item.id, { amount: v })} />
                  </td>
                  <td className="p-1 border border-gray-300">
                    <MoneyCell value={item.nonDeductibleAmount || 0}
                      onChange={v => updateAsset('funeralExpenses', item.id, { nonDeductibleAmount: v, isDeductible: v < (item.amount || 0) })} />
                  </td>
                  <td className="p-1 border border-gray-300 text-right font-medium text-blue-700">
                    {formatCurrency(deductible)}
                  </td>
                  <td className="p-1 border border-gray-300">
                    <BearersEditor bearers={item.bearers || []} heirs={heirs}
                      onChange={b => updateAsset('funeralExpenses', item.id, { bearers: b })} />
                  </td>
                  <td className="p-1 border border-gray-300">
                    <input type="text" value={item.note}
                      onChange={e => updateAsset('funeralExpenses', item.id, { note: e.target.value })}
                      className={inputClass} />
                  </td>
                  <td className="p-1 border border-gray-300 text-center">
                    <button type="button" onClick={() => removeAsset('funeralExpenses', item.id)}
                      className="text-red-600 hover:text-red-800">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gray-100 font-semibold border-t-2">
              <td colSpan={5} className="p-2 text-right border border-gray-300">合計</td>
              <td className="p-2 text-right border border-gray-300">{formatCurrency(totalRequest)}</td>
              <td className="p-2 text-right border border-gray-300 text-red-600">▲{formatCurrency(totalNonDeductible)}</td>
              <td className="p-2 text-right border border-gray-300 text-blue-700">{formatCurrency(totalDeductible)}</td>
              <td colSpan={3} className="border border-gray-300"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
