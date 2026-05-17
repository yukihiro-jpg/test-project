import type { AppDb } from '../db/client';
import { cashflow_entries, customers, suppliers } from '../db/schema';
import { and, eq } from 'drizzle-orm';

export function upsertCashflowForSalesInvoice(db: AppDb, inv: { id: number; due_date: string; total_inc_tax: number; status: string; customer_id: number }) {
  const customer = db.select().from(customers).where(eq(customers.id, inv.customer_id)).get() as any;
  const existing = db.select().from(cashflow_entries)
    .where(and(eq(cashflow_entries.source_type, 'sales_invoice'), eq(cashflow_entries.source_id, inv.id))).get() as any;
  const memo = `売掛: ${customer?.name ?? ''}`;
  if (existing) {
    const patch: any = { scheduled_date: inv.due_date, amount: inv.total_inc_tax, memo };
    if (inv.status === 'paid') patch.status = 'completed';
    db.update(cashflow_entries).set(patch).where(eq(cashflow_entries.id, existing.id)).run();
  } else {
    db.insert(cashflow_entries).values({
      type: 'in',
      scheduled_date: inv.due_date,
      amount: inv.total_inc_tax,
      bank_account_id: customer?.default_bank_account_id ?? null,
      category: '売掛入金',
      source_type: 'sales_invoice',
      source_id: inv.id,
      memo,
      status: inv.status === 'paid' ? 'completed' : 'scheduled'
    }).run();
  }
}

export function upsertCashflowForPurchaseInvoice(db: AppDb, inv: { id: number; due_date: string; total_inc_tax: number; status: string; supplier_id: number }) {
  const supplier = db.select().from(suppliers).where(eq(suppliers.id, inv.supplier_id)).get() as any;
  const existing = db.select().from(cashflow_entries)
    .where(and(eq(cashflow_entries.source_type, 'purchase_invoice'), eq(cashflow_entries.source_id, inv.id))).get() as any;
  const memo = `買掛: ${supplier?.name ?? ''}`;
  if (existing) {
    const patch: any = { scheduled_date: inv.due_date, amount: inv.total_inc_tax, memo };
    if (inv.status === 'paid') patch.status = 'completed';
    db.update(cashflow_entries).set(patch).where(eq(cashflow_entries.id, existing.id)).run();
  } else {
    db.insert(cashflow_entries).values({
      type: 'out',
      scheduled_date: inv.due_date,
      amount: inv.total_inc_tax,
      bank_account_id: supplier?.default_bank_account_id ?? null,
      category: '買掛支払',
      source_type: 'purchase_invoice',
      source_id: inv.id,
      memo,
      status: inv.status === 'paid' ? 'completed' : 'scheduled'
    }).run();
  }
}

export function deleteCashflowFor(db: AppDb, source_type: 'sales_invoice' | 'purchase_invoice', source_id: number) {
  db.delete(cashflow_entries)
    .where(and(eq(cashflow_entries.source_type, source_type), eq(cashflow_entries.source_id, source_id))).run();
}

export function markCashflowCompleted(db: AppDb, source_type: 'sales_invoice' | 'purchase_invoice', source_id: number, actualDate: string) {
  db.update(cashflow_entries)
    .set({ status: 'completed', actual_date: actualDate })
    .where(and(eq(cashflow_entries.source_type, source_type), eq(cashflow_entries.source_id, source_id))).run();
}
