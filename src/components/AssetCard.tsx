'use client';

import { useState } from 'react';
import type { ClassifiedAsset } from '@/types/asset';
import { AssetCategory } from '@/types/asset';
import { ASSET_CATEGORY_LABELS } from '@/lib/constants';
import CategoryBadge from './CategoryBadge';
import { classify } from '@/lib/classifier';
import { calculate } from '@/lib/valuator';
import type { DecedentInfo } from '@/types/decedent';
import type { ExtractedInsuranceData } from '@/types/extracted';

interface AssetCardProps {
  asset: ClassifiedAsset;
  decedent: DecedentInfo;
  onUpdate: (id: string, updates: Partial<Pick<ClassifiedAsset, 'category' | 'categoryConfidence' | 'valuation' | 'extracted'>>) => void;
  onRemove: (id: string) => void;
}

function formatYen(amount: string): string {
  const num = parseInt(amount);
  if (isNaN(num)) return amount;
  return num.toLocaleString('ja-JP') + '円';
}

export default function AssetCard({ asset, decedent, onUpdate, onRemove }: AssetCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editCategory, setEditCategory] = useState(asset.category);

  const handleCategoryChange = (newCategory: AssetCategory) => {
    setEditCategory(newCategory);
    const newValuation = calculate(asset.extracted, newCategory, decedent);
    onUpdate(asset.id, {
      category: newCategory,
      categoryConfidence: 'manual',
      valuation: newValuation,
    });
    setIsEditing(false);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-gray-800">
            {asset.extracted.insuranceCompanyName}
          </h3>
          <p className="text-sm text-gray-500">
            証券番号: {asset.extracted.policyNumber}
          </p>
          <p className="text-xs text-gray-400">{asset.fileName}</p>
        </div>
        <button
          onClick={() => onRemove(asset.id)}
          className="text-gray-400 hover:text-red-500 text-sm"
        >
          削除
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-gray-500">契約者:</span>{' '}
          <span className="text-gray-800">{asset.extracted.contractHolder}</span>
        </div>
        <div>
          <span className="text-gray-500">被保険者:</span>{' '}
          <span className="text-gray-800">{asset.extracted.insuredPerson}</span>
        </div>
        <div>
          <span className="text-gray-500">受取人:</span>{' '}
          <span className="text-gray-800">{asset.extracted.beneficiary ?? '-'}</span>
        </div>
        <div>
          <span className="text-gray-500">保険種類:</span>{' '}
          <span className="text-gray-800">{asset.extracted.insuranceType}</span>
        </div>
        {asset.extracted.deathBenefitAmount !== null && (
          <div>
            <span className="text-gray-500">死亡保険金:</span>{' '}
            <span className="text-gray-800">
              {formatYen(String(asset.extracted.deathBenefitAmount))}
            </span>
          </div>
        )}
        {asset.extracted.paidOutAmount !== null && (
          <div>
            <span className="text-gray-500">支払金額:</span>{' '}
            <span className="text-gray-800">
              {formatYen(String(asset.extracted.paidOutAmount))}
            </span>
          </div>
        )}
        {asset.extracted.surrenderValue !== null && (
          <div>
            <span className="text-gray-500">解約返戻金:</span>{' '}
            <span className="text-gray-800">
              {formatYen(String(asset.extracted.surrenderValue))}
            </span>
          </div>
        )}
        {asset.extracted.totalPremiumsPaid !== null && (
          <div>
            <span className="text-gray-500">払込保険料総額:</span>{' '}
            <span className="text-gray-800">
              {formatYen(String(asset.extracted.totalPremiumsPaid))}
            </span>
          </div>
        )}
        {asset.extracted.annualAnnuityAmount !== null && (
          <div>
            <span className="text-gray-500">年金年額:</span>{' '}
            <span className="text-gray-800">
              {formatYen(String(asset.extracted.annualAnnuityAmount))}
            </span>
          </div>
        )}
      </div>

      <div className="border-t pt-3 flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <CategoryBadge category={asset.category} />
            {asset.categoryConfidence === 'manual' && (
              <span className="text-xs text-orange-600">(手動修正)</span>
            )}
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="text-xs text-blue-600 hover:underline"
            >
              変更
            </button>
          </div>
          {isEditing && (
            <select
              value={editCategory}
              onChange={(e) => handleCategoryChange(e.target.value as AssetCategory)}
              className="text-sm border rounded px-2 py-1"
            >
              {Object.values(AssetCategory).map((cat) => (
                <option key={cat} value={cat}>
                  {ASSET_CATEGORY_LABELS[cat]}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="text-right">
          <p className="text-xs text-gray-500">評価額</p>
          <p className="text-lg font-bold text-gray-900">
            {formatYen(asset.valuation.assessedValue)}
          </p>
        </div>
      </div>

      {/* 評価内訳 */}
      <details className="text-xs text-gray-500">
        <summary className="cursor-pointer hover:text-gray-700">
          評価内訳を表示
        </summary>
        <pre className="mt-2 bg-gray-50 p-2 rounded overflow-auto">
          {JSON.stringify(asset.valuation.breakdown, null, 2)}
        </pre>
      </details>
    </div>
  );
}
