import type { AppDb } from '../db/client';
import { products, purchase_invoice_lines, purchase_invoices, suppliers } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import ExcelJS from 'exceljs';

export async function generateStocktakeExcel(db: AppDb): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('棚卸表');
  ws.columns = [
    { header: '商品コード', key: 'code', width: 15 },
    { header: '商品名', key: 'name', width: 30 },
    { header: '単位', key: 'unit', width: 8 },
    { header: '最新仕入単価', key: 'price', width: 14 },
    { header: '最新仕入日', key: 'date', width: 14 },
    { header: '仕入先', key: 'supplier', width: 24 },
    { header: '実地数量', key: 'qty', width: 12 },
    { header: '備考', key: 'notes', width: 24 }
  ];
  const prods = db.select().from(products).all() as any[];
  for (const p of prods) {
    const latest = db.select({
      unit_price: purchase_invoice_lines.unit_price,
      purchase_date: purchase_invoice_lines.purchase_date,
      issue_date: purchase_invoices.issue_date,
      supplier_id: purchase_invoices.supplier_id
    })
      .from(purchase_invoice_lines)
      .innerJoin(purchase_invoices, eq(purchase_invoices.id, purchase_invoice_lines.invoice_id))
      .where(eq(purchase_invoice_lines.product_id, p.id))
      .orderBy(desc(purchase_invoice_lines.purchase_date), desc(purchase_invoices.issue_date))
      .limit(1)
      .get() as any;
    let supplierName = '';
    if (latest?.supplier_id) {
      const s = db.select().from(suppliers).where(eq(suppliers.id, latest.supplier_id)).get() as any;
      supplierName = s?.name ?? '';
    }
    ws.addRow({
      code: p.code,
      name: p.name,
      unit: p.unit ?? '',
      price: latest?.unit_price ?? p.purchase_unit_price,
      date: latest?.purchase_date ?? latest?.issue_date ?? '',
      supplier: supplierName,
      qty: '',
      notes: ''
    });
  }
  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer as ArrayBuffer);
}
