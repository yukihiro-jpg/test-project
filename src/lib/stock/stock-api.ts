// 上場株式 相続税評価額 自動計算クライアント
// Flask バックエンド（app.py）と通信して株価データを取得・計算

'use client';

const DEFAULT_API_URL = 'http://localhost:5000';

function getApiUrl(): string {
  if (typeof window === 'undefined') return DEFAULT_API_URL;
  return localStorage.getItem('stock-api-url') || DEFAULT_API_URL;
}

export function setApiUrl(url: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('stock-api-url', url);
}

export function getStoredApiUrl(): string {
  if (typeof window === 'undefined') return DEFAULT_API_URL;
  return localStorage.getItem('stock-api-url') || DEFAULT_API_URL;
}

export interface StockLookupResult {
  name: string;
  ticker: string;
  error?: string;
}

export interface StockCalcResult {
  ticker: string;
  company_name: string;
  inherit_date: string;
  actual_date: string;
  shares: number;
  close_on_date: number;
  avg2: number;
  avg3: number;
  avg4: number;
  days2: number;
  days3: number;
  days4: number;
  candidates: Record<string, number>;
  adopted_label: string;
  adopted_price: number;
  tax_value: number;
  month2: string;
  month3: string;
  month4: string;
  div_rights: DividendRights;
}

export interface DividendRights {
  status: 'kitai_ken' | 'mishuu' | 'none' | 'unknown';
  items: DividendItem[];
  total_gross: number;
  total_tax: number;
  total_net: number;
  error: string | null;
}

export interface DividendItem {
  ex_date: string;
  kenri_tsuki_saigo: string;
  kenri_kakutei: string;
  payment_date: string;
  payment_estimated: boolean;
  div_per_share: number;
  status: string;
  gross: number | null;
  tax: number | null;
  net: number | null;
}

export async function lookupStock(code: string): Promise<StockLookupResult> {
  const res = await fetch(`${getApiUrl()}/lookup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  return res.json();
}

export async function calculateStock(
  code: string,
  date: string,
  shares: number
): Promise<StockCalcResult> {
  const res = await fetch(`${getApiUrl()}/calculate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, date, shares }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json.result;
}

export async function calculateStockBatch(
  items: Array<{ code: string; date: string; shares: number }>
): Promise<{ results: StockCalcResult[]; errors: Array<{ index: number; code: string; error: string }> }> {
  const res = await fetch(`${getApiUrl()}/calculate_batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(items),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json;
}

export async function checkApiAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${getApiUrl()}/`, { method: 'GET', signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}
