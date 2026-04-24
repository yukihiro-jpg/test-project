// 上場株式 相続税評価額 自動計算クライアント
// Next.js内蔵API Route（/api/stock）を使用

'use client';

export interface StockCalcResult {
  ticker: string;
  company_name: string;
  inherit_date: string;
  actual_date: string;
  shares: number;
  close_on_date: number;
  avg2: number; avg3: number; avg4: number;
  days2: number; days3: number; days4: number;
  month2: string; month3: string; month4: string;
  candidates: Record<string, number>;
  adopted_label: string;
  adopted_price: number;
  tax_value: number;
  // 月別終値データ
  dates2?: string[]; closes2?: number[];
  dates3?: string[]; closes3?: number[];
  dates4?: string[]; closes4?: number[];
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
  status: string;
  ex_date: string;
  div_per_share: number;
  gross: number;
  tax: number;
  net: number;
  payment_estimated: boolean;
}

export async function calculateStock(
  code: string,
  date: string,
  shares: number
): Promise<StockCalcResult> {
  const res = await fetch('/api/stock', {
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
  const results: StockCalcResult[] = [];
  const errors: Array<{ index: number; code: string; error: string }> = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      const result = await calculateStock(item.code, item.date, item.shares);
      (result as any)._row_index = i;
      results.push(result);
    } catch (e: any) {
      errors.push({ index: i, code: item.code, error: e.message });
    }
  }

  return { results, errors };
}
