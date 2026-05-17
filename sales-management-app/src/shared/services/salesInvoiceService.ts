import type { AppDb } from '../db/client';
import { sales_invoices, sales_invoice_lines, customers, deliveries } from '../db/schema';
import { eq } from 'drizzle-orm';
import type { SalesInvoice, SalesInvoiceLine, Customer } from '../types';
import { computeInvoiceTotals, computeLineAmount, todayISO, addDaysISO } from './utils';
import { upsertCashflowForSalesInvoice, deleteCashflowFor, markCashflowCompleted } from './cashflowSync';

export async function list(db: AppDb): Promise<SalesInvoice[]> {
  return db.select().from(sales_invoices).all() as SalesInvoice[];
}

export async function get(db: AppDb, id: number): Promise<SalesInvoice | undefined> {
  const inv = db.select().from(sales_invoices).where(eq(sales_invoices.id, id)).get() as SalesInvoice | undefined;
  if (!inv) return undefined;
  inv.lines = db.select().from(sales_invoice_lines).where(eq(sales_invoice_lines.invoice_id, id)).all() as SalesInvoiceLine[];
  return inv;
}

function generateInvoiceNo(db: AppDb, issueDate: string): string {
  const prefix = `S-${issueDate.replace(/-/g, '')}-`;
  const cnt = db.$sqlite.prepare(`SELECT COUNT(*) AS c FROM sales_invoices WHERE invoice_no LIKE ?`).get(prefix + '%') as { c: number };
  return `${prefix}${String(cnt.c + 1).padStart(3, '0')}`;
}

export async function create(db: AppDb, input: Partial<SalesInvoice> & { lines: SalesInvoiceLine[] }): Promise<SalesInvoice> {
  return db.$sqlite.transaction(() => {
    const issue_date = input.issue_date ?? todayISO();
    const customer = db.select().from(customers).where(eq(customers.id, input.customer_id!)).get() as Customer | undefined;
    const due_date = input.due_date ?? addDaysISO(issue_date, customer?.payment_terms_days ?? 30);
    const lines = input.lines.map(l => ({ ...l, amount_ex_tax: computeLineAmount(l.quantity, l.unit_price) }));
    const totals = computeInvoiceTotals(lines);
    const invoice_no = input.invoice_no ?? generateInvoiceNo(db, issue_date);

    const ins = db.insert(sales_invoices).values({
      invoice_no,
      customer_id: input.customer_id!,
      issue_date,
      due_date,
      subtotal_ex_tax: totals.subtotal_ex_tax,
      tax_amount: totals.tax_amount,
      total_inc_tax: totals.total_inc_tax,
      status: input.status ?? 'issued',
      notes: input.notes ?? null,
      registered_invoice_no_snapshot: customer?.registered_invoice_no ?? null
    }).returning().get() as any;

    for (const l of lines) {
      db.insert(sales_invoice_lines).values({
        invoice_id: ins.id,
        delivery_line_id: l.delivery_line_id ?? null,
        product_id: l.product_id ?? null,
        description: l.description,
        quantity: l.quantity,
        unit_price: l.unit_price,
        tax_rate: l.tax_rate,
        amount_ex_tax: l.amount_ex_tax
      }).run();
    }

    upsertCashflowForSalesInvoice(db, {
      id: ins.id, due_date, total_inc_tax: totals.total_inc_tax, status: ins.status, customer_id: input.customer_id!
    });

    return get(db, ins.id) as any;
  })();
}

export async function update(db: AppDb, id: number, input: Partial<SalesInvoice> & { lines?: SalesInvoiceLine[] }): Promise<SalesInvoice> {
  return db.$sqlite.transaction(() => {
    const cur = db.select().from(sales_invoices).where(eq(sales_invoices.id, id)).get() as SalesInvoice | undefined;
    if (!cur) throw new Error('請求書が見つかりません');
    const patch: any = {};
    if (input.customer_id != null) patch.customer_id = input.customer_id;
    if (input.issue_date != null) patch.issue_date = input.issue_date;
    if (input.due_date != null) patch.due_date = input.due_date;
    if (input.status != null) patch.status = input.status;
    if (input.notes !== undefined) patch.notes = input.notes;
    patch.updated_at = new Date().toISOString();

    if (input.lines) {
      db.delete(sales_invoice_lines).where(eq(sales_invoice_lines.invoice_id, id)).run();
      const lines = input.lines.map(l => ({ ...l, amount_ex_tax: computeLineAmount(l.quantity, l.unit_price) }));
      const totals = computeInvoiceTotals(lines);
      patch.subtotal_ex_tax = totals.subtotal_ex_tax;
      patch.tax_amount = totals.tax_amount;
      patch.total_inc_tax = totals.total_inc_tax;
      for (const l of lines) {
        db.insert(sales_invoice_lines).values({
          invoice_id: id,
          delivery_line_id: l.delivery_line_id ?? null,
          product_id: l.product_id ?? null,
          description: l.description,
          quantity: l.quantity,
          unit_price: l.unit_price,
          tax_rate: l.tax_rate,
          amount_ex_tax: l.amount_ex_tax
        }).run();
      }
    }
    db.update(sales_invoices).set(patch).where(eq(sales_invoices.id, id)).run();
    const updated = db.select().from(sales_invoices).where(eq(sales_invoices.id, id)).get() as SalesInvoice;
    upsertCashflowForSalesInvoice(db, {
      id, due_date: updated.due_date, total_inc_tax: updated.total_inc_tax, status: updated.status, customer_id: updated.customer_id
    });
    if (updated.status === 'paid') {
      markCashflowCompleted(db, 'sales_invoice', id, todayISO());
    }
    return get(db, id) as any;
  })();
}

