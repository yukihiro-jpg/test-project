'use client';

import { create } from 'zustand';
import type { DecedentInfo } from '@/types/decedent';

interface DecedentStore {
  decedent: DecedentInfo | null;
  setDecedent: (info: DecedentInfo) => void;
}

export const useDecedent = create<DecedentStore>((set) => ({
  decedent: null,
  setDecedent: (info) => set({ decedent: info }),
}));
