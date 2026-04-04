'use client';

import Decimal from 'decimal.js';
import type { ClassifiedAsset } from '@/types/asset';
import { AssetCategory } from '@/types/asset';
import { ASSET_CATEGORY_LABELS, NON_TAXABLE_PER_HEIR, NON_TAXABLE_CATEGORIES } from '@/lib/constants';
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

  // カテゴリごとに集計（課税対象と対象外を分離）
  const taxableCategories = new Map<AssetCategory, { count: number; total: Decimal }>();
  const nonTaxableCategories = new Map<AssetCategory, { count: number; total: Decimal; originalAmount: Decimal }>();

  for (const asset of assets) {
    const isNonTaxable = NON_TAXABLE_CATEGORIES.has(asset.category);
    const targetMap = isNonTaxable ? null : taxableCategories;

    if (isNonTaxable) {
      const existing = nonTaxableCategories.get(asset.category) ?? {
        count: 0,
        total: new Decimal(0),
        originalAmount: new Decimal(0),
      };
      // 対象外の場合、元の支払額を記録（breakdownから取得）
      let origAmount = new Decimal(0);
      if (asset.valuation.breakdown.type === 'hospitalization_benefit') {
        origAmount = new Decimal(asset.valuation.breakdown.paidOutAmount);
      }
      nonTaxableCategories.set(asset.category, {
        count: existing.count + 1,
        total: existing.total.plus(new Decimal(asset.valuation.assessedValue)),
        originalAmount: existing.originalAmount.plus(origAmount),
      });
    } else {
      const existing = taxableCategories.get(asset.category) ?? {
        count: 0,
        total: new Decimal(0),
      };
      taxableCategories.set(asset.category, {
        count: existing.count + 1,
        total: existing.total.plus(new Decimal(asset.valuation.assessedValue)),
      });
    }
  }

  // 課税対象の合計
  const taxableTotal = Array.from(taxableCategories.values()).reduce(
    (sum, { total }) => sum.plus(total),
    new Decimal(0),
  );

  // 死亡保険金の非課税枠
  const nonTaxableLimit = NON_TAXABLE_PER_HEIR.mul(numberOfLegalHeirs);
  const hasDeathInsurance = taxableCategories.has(AssetCategory.DEATH_INSURANCE_PROCEEDS);

  return (
    <div className="space-y-4">
      {/* 課税対象の資産 */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 bg-gray-50 border-b">
          <h3 className="font-bold text-gray-800">集計サマリー（課税対象）</h3>
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
            {Array.from(taxableCategories.entries()).map(([category, { count, total }]) => (
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
                {formatYen(taxableTotal.toString())}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 相続税対象外の参考情報 */}
      {nonTaxableCategories.size > 0 && (
        <div className="bg-gray-50 border border-gray-300 rounded-lg shadow-sm overflow-hidden">
          <div className="p-4 bg-gray-100 border-b">
            <h3 className="font-bold text-gray-600">参考: 相続税対象外の保険金等</h3>
            <p className="text-xs text-gray-500 mt-1">
              以下は相続人が受取人のため、相続税の課税対象には含まれません
            </p>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-100">
                <th className="text-left px-4 py-2 text-gray-500">資産区分</th>
                <th className="text-right px-4 py-2 text-gray-500">件数</th>
                <th className="text-right px-4 py-2 text-gray-500">支払金額（参考）</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(nonTaxableCategories.entries()).map(([category, { count, originalAmount }]) => (
                <tr key={category} className="border-b">
                  <td className="px-4 py-3">
                    <CategoryBadge category={category} />
                  </td>
                  <td className="text-right px-4 py-3 text-gray-500">{count}件</td>
                  <td className="text-right px-4 py-3 text-gray-500">
                    {formatYen(originalAmount.toString())}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
