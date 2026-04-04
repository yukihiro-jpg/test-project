'use client';

import { create } from 'zustand';
import type { ClassifiedAsset } from '@/types/asset';
import type { AssetCategory } from '@/types/asset';
import type { ValuationResult } from '@/types/valuation';

interface AssetsStore {
  assets: ClassifiedAsset[];
  addAsset: (asset: ClassifiedAsset) => void;
  updateAsset: (id: string, updates: Partial<Pick<ClassifiedAsset, 'category' | 'categoryConfidence' | 'valuation' | 'extracted'>>) => void;
  removeAsset: (id: string) => void;
}

export const useAssets = create<AssetsStore>((set) => ({
  assets: [],
  addAsset: (asset) =>
    set((state) => ({ assets: [...state.assets, asset] })),
  updateAsset: (id, updates) =>
    set((state) => ({
      assets: state.assets.map((a) =>
        a.id === id ? { ...a, ...updates } : a,
      ),
    })),
  removeAsset: (id) =>
    set((state) => ({
      assets: state.assets.filter((a) => a.id !== id),
    })),
}));
