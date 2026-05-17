import type { AppDb } from '../db/client';
import { purchase_invoices, payment_allocations, payments, suppliers } from '../db/schema';
import { eq, lte, and } from 'drizzle-orm';

export interface APRow {
  invoice_id: number;
  invoice_no: string;
  supplier_id: number;
  supplier_name: string;
  issue_date: string;
  due_date: string;
  total_inc_tax: number;
  paid_amount: number;
  outstanding: number;
  bucket: 'current' | '1-30' | '31-60' | '61-90' | '90+';
}

function bucketFor(asOf: string, dueDate: string): APRow['bucket'] {
  const a = new Date(asOf + 'T00:00:00Z').getTime();
  const d = new Date(dueDate + 'T00:00:00Z').getTime();
  const days = Math.floor((a - d) / 86400000);
  if (days <= 0) return 'current';
  if (days <= 30) return '1-30';
  if (days <= 60) return '31-60';
  if (days <= 90) return '61-90';
  return '90+';
}

export async function getPayablesAsOf(db: AppDb, asOfDate: string) {
  const invoices = db.select().from(purchase_invoices).all() as any[];
  const rows: APRow[] = [];
  for (const inv of invoices) {
    if (inv.status === 'void') continue;
    const allocs = db.select({
      allocated_amount: payment_allocations.allocated_amount,
      date: payments.date
    })
      .from(payment_allocations)
      .innerJoin(payments, eq(payments.id, payment_allocations.payment_id))
      .where(and(
        eq(payment_allocations.invoice_type, 'purchase'),
        eq(payment_allocations.invoice_id, inv.id),
        lte(payments.date, asOfDate)
      ))
      .all() as Array<{ allocated_amount: number; date: string }>;
    const paid = allocs.reduce((s, a) => s + a.allocated_amount, 0);
    const outstanding = inv.total_inc_tax - paid;
    if (outstanding <= 0) continue;
    const supplier = db.select().from(suppliers).where(eq(suppliers.id, inv.supplier_id)).get() as any;
    rows.push({
      invoice_id: inv.id,
      invoice_no: inv.invoice_no,
      supplier_id: inv.supplier_id,
      supplier_name: supplier?.name ?? '',
      issue_date: inv.issue_date,
      due_date: inv.due_date,
      total_inc_tax: inv.total_inc_tax,
      paid_amount: paid,
      outstanding,
      bucket: bucketFor(asOfDate, inv.due_date)
    });
  }
  const bySupplier = new Map<number, { supplier_id: number; supplier_name: string; total: number; buckets: Record<string, number>; rows: APRow[] }>();
  for (const r of rows) {
    let entry = bySupplier.get(r.supplier_id);
    if (!entry) {
      entry = { supplier_id: r.supplier_id, supplier_name: r.supplier_name, total: 0, buckets: { current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 }, rows: [] };
      bySupplier.set(r.supplier_id, entry);
    }
    entry.total += r.outstanding;
    entry.buckets[r.bucket] += r.outstanding;
    entry.rows.push(r);
  }
  return { rows, suppliers: Array.from(bySupplier.values()) };
}
