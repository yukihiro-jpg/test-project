export const yen = (n: number) => Math.round(n);

export function computeLineAmount(quantity: number, unit_price: number): number {
  return Math.round(quantity * unit_price);
}

export function computeInvoiceTotals(lines: Array<{ quantity: number; unit_price: number; tax_rate: number; amount_ex_tax?: number }>) {
  const buckets = new Map<number, number>();
  let subtotal = 0;
  for (const l of lines) {
    const amt = l.amount_ex_tax != null ? l.amount_ex_tax : computeLineAmount(l.quantity, l.unit_price);
    subtotal += amt;
    buckets.set(l.tax_rate, (buckets.get(l.tax_rate) || 0) + amt);
  }
  let tax = 0;
  for (const [rate, sum] of buckets) {
    tax += Math.round((sum * rate) / 100);
  }
  return {
    subtotal_ex_tax: Math.round(subtotal),
    tax_amount: Math.round(tax),
    total_inc_tax: Math.round(subtotal) + Math.round(tax)
  };
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysISO(dateISO: string, days: number): string {
  const d = new Date(dateISO + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
