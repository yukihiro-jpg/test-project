'use client';

import { AssetCategory } from '@/types/asset';
import { ASSET_CATEGORY_LABELS } from '@/lib/constants';

const CATEGORY_COLORS: Record<AssetCategory, string> = {
  [AssetCategory.DEATH_INSURANCE_PROCEEDS]: 'bg-red-100 text-red-800',
  [AssetCategory.FIXED_TERM_ANNUITY]: 'bg-green-100 text-green-800',
  [AssetCategory.PERPETUAL_ANNUITY]: 'bg-emerald-100 text-emerald-800',
  [AssetCategory.LIFETIME_ANNUITY]: 'bg-teal-100 text-teal-800',
  [AssetCategory.PRE_EVENT_ANNUITY]: 'bg-yellow-100 text-yellow-800',
  [AssetCategory.GUARANTEED_PERIOD_ANNUITY]: 'bg-cyan-100 text-cyan-800',
  [AssetCategory.NON_CONTRACTUAL_ANNUITY]: 'bg-purple-100 text-purple-800',
  [AssetCategory.LIFE_INSURANCE_CONTRACT_RIGHTS]: 'bg-blue-100 text-blue-800',
  [AssetCategory.NON_LIFE_INSURANCE_CONTRACT_RIGHTS]: 'bg-indigo-100 text-indigo-800',
};

interface CategoryBadgeProps {
  category: AssetCategory;
}

export default function CategoryBadge({ category }: CategoryBadgeProps) {
  return (
    <span
      className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${CATEGORY_COLORS[category]}`}
    >
      {ASSET_CATEGORY_LABELS[category]}
    </span>
  );
}
