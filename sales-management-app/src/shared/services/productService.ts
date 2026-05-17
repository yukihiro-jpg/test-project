import type { AppDb } from '../db/client';
import { products } from '../db/schema';
import { eq } from 'drizzle-orm';
import type { Product } from '../types';
import ExcelJS from 'exceljs';

export async function list(db: AppDb): Promise<Product[]> {
  return db.select().from(products).all() as Product[];
}

export async function get(db: AppDb, id: number): Promise<Product | undefined> {
  return db.select().from(products).where(eq(products.id, id)).get() as Product | undefined;
}

export async function create(db: AppDb, input: Partial<Product>): Promise<Product> {
  const r = db.insert(products).values({
    code: input.code!,
    name: input.name!,
    unit: input.unit ?? null,
    sales_unit_price: input.sales_unit_price ?? 0,
    purchase_unit_price: input.purchase_unit_price ?? 0,
    tax_rate: input.tax_rate ?? 10,
    category: input.category ?? null,
    notes: input.notes ?? null
  }).returning().get();
  return r as Product;
}

export async function update(db: AppDb, id: number, input: Partial<Product>): Promise<Product> {
  const patch: any = { ...input };
  delete patch.id;
  patch.updated_at = new Date().toISOString();
  db.update(products).set(patch).where(eq(products.id, id)).run();
  return (await get(db, id))!;
}

export async function remove(db: AppDb, id: number): Promise<void> {
  db.delete(products).where(eq(products.id, id)).run();
}

async function importPrices(db: AppDb, buffer: ArrayBuffer, field: 'sales_unit_price' | 'purchase_unit_price', priceColumn: string) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  const errors: string[] = [];
  let inserted = 0, updated = 0;
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
    const code = getCell(row, '商品コード') ?? getCell(row, 'code');
    const name = getCell(row, '商品名') ?? getCell(row, 'name');
    const priceStr = getCell(row, priceColumn);
    if (!code) continue;
    const price = Number(priceStr) || 0;
    const unit = getCell(row, '単位') ?? null;
    const tax_rate = Number(getCell(row, '税率')) || 10;
    try {
      const existing = db.select().from(products).where(eq(products.code, code)).get() as Product | undefined;
      if (existing) {
        const patch: any = { [field]: price, unit: unit ?? existing.unit, tax_rate };
        db.update(products).set(patch).where(eq(products.id, existing.id)).run();
        updated++;
      } else {
        if (!name) { errors.push(`行${i}: 新規登録には商品名が必要です`); continue; }
        const values: any = { code, name, unit, tax_rate, sales_unit_price: 0, purchase_unit_price: 0 };
        values[field] = price;
        db.insert(products).values(values).run();
        inserted++;
      }
    } catch (e: any) {
      errors.push(`行${i}: ${e.message}`);
    }
  }
  return { inserted, updated, errors };
}

export async function importSalesPricesFromExcel(db: AppDb, buffer: ArrayBuffer) {
  return importPrices(db, buffer, 'sales_unit_price', '売上単価');
}

export async function importPurchasePricesFromExcel(db: AppDb, buffer: ArrayBuffer) {
  return importPrices(db, buffer, 'purchase_unit_price', '仕入単価');
}
