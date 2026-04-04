'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDecedent } from '@/hooks/useDecedent';
import type { DecedentInfo } from '@/types/decedent';

export default function DecedentForm() {
  const router = useRouter();
  const setDecedent = useDecedent((s) => s.setDecedent);
  const [form, setForm] = useState<DecedentInfo>({
    name: '',
    dateOfDeath: '',
    contractHolder: '',
    insuredPerson: '',
    numberOfLegalHeirs: 1,
  });

  const handleChange = (field: keyof DecedentInfo, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDecedent(form);
    router.push('/assets');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-lg mx-auto">
      <h2 className="text-xl font-bold text-gray-800">被相続人情報の入力</h2>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          被相続人氏名
        </label>
        <input
          type="text"
          required
          value={form.name}
          onChange={(e) => handleChange('name', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="例: 山田太郎"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          死亡日
        </label>
        <input
          type="date"
          required
          value={form.dateOfDeath}
          onChange={(e) => handleChange('dateOfDeath', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          契約者（保険料負担者）氏名
        </label>
        <input
          type="text"
          required
          value={form.contractHolder}
          onChange={(e) => handleChange('contractHolder', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="例: 山田太郎"
        />
        <p className="text-xs text-gray-500 mt-1">
          被相続人と同一の場合は同じ氏名を入力してください
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          被保険者氏名
        </label>
        <input
          type="text"
          required
          value={form.insuredPerson}
          onChange={(e) => handleChange('insuredPerson', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="例: 山田太郎"
        />
        <p className="text-xs text-gray-500 mt-1">
          被相続人と同一の場合は同じ氏名を入力してください
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          法定相続人数
        </label>
        <input
          type="number"
          required
          min={1}
          max={99}
          value={form.numberOfLegalHeirs}
          onChange={(e) =>
            handleChange('numberOfLegalHeirs', parseInt(e.target.value) || 1)
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-500 mt-1">
          死亡保険金の非課税枠（500万円 x 法定相続人数）の計算に使用します
        </p>
      </div>

      <button
        type="submit"
        className="w-full bg-blue-600 text-white py-3 rounded-md font-medium hover:bg-blue-700 transition-colors"
      >
        次へ: 保険書類のアップロード
      </button>
    </form>
  );
}
