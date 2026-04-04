'use client';

import Decimal from 'decimal.js';
import type { ClassifiedAsset } from '@/types/asset';
import { AssetCategory } from '@/types/asset';
import { ASSET_CATEGORY_LABELS, NON_TAXABLE_PER_HEIR } from '@/lib/constants';
import CategoryBadge from './CategoryBadge';

interface SummaryTableProps {
  assets: ClassifiedAsset[];
  numberOfLegalHeirs: number;
}

function formatYen(amount: string | number): string {
  const num = typeof amount === 'string' ? parseInt(amount) : amount;
  if (isNaN(num)) return String(amount);
  return num.toLocaleString('ja-JP') + '円';
}

export default function SummaryTable({ assets, numberOfLegalHeirs }: SummaryTableProps) {
  if (assets.length === 0) return null;

  // カテゴリごとに集計
  const categoryTotals = new Map<AssetCategory, { count: number; total: Decimal }>();
  for (const asset of assets) {
    const existing = categoryTotals.get(asset.category) ?? {
      count: 0,
      total: new Decimal(0),
    };
    categoryTotals.set(asset.category, {
      count: existing.count + 1,
      total: existing.total.plus(new Decimal(asset.valuation.assessedValue)),
    });
  }

  // 全体合計
  const grandTotal = Array.from(categoryTotals.values()).reduce(
    (sum, { total }) => sum.plus(total),
    new Decimal(0),
  );

  // 死亡保険金の非課税枠
  const nonTaxableLimit = NON_TAXABLE_PER_HEIR.mul(numberOfLegalHeirs);
  const hasDeathInsurance = categoryTotals.has(AssetCategory.DEATH_INSURANCE_PROCEEDS);

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      <div className="p-4 bg-gray-50 border-b">
        <h3 className="font-bold text-gray-800">集計サマリー</h3>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50">
            <th className="text-left px-4 py-2 text-gray-600">資産区分</th>
            <th className="text-right px-4 py-2 text-gray-600">件数</th>
            <th className="text-right px-4 py-2 text-gray-600">評価額合計</th>
          </tr>
        </thead>
        <tbody>
          {Array.from(categoryTotals.entries()).map(([category, { count, total }]) => (
            <tr key={category} className="border-b">
              <td className="px-4 py-3">
                <CategoryBadge category={category} />
              </td>
              <td className="text-right px-4 py-3 text-gray-700">{count}件</td>
              <td className="text-right px-4 py-3 font-medium text-gray-900">
                {formatYen(total.toString())}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          {hasDeathInsurance && (
            <tr className="border-b bg-yellow-50">
              <td colSpan={2} className="px-4 py-2 text-gray-600">
                死亡保険金の非課税枠（500万円 x {numberOfLegalHeirs}人）
              </td>
              <td className="text-right px-4 py-2 text-gray-600">
                {formatYen(nonTaxableLimit.toString())}
              </td>
            </tr>
          )}
          <tr className="bg-blue-50">
            <td colSpan={2} className="px-4 py-3 font-bold text-gray-800">
              合計評価額
            </td>
            <td className="text-right px-4 py-3 font-bold text-lg text-blue-700">
              {formatYen(grandTotal.toString())}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