export async function remove(db: AppDb, id: number): Promise<void> {
  db.$sqlite.transaction(() => {
    db.update(deliveries).set({ status: 'pending', invoice_id: null }).where(eq(deliveries.invoice_id, id)).run();
    db.delete(sales_invoice_lines).where(eq(sales_invoice_lines.invoice_id, id)).run();
    db.delete(sales_invoices).where(eq(sales_invoices.id, id)).run();
    deleteCashflowFor(db, 'sales_invoice', id);
  })();
}

export async function recomputeTotals(db: AppDb, id: number): Promise<void> {
  const lines = db.select().from(sales_invoice_lines).where(eq(sales_invoice_lines.invoice_id, id)).all() as SalesInvoiceLine[];
  const totals = computeInvoiceTotals(lines);
  db.update(sales_invoices).set(totals).where(eq(sales_invoices.id, id)).run();
}

export async function generatePdf(db: AppDb, id: number, companyInfo: { name?: string; address?: string; phone?: string; registered_invoice_no?: string }): Promise<Buffer> {
  const inv = await get(db, id);
  if (!inv) throw new Error('請求書が見つかりません');
  const customer = db.select().from(customers).where(eq(customers.id, inv.customer_id)).get() as Customer | undefined;

  // pdfmake (node)
  // TODO: 日本語フォントの vfs_fonts を Noto Sans JP で再ビルドして差し替えること。
  const PdfPrinter = require('pdfmake');
  const fonts = {
    Roboto: {
      normal: 'Helvetica',
      bold: 'Helvetica-Bold',
      italics: 'Helvetica-Oblique',
      bolditalics: 'Helvetica-BoldOblique'
    }
  };
  const printer = new PdfPrinter(fonts);
  const lineRows = (inv.lines ?? []).map(l => [l.description, String(l.quantity), String(l.unit_price), String(l.amount_ex_tax)]);
  const docDef: any = {
    content: [
      { text: 'INVOICE / 請求書', style: 'header' },
      { text: `Invoice No: ${inv.invoice_no}` },
      { text: `Issue Date: ${inv.issue_date}` },
      { text: `Due Date: ${inv.due_date}` },
      { text: ' ' },
      { text: `Bill To: ${customer?.name ?? ''}` },
      { text: `Address: ${customer?.address ?? ''}` },
      { text: ' ' },
      { text: `From: ${companyInfo.name ?? ''}` },
      { text: `Address: ${companyInfo.address ?? ''}` },
      { text: `Tel: ${companyInfo.phone ?? ''}` },
      { text: `Registered Invoice No: ${companyInfo.registered_invoice_no ?? ''}` },
      { text: ' ' },
      {
        table: {
          headerRows: 1,
          widths: ['*', 50, 60, 70],
          body: [
            ['Description', 'Qty', 'Unit Price', 'Amount (ex tax)'],
            ...lineRows
          ]
        }
      },
      { text: ' ' },
      { text: `Subtotal (ex tax): ${inv.subtotal_ex_tax}` },
      { text: `Tax: ${inv.tax_amount}` },
      { text: `Total (inc tax): ${inv.total_inc_tax}`, bold: true }
    ],
    styles: {
      header: { fontSize: 18, bold: true }
    },
    defaultStyle: { font: 'Roboto' }
  };
  const pdfDoc = printer.createPdfKitDocument(docDef);
  return await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    pdfDoc.on('data', (c: Buffer) => chunks.push(c));
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
    pdfDoc.on('error', reject);
    pdfDoc.end();
  });
}
