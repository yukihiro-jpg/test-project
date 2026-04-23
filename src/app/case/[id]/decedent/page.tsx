'use client';

import { useCaseStore } from '@/lib/store/case-store';
import { WarekiInput } from '@/components/common/wareki-input';
import { calculateAge } from '@/lib/dates/wareki';

export default function DecedentPage() {
  const currentCase = useCaseStore(s => s.getCurrentCase());
  const updateDecedent = useCaseStore(s => s.updateDecedent);
  const updateCurrentCase = useCaseStore(s => s.updateCurrentCase);

  if (!currentCase) return <p className="text-gray-500">案件を選択してください</p>;

  const { decedent, referenceDate } = currentCase;
  const age = calculateAge(decedent.birthDate, referenceDate);

  const inputCls = 'w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500';

  return (
    <div className="max-w-4xl space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">被相続人情報</h1>

      <div className="border border-gray-200 rounded-lg p-4 bg-white">
        <h2 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b">基準日</h2>
        <div className="max-w-xs">
          <WarekiInput
            value={referenceDate}
            onChange={v => updateCurrentCase({ referenceDate: v })}
            showWareki
          />
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg p-4 bg-white">
        <h2 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b">被相続人</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 左列 */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">氏名</label>
              <input
                type="text"
                className={inputCls}
                value={decedent.name}
                onChange={e => updateDecedent({ name: e.target.value })}
                placeholder="山田 太郎"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                生年月日
                {decedent.birthDate && (
                  <span className="ml-2 text-xs text-blue-700 font-normal">
                    （基準日時点: {age}歳）
                  </span>
                )}
              </label>
              <WarekiInput
                value={decedent.birthDate}
                onChange={v => updateDecedent({ birthDate: v })}
                compact
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">死亡日</label>
              <WarekiInput
                value={decedent.deathDate || ''}
                onChange={v => updateDecedent({ deathDate: v })}
                compact
              />
            </div>
          </div>

          {/* 右列 */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">住所</label>
              <input
                type="text"
                className={inputCls}
                value={decedent.address}
                onChange={e => updateDecedent({ address: e.target.value })}
                placeholder="東京都千代田区..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">電話番号</label>
              <input
                type="text"
                className={inputCls}
                value={decedent.phone || ''}
                placeholder="090-xxxx-xxxx"
                onChange={e => updateDecedent({ phone: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">職業</label>
              <input
                type="text"
                className={inputCls}
                value={decedent.occupation || ''}
                placeholder="会社員、無職等"
                onChange={e => updateDecedent({ occupation: e.target.value })}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
