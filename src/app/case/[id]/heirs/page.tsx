'use client';

import { useCaseStore } from '@/lib/store/case-store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { calculateAge } from '@/lib/dates/wareki';
import { calculateLegalShareRatios } from '@/lib/tax/deductions';
import { RELATIONSHIP_LABELS, type RelationshipType, getDisplayRelationship } from '@/types';
import { Plus, Trash2 } from 'lucide-react';

const RELATIONSHIP_OPTIONS = Object.entries(RELATIONSHIP_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export default function HeirsPage() {
  const currentCase = useCaseStore(s => s.getCurrentCase());
  const addHeir = useCaseStore(s => s.addHeir);
  const updateHeir = useCaseStore(s => s.updateHeir);
  const removeHeir = useCaseStore(s => s.removeHeir);

  if (!currentCase) return <p className="text-gray-500">案件を選択してください</p>;

  const { heirs, referenceDate } = currentCase;
  const legalShareRatios = calculateLegalShareRatios(heirs);

  const handleAdd = () => {
    addHeir({
      name: '',
      birthDate: '',
      address: '',
      relationship: 'child',
      isDisabled: false,
    });
  };

  return (
    <div className="max-w-5xl space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">相続人情報</h1>

      {heirs.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 mb-4">相続人が登録されていません</p>
          <Button onClick={handleAdd}>
            <Plus size={18} className="mr-2" />相続人を追加
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100 border-b">
                <th className="p-2 text-left w-8">No</th>
                <th className="p-2 text-left">氏名</th>
                <th className="p-2 text-left" style={{ minWidth: '100px' }}>続柄</th>
                <th className="p-2 text-center" style={{ minWidth: '100px' }}>続柄(手入力)</th>
                <th className="p-2 text-left" style={{ minWidth: '140px' }}>生年月日</th>
                <th className="p-2 text-left w-16">年齢</th>
                <th className="p-2 text-left">住所</th>
                <th className="p-2 text-left">電話番号</th>
                <th className="p-2 text-center w-16">障害者</th>
                <th className="p-2 text-right w-20">法定相続分</th>
                <th className="p-2 text-center w-10"></th>
              </tr>
            </thead>
            <tbody>
              {heirs.map((heir, index) => {
                const age = calculateAge(heir.birthDate, referenceDate);
                const legalShare = legalShareRatios.get(heir.id) || 0;
                return (
                  <tr key={heir.id} className={`border-b ${index % 2 === 0 ? '' : 'bg-gray-50'}`}>
                    <td className="p-1 text-gray-500">{index + 1}</td>
                    <td className="p-1">
                      <input
                        type="text"
                        value={heir.name}
                        onChange={e => updateHeir(heir.id, { name: e.target.value })}
                        placeholder="氏名"
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                    <td className="p-1">
                      <select
                        value={heir.relationship}
                        onChange={e => updateHeir(heir.id, { relationship: e.target.value as RelationshipType })}
                        className="w-full border border-gray-300 rounded px-1 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        {RELATIONSHIP_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-1">
                      <input
                        type="text"
                        value={heir.customRelationship || ''}
                        onChange={e => updateHeir(heir.id, { customRelationship: e.target.value })}
                        placeholder="例: 長男"
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="date"
                        value={heir.birthDate}
                        onChange={e => updateHeir(heir.id, { birthDate: e.target.value })}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                    <td className="p-1 text-center">
                      {heir.birthDate ? (
                        <span className={age < 18 ? 'text-orange-600 font-semibold' : ''}>
                          {age}歳
                        </span>
                      ) : '-'}
                    </td>
                    <td className="p-1">
                      <input
                        type="text"
                        value={heir.address}
                        onChange={e => updateHeir(heir.id, { address: e.target.value })}
                        placeholder="住所"
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="text"
                        value={heir.phone || ''}
                        onChange={e => updateHeir(heir.id, { phone: e.target.value })}
                        placeholder="電話番号"
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                    <td className="p-1 text-center">
                      <input
                        type="checkbox"
                        checked={heir.isDisabled}
                        onChange={e => updateHeir(heir.id, { isDisabled: e.target.checked })}
                        className="w-4 h-4"
                      />
                    </td>
                    <td className="p-1 text-right font-semibold text-blue-700">
                      {(legalShare * 100).toFixed(1)}%
                    </td>
                    <td className="p-1 text-center">
                      <button
                        onClick={() => { if (confirm('削除しますか？')) removeHeir(heir.id); }}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Button onClick={handleAdd} variant="secondary">
        <Plus size={18} className="mr-2" />相続人追加
      </Button>
    </div>
  );
}
