import type { AppDb } from '../db/client';
import { payments, payment_allocations, sales_invoices, purchase_invoices, cashflow_entries } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import type { Payment, PaymentAllocation } from '../types';
import { markCashflowCompleted } from './cashflowSync';

export async function list(db: AppDb): Promise<Payment[]> {
  return db.select().from(payments).all() as Payment[];
}

export async function get(db: AppDb, id: number): Promise<Payment | undefined> {
  const p = db.select().from(payments).where(eq(payments.id, id)).get() as Payment | undefined;
  if (!p) return undefined;
  p.allocations = db.select().from(payment_allocations).where(eq(payment_allocations.payment_id, id)).all() as PaymentAllocation[];
  return p;
}

function updateInvoiceStatusForAllocation(db: AppDb, alloc: PaymentAllocation, paymentDate: string) {
  const table = alloc.invoice_type === 'sales' ? sales_invoices : purchase_invoices;
  const inv = db.select().from(table as any).where(eq((table as any).id, alloc.invoice_id)).get() as any;
  if (!inv) return;
  // total allocated so far
  const all = db.select().from(payment_allocations)
    .where(and(eq(payment_allocations.invoice_type, alloc.invoice_type), eq(payment_allocations.invoice_id, alloc.invoice_id))).all() as PaymentAllocation[];
  const total = all.reduce((s, a) => s + a.allocated_amount, 0);
  let status: string = inv.status;
  if (total >= inv.total_inc_tax) status = 'paid';
  else if (total > 0) status = 'partially_paid';
  db.update(table as any).set({ status }).where(eq((table as any).id, alloc.invoice_id)).run();
  if (status === 'paid') {
    markCashflowCompleted(db, alloc.invoice_type === 'sales' ? 'sales_invoice' : 'purchase_invoice', alloc.invoice_id, paymentDate);
  }
}

export async function create(db: AppDb, input: Partial<Payment> & { allocations?: PaymentAllocation[] }): Promise<Payment> {
  return db.$sqlite.transaction(() => {
    const ins = db.insert(payments).values({
      type: input.type!,
      date: input.date!,
      amount: input.amount ?? 0,
      bank_account_id: input.bank_account_id ?? null,
      counterparty_type: input.counterparty_type ?? null,
      counterparty_id: input.counterparty_id ?? null,
      memo: input.memo ?? null
    }).returning().get() as any;

    for (const a of (input.allocations ?? [])) {
      db.insert(payment_allocations).values({
        payment_id: ins.id,
        invoice_type: a.invoice_type,
        invoice_id: a.invoice_id,
        allocated_amount: a.allocated_amount
      }).run();
      updateInvoiceStatusForAllocation(db, a, input.date!);
    }

    // Add a manual completed cashflow entry recording the actual payment movement
    db.insert(cashflow_entries).values({
      type: input.type === 'receipt' ? 'in' : 'out',
      scheduled_date: input.date!,
      actual_date: input.date!,
      amount: input.amount ?? 0,
      bank_account_id: input.bank_account_id ?? null,
      category: input.type === 'receipt' ? '入金' : '出金',
      source_type: 'manual',
      source_id: ins.id,
      memo: input.memo ?? null,
      status: 'completed'
    }).run();

    return get(db, ins.id) as any;
  })();
}

export async function remove(db: AppDb, id: number): Promise<void> {
  db.$sqlite.transaction(() => {
    const allocs = db.select().from(payment_allocations).where(eq(payment_allocations.payment_id, id)).all() as PaymentAllocation[];
    db.delete(payment_allocations).where(eq(payment_allocations.payment_id, id)).run();
    db.delete(payments).where(eq(payments.id, id)).run();
    // recompute invoice statuses
    for (const a of allocs) {
      updateInvoiceStatusForAllocation(db, a, '');
    }
  })();
}
