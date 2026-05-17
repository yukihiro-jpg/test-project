import type { AppDb } from '../db/client';
import { sales_invoices, payment_allocations, payments, customers } from '../db/schema';
import { eq, lte, and } from 'drizzle-orm';

export interface ARRow {
  invoice_id: number;
  invoice_no: string;
  customer_id: number;
  customer_name: string;
  issue_date: string;
  due_date: string;
  total_inc_tax: number;
  paid_amount: number;
  outstanding: number;
  bucket: 'current' | '1-30' | '31-60' | '61-90' | '90+';
}

function bucketFor(asOf: string, dueDate: string): ARRow['bucket'] {
  const a = new Date(asOf + 'T00:00:00Z').getTime();
  const d = new Date(dueDate + 'T00:00:00Z').getTime();
  const days = Math.floor((a - d) / 86400000);
  if (days <= 0) return 'current';
  if (days <= 30) return '1-30';
  if (days <= 60) return '31-60';
  if (days <= 90) return '61-90';
  return '90+';
}

export async function getReceivablesAsOf(db: AppDb, asOfDate: string) {
  // AR logic: paid_amount is sum of allocations whose payment.date <= asOfDate.
  // outstanding = total_inc_tax - paid_amount; include if outstanding > 0.
  // Example: 請求書 due 8/1, 実払 7/31. asOf=7/31 -> paid_amount counts -> excluded. asOf=7/30 -> not yet paid -> included.
  const invoices = db.select().from(sales_invoices).all() as any[];
  const rows: ARRow[] = [];
  for (const inv of invoices) {
    if (inv.status === 'void') continue;
    const allocs = db.select({
      allocated_amount: payment_allocations.allocated_amount,
      adjustment_amount: payment_allocations.adjustment_amount,
      date: payments.date
    })
      .from(payment_allocations)
      .innerJoin(payments, eq(payments.id, payment_allocations.payment_id))
      .where(and(
        eq(payment_allocations.invoice_type, 'sales'),
        eq(payment_allocations.invoice_id, inv.id),
        lte(payments.date, asOfDate)
      ))
      .all() as Array<{ allocated_amount: number; adjustment_amount: number | null; date: string }>;
    const paidFromAllocs = allocs.reduce((s, a) => s + (a.allocated_amount ?? 0) + (a.adjustment_amount ?? 0), 0);
    const offsetRow = db.$sqlite.prepare(`SELECT COALESCE(SUM(amount),0) AS s FROM invoice_offsets WHERE sales_invoice_id = ? AND date <= ?`).get(inv.id, asOfDate) as { s: number };
    const paid = paidFromAllocs + (offsetRow.s ?? 0);
    const outstanding = inv.total_inc_tax - paid;
    if (outstanding <= 0) continue;
    const customer = db.select().from(customers).where(eq(customers.id, inv.customer_id)).get() as any;
    rows.push({
      invoice_id: inv.id,
      invoice_no: inv.invoice_no,
      customer_id: inv.customer_id,
      customer_name: customer?.name ?? '',
      issue_date: inv.issue_date,
      due_date: inv.due_date,
      total_inc_tax: inv.total_inc_tax,
      paid_amount: paid,
      outstanding,
      bucket: bucketFor(asOfDate, inv.due_date)
    });
  }
  // Group by customer
  const byCustomer = new Map<number, { customer_id: number; customer_name: string; total: number; buckets: Record<string, number>; rows: ARRow[] }>();
  for (const r of rows) {
    let entry = byCustomer.get(r.customer_id);
    if (!entry) {
      entry = { customer_id: r.customer_id, customer_name: r.customer_name, total: 0, buckets: { current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 }, rows: [] };
      byCustomer.set(r.customer_id, entry);
    }
    entry.total += r.outstanding;
    entry.buckets[r.bucket] += r.outstanding;
    entry.rows.push(r);
  }
  return { rows, customers: Array.from(byCustomer.values()) };
}
