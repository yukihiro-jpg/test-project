import type { AppDb } from '../db/client';
import { payments, payment_allocations, sales_invoices, purchase_invoices, cashflow_entries, invoice_offsets } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import type { Payment, PaymentAllocation, InvoiceOffset } from '../types';
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

/**
 * Returns total settled amount on an invoice = allocated + adjustment from payment_allocations
 * plus any invoice_offsets recorded for the invoice.
 */
function totalSettledForInvoice(db: AppDb, invoiceType: 'sales' | 'purchase', invoiceId: number): number {
  const allocs = db.select().from(payment_allocations)
    .where(and(eq(payment_allocations.invoice_type, invoiceType), eq(payment_allocations.invoice_id, invoiceId))).all() as PaymentAllocation[];
  let total = allocs.reduce((s, a) => s + (a.allocated_amount ?? 0) + (a.adjustment_amount ?? 0), 0);
  // include invoice_offsets
  const offCol = invoiceType === 'sales' ? 'sales_invoice_id' : 'purchase_invoice_id';
  const off = db.$sqlite.prepare(`SELECT COALESCE(SUM(amount),0) AS s FROM invoice_offsets WHERE ${offCol} = ?`).get(invoiceId) as { s: number };
  total += off.s ?? 0;
  return total;
}

function updateInvoiceStatusForInvoice(db: AppDb, invoiceType: 'sales' | 'purchase', invoiceId: number, paymentDate: string) {
  const table = invoiceType === 'sales' ? sales_invoices : purchase_invoices;
  const inv = db.select().from(table as any).where(eq((table as any).id, invoiceId)).get() as any;
  if (!inv) return;
  const total = totalSettledForInvoice(db, invoiceType, invoiceId);
  let status: string = inv.status;
  if (total >= inv.total_inc_tax) status = 'paid';
  else if (total > 0) status = 'partially_paid';
  else status = inv.status === 'paid' || inv.status === 'partially_paid' ? 'issued' : inv.status;
  db.update(table as any).set({ status }).where(eq((table as any).id, invoiceId)).run();
  if (status === 'paid' && paymentDate) {
    markCashflowCompleted(db, invoiceType === 'sales' ? 'sales_invoice' : 'purchase_invoice', invoiceId, paymentDate);
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
        allocated_amount: a.allocated_amount ?? 0,
        adjustment_amount: a.adjustment_amount ?? 0,
        adjustment_reason: a.adjustment_reason ?? null
      }).run();
      updateInvoiceStatusForInvoice(db, a.invoice_type, a.invoice_id, input.date!);
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
    // also delete linked manual cashflow entry
    db.$sqlite.prepare(`DELETE FROM cashflow_entries WHERE source_type='manual' AND source_id=?`).run(id);
    // recompute invoice statuses
    for (const a of allocs) {
      updateInvoiceStatusForInvoice(db, a.invoice_type, a.invoice_id, '');
    }
  })();
}

export async function createOffset(db: AppDb, input: Omit<InvoiceOffset, 'id' | 'created_at'>): Promise<InvoiceOffset> {
  return db.$sqlite.transaction(() => {
    const ins = db.insert(invoice_offsets).values({
      date: input.date,
      sales_invoice_id: input.sales_invoice_id,
      purchase_invoice_id: input.purchase_invoice_id,
      amount: input.amount,
      memo: input.memo ?? null
    }).returning().get() as any;
    updateInvoiceStatusForInvoice(db, 'sales', input.sales_invoice_id, input.date);
    updateInvoiceStatusForInvoice(db, 'purchase', input.purchase_invoice_id, input.date);
    return ins as InvoiceOffset;
  })();
}

export async function listOffsets(db: AppDb): Promise<InvoiceOffset[]> {
  return db.select().from(invoice_offsets).all() as InvoiceOffset[];
}

export async function removeOffset(db: AppDb, id: number): Promise<void> {
  db.$sqlite.transaction(() => {
    const row = db.select().from(invoice_offsets).where(eq(invoice_offsets.id, id)).get() as InvoiceOffset | undefined;
    if (!row) return;
    db.delete(invoice_offsets).where(eq(invoice_offsets.id, id)).run();
    updateInvoiceStatusForInvoice(db, 'sales', row.sales_invoice_id, row.date);
    updateInvoiceStatusForInvoice(db, 'purchase', row.purchase_invoice_id, row.date);
  })();
}
