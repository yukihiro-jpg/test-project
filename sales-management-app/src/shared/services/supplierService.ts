import type { AppDb } from '../db/client';
import { suppliers } from '../db/schema';
import { eq } from 'drizzle-orm';
import type { Supplier } from '../types';
import ExcelJS from 'exceljs';

export async function list(db: AppDb): Promise<Supplier[]> {
  return db.select().from(suppliers).all() as Supplier[];
}

export async function get(db: AppDb, id: number): Promise<Supplier | undefined> {
  return db.select().from(suppliers).where(eq(suppliers.id, id)).get() as Supplier | undefined;
}

export async function create(db: AppDb, input: Partial<Supplier>): Promise<Supplier> {
  const r = db.insert(suppliers).values({
    code: input.code!,
    name: input.name!,
    name_kana: input.name_kana ?? null,
    postal_code: input.postal_code ?? null,
    address: input.address ?? null,
    phone: input.phone ?? null,
    email: input.email ?? null,
    registered_invoice_no: input.registered_invoice_no ?? null,
    payment_terms_days: input.payment_terms_days ?? null,
    closing_day: input.closing_day ?? null,
    payment_day: input.payment_day ?? null,
    default_bank_account_id: input.default_bank_account_id ?? null,
    notes: input.notes ?? null
  }).returning().get();
  return r as Supplier;
}

export async function update(db: AppDb, id: number, input: Partial<Supplier>): Promise<Supplier> {
  const patch: any = { ...input };
  delete patch.id;
  patch.updated_at = new Date().toISOString();
  db.update(suppliers).set(patch).where(eq(suppliers.id, id)).run();
  return (await get(db, id))!;
}

export async function remove(db: AppDb, id: number): Promise<void> {
  db.delete(suppliers).where(eq(suppliers.id, id)).run();
}

export async function generateTemplateExcel(_db: AppDb): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('仕入先');
  ws.columns = [
    { header: '取引先コード', key: 'code', width: 14 },
    { header: '取引先名', key: 'name', width: 28 },
    { header: 'カナ', key: 'kana', width: 20 },
    { header: '郵便番号', key: 'postal', width: 12 },
    { header: '住所', key: 'address', width: 36 },
    { header: '電話番号', key: 'phone', width: 16 },
    { header: 'メール', key: 'email', width: 22 },
    { header: '適格請求書番号', key: 'rin', width: 18 },
    { header: 'サイト日数', key: 'site', width: 10 },
    { header: '締日', key: 'close', width: 8 },
    { header: '支払日', key: 'pay', width: 8 }
  ];
  ws.addRow({ code: 'S001', name: 'サンプル商事', kana: 'サンプルショウジ', postal: '100-0001', address: '東京都千代田区...', phone: '03-0000-0000', email: 'supplier@example.com', rin: 'T9876543210987', site: 30, close: 31, pay: 31 });
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}

export async function importFromExcel(db: AppDb, buffer: ArrayBuffer): Promise<{ inserted: number; updated: number; errors: string[] }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  const errors: string[] = [];
  let inserted = 0;
  let updated = 0;
  const header: Record<string, number> = {};
  ws.getRow(1).eachCell((cell, col) => { header[String(cell.value).trim()] = col; });
  const getCell = (row: ExcelJS.Row, name: string) => {
    const c = header[name];
    if (!c) return undefined;
    const v = row.getCell(c).value;
    return v == null ? undefined : String(v);
  };
  for (let i = 2; i <= ws.rowCount; i++) {
    const row = ws.getRow(i);
    const code = getCell(row, '取引先コード') ?? getCell(row, 'code');
    const name = getCell(row, '取引先名') ?? getCell(row, 'name');
    if (!code || !name) continue;
    const existing = db.select().from(suppliers).where(eq(suppliers.code, code)).get() as Supplier | undefined;
    const data = {
      code, name,
      name_kana: getCell(row, 'カナ') ?? null,
      postal_code: getCell(row, '郵便番号') ?? null,
      address: getCell(row, '住所') ?? null,
      phone: getCell(row, '電話番号') ?? null,
      email: getCell(row, 'メール') ?? null,
      registered_invoice_no: getCell(row, '適格請求書番号') ?? null,
      payment_terms_days: Number(getCell(row, 'サイト日数')) || null,
      closing_day: Number(getCell(row, '締日')) || null,
      payment_day: Number(getCell(row, '支払日')) || null
    };
    try {
      if (existing) {
        db.update(suppliers).set(data).where(eq(suppliers.id, existing.id)).run();
        updated++;
      } else {
        db.insert(suppliers).values(data).run();
        inserted++;
      }
    } catch (e: any) {
      errors.push(`行${i}: ${e.message}`);
    }
  }
  return { inserted, updated, errors };
}
