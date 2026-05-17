import type { AppDb } from '../db/client';
import { purchase_invoices, purchase_invoice_lines, suppliers } from '../db/schema';
import { eq } from 'drizzle-orm';
import type { PurchaseInvoice, PurchaseInvoiceLine, ParsedPurchaseInvoice, Supplier } from '../types';
import { UserActionableError } from '../types';
import { computeInvoiceTotals, computeLineAmount, todayISO, addDaysISO } from './utils';
import { upsertCashflowForPurchaseInvoice, deleteCashflowFor, markCashflowCompleted } from './cashflowSync';

export async function list(db: AppDb): Promise<PurchaseInvoice[]> {
  return db.select().from(purchase_invoices).all() as PurchaseInvoice[];
}

export async function get(db: AppDb, id: number): Promise<PurchaseInvoice | undefined> {
  const inv = db.select().from(purchase_invoices).where(eq(purchase_invoices.id, id)).get() as PurchaseInvoice | undefined;
  if (!inv) return undefined;
  inv.lines = db.select().from(purchase_invoice_lines).where(eq(purchase_invoice_lines.invoice_id, id)).all() as PurchaseInvoiceLine[];
  return inv;
}

export async function create(db: AppDb, input: Partial<PurchaseInvoice> & { lines: PurchaseInvoiceLine[] }): Promise<PurchaseInvoice> {
  return db.$sqlite.transaction(() => {
    const issue_date = input.issue_date ?? todayISO();
    const supplier = db.select().from(suppliers).where(eq(suppliers.id, input.supplier_id!)).get() as Supplier | undefined;
    const due_date = input.due_date ?? addDaysISO(issue_date, supplier?.payment_terms_days ?? 30);
    const lines = input.lines.map(l => ({ ...l, amount_ex_tax: computeLineAmount(l.quantity, l.unit_price) }));
    const totals = computeInvoiceTotals(lines);

    const ins = db.insert(purchase_invoices).values({
      invoice_no: input.invoice_no ?? `P-${issue_date.replace(/-/g, '')}-${Date.now().toString().slice(-3)}`,
      supplier_id: input.supplier_id!,
      issue_date,
      due_date,
      subtotal_ex_tax: totals.subtotal_ex_tax,
      tax_amount: totals.tax_amount,
      total_inc_tax: totals.total_inc_tax,
      status: input.status ?? 'issued',
      notes: input.notes ?? null,
      source_pdf_path: input.source_pdf_path ?? null
    }).returning().get() as any;

    for (const l of lines) {
      db.insert(purchase_invoice_lines).values({
        invoice_id: ins.id,
        product_id: l.product_id ?? null,
        description: l.description,
        quantity: l.quantity,
        unit_price: l.unit_price,
        tax_rate: l.tax_rate,
        amount_ex_tax: l.amount_ex_tax,
        purchase_date: l.purchase_date ?? null
      }).run();
    }

    upsertCashflowForPurchaseInvoice(db, {
      id: ins.id, due_date, total_inc_tax: totals.total_inc_tax, status: ins.status, supplier_id: input.supplier_id!
    });

    return get(db, ins.id) as any;
  })();
}

export async function update(db: AppDb, id: number, input: Partial<PurchaseInvoice> & { lines?: PurchaseInvoiceLine[] }): Promise<PurchaseInvoice> {
  return db.$sqlite.transaction(() => {
    const cur = db.select().from(purchase_invoices).where(eq(purchase_invoices.id, id)).get() as PurchaseInvoice | undefined;
    if (!cur) throw new Error('請求書が見つかりません');
    const patch: any = {};
    if (input.invoice_no != null) patch.invoice_no = input.invoice_no;
    if (input.supplier_id != null) patch.supplier_id = input.supplier_id;
    if (input.issue_date != null) patch.issue_date = input.issue_date;
    if (input.due_date != null) patch.due_date = input.due_date;
    if (input.status != null) patch.status = input.status;
    if (input.notes !== undefined) patch.notes = input.notes;
    patch.updated_at = new Date().toISOString();

    if (input.lines) {
      db.delete(purchase_invoice_lines).where(eq(purchase_invoice_lines.invoice_id, id)).run();
      const lines = input.lines.map(l => ({ ...l, amount_ex_tax: computeLineAmount(l.quantity, l.unit_price) }));
      const totals = computeInvoiceTotals(lines);
      patch.subtotal_ex_tax = totals.subtotal_ex_tax;
      patch.tax_amount = totals.tax_amount;
      patch.total_inc_tax = totals.total_inc_tax;
      for (const l of lines) {
        db.insert(purchase_invoice_lines).values({
          invoice_id: id,
          product_id: l.product_id ?? null,
          description: l.description,
          quantity: l.quantity,
          unit_price: l.unit_price,
          tax_rate: l.tax_rate,
          amount_ex_tax: l.amount_ex_tax,
          purchase_date: l.purchase_date ?? null
        }).run();
      }
    }
    db.update(purchase_invoices).set(patch).where(eq(purchase_invoices.id, id)).run();
    const updated = db.select().from(purchase_invoices).where(eq(purchase_invoices.id, id)).get() as PurchaseInvoice;
    upsertCashflowForPurchaseInvoice(db, {
      id, due_date: updated.due_date, total_inc_tax: updated.total_inc_tax, status: updated.status, supplier_id: updated.supplier_id
    });
    if (updated.status === 'paid') {
      markCashflowCompleted(db, 'purchase_invoice', id, todayISO());
    }
    return get(db, id) as any;
  })();
}

export async function remove(db: AppDb, id: number): Promise<void> {
  db.$sqlite.transaction(() => {
    db.delete(purchase_invoice_lines).where(eq(purchase_invoice_lines.invoice_id, id)).run();
    db.delete(purchase_invoices).where(eq(purchase_invoices.id, id)).run();
    deleteCashflowFor(db, 'purchase_invoice', id);
  })();
}

export async function parsePdfWithGemini(_db: AppDb, pdfBuffer: Buffer, apiKey: string): Promise<ParsedPurchaseInvoice> {
  if (!apiKey) {
    throw new UserActionableError('NO_API_KEY', 'Gemini APIキーが未設定です。設定画面から登録してください。');
  }
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });
  const base64 = pdfBuffer.toString('base64');
  const prompt = `この日本語の請求書PDFを解析し、以下のJSONスキーマで返答してください。コードブロックや説明は付けず、JSONのみ返答してください。
{
  "supplier_name": string,
  "invoice_no": string,
  "issue_date": "YYYY-MM-DD",
  "due_date": "YYYY-MM-DD",
  "lines": [{"product_name": string, "quantity": number, "unit_price": number, "purchase_date": "YYYY-MM-DD", "tax_rate": 10 | 8}]
}`;
  const res: any = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [{ role: 'user', parts: [
      { inlineData: { mimeType: 'application/pdf', data: base64 } },
      { text: prompt }
    ] }]
  });
  const text: string = res.text ?? res.response?.text?.() ?? '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new UserActionableError('PARSE_FAILED', 'PDFから情報を抽出できませんでした。');
  const parsed = JSON.parse(jsonMatch[0]) as ParsedPurchaseInvoice;
  return parsed;
}
