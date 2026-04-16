'use client';

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type {
  Case, Decedent, Heir, Assets, DivisionPlan, DivisionEntry,
  GiftPlan, GiftPlanEntry, CaseWorkflow,
  LandAsset, BuildingAsset, CashDepositAsset, ListedStockAsset,
  UnlistedStockAsset, InsuranceAsset, OtherAsset, DebtItem,
  FuneralExpense, CompensationPayment,
} from '@/types';

const STORAGE_KEY = 'souzoku-cases';

function createEmptyAssets(): Assets {
  return {
    lands: [],
    buildings: [],
    cashDeposits: [],
    listedStocks: [],
    unlistedStocks: [],
    insurances: [],
    others: [],
    debts: [],
    funeralExpenses: [],
    compensationPayments: [],
  };
}

function createEmptyCase(): Case {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    name: '',
    referenceDate: new Date().toISOString().split('T')[0],
    decedent: { name: '', birthDate: '', address: '' },
    heirs: [],
    assets: createEmptyAssets(),
    division: { entries: [] },
    createdAt: now,
    updatedAt: now,
  };
}

// LocalStorage操作
function loadCases(): Case[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

function saveCases(cases: Case[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cases));
}

interface CaseStore {
  cases: Case[];
  currentCaseId: string | null;
  initialized: boolean;

  // 初期化
  initialize: () => void;

  // 案件管理
  getCurrentCase: () => Case | null;
  createCase: () => string;
  selectCase: (id: string) => void;
  deleteCase: (id: string) => void;
  updateCurrentCase: (updates: Partial<Case>) => void;

  // 被相続人
  updateDecedent: (decedent: Partial<Decedent>) => void;

  // 相続人
  addHeir: (heir: Omit<Heir, 'id'>) => string;
  updateHeir: (id: string, updates: Partial<Heir>) => void;
  removeHeir: (id: string) => void;

  // 財産（各カテゴリ共通パターン）
  addAsset: <K extends keyof Assets>(category: K, item: Omit<Assets[K][number], 'id'>) => string;
  updateAsset: <K extends keyof Assets>(category: K, id: string, updates: Partial<Assets[K][number]>) => void;
  removeAsset: <K extends keyof Assets>(category: K, id: string) => void;

  // 遺産分割
  updateDivision: (entries: DivisionEntry[]) => void;

  // 贈与シミュレーション
  updateGiftPlan: (plan: GiftPlan) => void;

  // ワークフロー
  updateWorkflow: (workflow: CaseWorkflow) => void;
}

export const useCaseStore = create<CaseStore>((set, get) => ({
  cases: [],
  currentCaseId: null,
  initialized: false,

  initialize: () => {
    const cases = loadCases();
    set({ cases, initialized: true });
  },

  getCurrentCase: () => {
    const { cases, currentCaseId } = get();
    return cases.find(c => c.id === currentCaseId) || null;
  },

  createCase: () => {
    const newCase = createEmptyCase();
    const cases = [...get().cases, newCase];
    saveCases(cases);
    set({ cases, currentCaseId: newCase.id });
    return newCase.id;
  },

  selectCase: (id) => {
    set({ currentCaseId: id });
  },

  deleteCase: (id) => {
    const cases = get().cases.filter(c => c.id !== id);
    saveCases(cases);
    set({
      cases,
      currentCaseId: get().currentCaseId === id ? null : get().currentCaseId,
    });
  },

  updateCurrentCase: (updates) => {
    const { cases, currentCaseId } = get();
    if (!currentCaseId) return;
    const updatedCases = cases.map(c =>
      c.id === currentCaseId
        ? { ...c, ...updates, updatedAt: new Date().toISOString() }
        : c
    );
    saveCases(updatedCases);
    set({ cases: updatedCases });
  },

  updateDecedent: (decedent) => {
    const currentCase = get().getCurrentCase();
    if (!currentCase) return;
    get().updateCurrentCase({
      decedent: { ...currentCase.decedent, ...decedent },
      name: decedent.name || currentCase.name,
    });
  },

  addHeir: (heir) => {
    const currentCase = get().getCurrentCase();
    if (!currentCase) return '';
    const id = uuidv4();
    const newHeir = { ...heir, id } as Heir;
    get().updateCurrentCase({
      heirs: [...currentCase.heirs, newHeir],
    });
    return id;
  },

  updateHeir: (id, updates) => {
    const currentCase = get().getCurrentCase();
    if (!currentCase) return;
    get().updateCurrentCase({
      heirs: currentCase.heirs.map(h => h.id === id ? { ...h, ...updates } : h),
    });
  },

  removeHeir: (id) => {
    const currentCase = get().getCurrentCase();
    if (!currentCase) return;
    get().updateCurrentCase({
      heirs: currentCase.heirs.filter(h => h.id !== id),
    });
  },

  addAsset: (category, item) => {
    const currentCase = get().getCurrentCase();
    if (!currentCase) return '';
    const id = uuidv4();
    const newItem = { ...item, id };
    const updatedAssets = {
      ...currentCase.assets,
      [category]: [...(currentCase.assets[category] as unknown[]), newItem],
    };
    get().updateCurrentCase({ assets: updatedAssets as Assets });
    return id;
  },

  updateAsset: (category, id, updates) => {
    const currentCase = get().getCurrentCase();
    if (!currentCase) return;
    const items = currentCase.assets[category] as Array<{ id: string }>;
    const updatedItems = items.map(item =>
      item.id === id ? { ...item, ...updates } : item
    );
    get().updateCurrentCase({
      assets: { ...currentCase.assets, [category]: updatedItems },
    });
  },

  removeAsset: (category, id) => {
    const currentCase = get().getCurrentCase();
    if (!currentCase) return;
    const items = currentCase.assets[category] as Array<{ id: string }>;
    get().updateCurrentCase({
      assets: { ...currentCase.assets, [category]: items.filter(item => item.id !== id) },
    });
  },

  updateDivision: (entries) => {
    get().updateCurrentCase({ division: { entries } });
  },

  updateGiftPlan: (plan) => {
    get().updateCurrentCase({ giftSimulation: plan });
  },

  updateWorkflow: (workflow) => {
    get().updateCurrentCase({ workflow });
  },
}));
