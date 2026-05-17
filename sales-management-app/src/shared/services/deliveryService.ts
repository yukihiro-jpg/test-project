import type { AppDb } from '../db/client';
import { deliveries, delivery_lines, sales_invoices, sales_invoice_lines, customers } from '../db/schema';
import { eq, inArray } from 'drizzle-orm';
import type { Delivery, DeliveryLine, Customer } from '../types';
import { computeInvoiceTotals, computeLineAmount, todayISO, addDaysISO } from './utils';
import { upsertCashflowForSalesInvoice } from './cashflowSync';

export interface DeliveryListOptions {
  status?: 'pending' | 'invoiced' | 'uninvoiced' | 'invoiced_only';
  customerId?: number;
  dateFrom?: string;
  dateTo?: string;
}

export async function list(db: AppDb, options: DeliveryListOptions = {}): Promise<Array<Delivery & { invoice_no?: string | null; invoice_issue_date?: string | null }>> {
  const where: string[] = [];
  const params: any[] = [];
  if (options.status === 'pending' || options.status === 'uninvoiced') {
    where.push("(d.status = 'pending' OR d.invoice_id IS NULL)");
  } else if (options.status === 'invoiced' || options.status === 'invoiced_only') {
    where.push("d.invoice_id IS NOT NULL");
  }
  if (options.customerId != null) {
    where.push("d.customer_id = ?");
    params.push(options.customerId);
  }
  if (options.dateFrom) {
    where.push("d.delivery_date >= ?");
    params.push(options.dateFrom);
  }
  if (options.dateTo) {
    where.push("d.delivery_date <= ?");
    params.push(options.dateTo);
  }
  const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";
  const sql = `
    SELECT d.*, si.invoice_no AS invoice_no, si.issue_date AS invoice_issue_date
    FROM deliveries d
    LEFT JOIN sales_invoices si ON si.id = d.invoice_id
    ${whereSql}
    ORDER BY d.delivery_date DESC, d.id DESC
  `;
  return db.$sqlite.prepare(sql).all(...params) as any;
}

export async function get(db: AppDb, id: number): Promise<Delivery | undefined> {
  const d = db.select().from(deliveries).where(eq(deliveries.id, id)).get() as Delivery | undefined;
  if (!d) return undefined;
  d.lines = db.select().from(delivery_lines).where(eq(delivery_lines.delivery_id, id)).all() as DeliveryLine[];
  return d;
}

export async function create(db: AppDb, input: Partial<Delivery> & { lines: DeliveryLine[] }): Promise<Delivery> {
  return db.$sqlite.transaction(() => {
    const res = db.insert(deliveries).values({
      customer_id: input.customer_id!,
      delivery_date: input.delivery_date!,
      notes: input.notes ?? null,
      status: input.status ?? 'pending'
    }).returning().get() as any;
    for (const l of input.lines) {
      db.insert(delivery_lines).values({
        delivery_id: res.id,
        product_id: l.product_id ?? null,
        product_name_snapshot: l.product_name_snapshot,
        quantity: l.quantity,
        unit_price: l.unit_price,
        tax_rate: l.tax_rate,
        amount_ex_tax: computeLineAmount(l.quantity, l.unit_price)
      }).run();
    }
    return get(db, res.id) as any;
  })();
}

export async function update(db: AppDb, id: number, input: Partial<Delivery> & { lines?: DeliveryLine[] }): Promise<Delivery> {
  return db.$sqlite.transaction(() => {
    const patch: any = {};
    if (input.customer_id != null) patch.customer_id = input.customer_id;
    if (input.delivery_date != null) patch.delivery_date = input.delivery_date;
    if (input.notes !== undefined) patch.notes = input.notes;
    if (input.status != null) patch.status = input.status;
    if (Object.keys(patch).length) {
      db.update(deliveries).set(patch).where(eq(deliveries.id, id)).run();
    }
    if (input.lines) {
      db.delete(delivery_lines).where(eq(delivery_lines.delivery_id, id)).run();
      for (const l of input.lines) {
        db.insert(delivery_lines).values({
          delivery_id: id,
          product_id: l.product_id ?? null,
          product_name_snapshot: l.product_name_snapshot,
          quantity: l.quantity,
          unit_price: l.unit_price,
          tax_rate: l.tax_rate,
          amount_ex_tax: computeLineAmount(l.quantity, l.unit_price)
        }).run();
      }
    }
    return get(db, id) as any;
  })();
}

export async function remove(db: AppDb, id: number): Promise<void> {
  db.$sqlite.transaction(() => {
    db.delete(delivery_lines).where(eq(delivery_lines.delivery_id, id)).run();
    db.delete(deliveries).where(eq(deliveries.id, id)).run();
  })();
}

export async function aggregateToInvoice(db: AppDb, deliveryIds: number[], options: { issue_date?: string; due_date?: string } = {}): Promise<number> {
  if (!deliveryIds.length) throw new Error('納品が選択されていません');
  return db.$sqlite.transaction(() => {
    const dels = db.select().from(deliveries).where(inArray(deliveries.id, deliveryIds)).all() as Delivery[];
    if (!dels.length) throw new Error('対象納品が見つかりません');
    const customerId = dels[0].customer_id;
    if (dels.some(d => d.customer_id !== customerId)) throw new Error('複数の顧客が混在しています');
    if (dels.some(d => d.status !== 'pending')) throw new Error('既に請求済の納品が含まれます');

    const customer = db.select().from(customers).where(eq(customers.id, customerId)).get() as Customer | undefined;
    const allLines = db.select().from(delivery_lines).where(inArray(delivery_lines.delivery_id, deliveryIds)).all() as DeliveryLine[];
    const totals = computeInvoiceTotals(allLines);

    const issueDate = options.issue_date ?? todayISO();
    const dueDate = options.due_date ?? addDaysISO(issueDate, customer?.payment_terms_days ?? 30);

    // generate invoice no
    const dateNoDash = issueDate.replace(/-/g, '');
    const prefix = `S-${dateNoDash}-`;
    const cnt = db.$sqlite.prepare(`SELECT COUNT(*) AS c FROM sales_invoices WHERE invoice_no LIKE ?`).get(prefix + '%') as { c: number };
    const invoiceNo = `${prefix}${String(cnt.c + 1).padStart(3, '0')}`;

    const ins = db.insert(sales_invoices).values({
      invoice_no: invoiceNo,
      customer_id: customerId,
      issue_date: issueDate,
      due_date: dueDate,
      subtotal_ex_tax: totals.subtotal_ex_tax,
      tax_amount: totals.tax_amount,
      total_inc_tax: totals.total_inc_tax,
      status: 'issued',
      registered_invoice_no_snapshot: customer?.registered_invoice_no ?? null
    }).returning().get() as any;

    for (const l of allLines) {
      db.insert(sales_invoice_lines).values({
        invoice_id: ins.id,
        delivery_line_id: l.id ?? null,
        product_id: l.product_id ?? null,
        description: l.product_name_snapshot,
        quantity: l.quantity,
        unit_price: l.unit_price,
        tax_rate: l.tax_rate,
        amount_ex_tax: l.amount_ex_tax
      }).run();
    }

    db.update(deliveries).set({ status: 'invoiced', invoice_id: ins.id }).where(inArray(deliveries.id, deliveryIds)).run();

    upsertCashflowForSalesInvoice(db, {
      id: ins.id,
      due_date: dueDate,
      total_inc_tax: totals.total_inc_tax,
      status: 'issued',
      customer_id: customerId
    });

    return ins.id as number;
  })();
}
