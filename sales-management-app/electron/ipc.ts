import { ipcMain, dialog, shell } from 'electron';
import * as path from 'node:path';
import * as fs from 'node:fs';
import type { AppDb } from '../src/shared/db/client';
import * as customerService from '../src/shared/services/customerService';
import * as supplierService from '../src/shared/services/supplierService';
import * as productService from '../src/shared/services/productService';
import * as bankAccountService from '../src/shared/services/bankAccountService';
import * as deliveryService from '../src/shared/services/deliveryService';
import * as salesInvoiceService from '../src/shared/services/salesInvoiceService';
import * as purchaseInvoiceService from '../src/shared/services/purchaseInvoiceService';
import * as paymentService from '../src/shared/services/paymentService';
import * as cashflowService from '../src/shared/services/cashflowService';
import * as arAgingService from '../src/shared/services/arAgingService';
import * as apAgingService from '../src/shared/services/apAgingService';
import * as inventoryService from '../src/shared/services/inventoryService';
import * as backupService from '../src/shared/services/backupService';
import { makeSettingsService, type SafeStorageLike } from '../src/shared/services/settingsService';
import { sales_invoices, purchase_invoices } from '../src/shared/db/schema';
import { sql } from 'drizzle-orm';

interface Ctx {
  db: AppDb;
  safeStorage: SafeStorageLike;
  dbPath: string;
  pdfDir: string;
}

export function registerIpc(ctx: Ctx) {
  const { db, pdfDir, dbPath } = ctx;
  const settingsSvc = makeSettingsService(ctx.safeStorage);

  const modules: Record<string, Record<string, (...args: any[]) => any>> = {
    customers: {
      list: () => customerService.list(db),
      get: (id: number) => customerService.get(db, id),
      create: (input: any) => customerService.create(db, input),
      update: (id: number, input: any) => customerService.update(db, id, input),
      delete: (id: number) => customerService.remove(db, id),
      importFromExcel: (buf: ArrayBuffer) => customerService.importFromExcel(db, buf)
    },
    suppliers: {
      list: () => supplierService.list(db),
      get: (id: number) => supplierService.get(db, id),
      create: (input: any) => supplierService.create(db, input),
      update: (id: number, input: any) => supplierService.update(db, id, input),
      delete: (id: number) => supplierService.remove(db, id),
      importFromExcel: (buf: ArrayBuffer) => supplierService.importFromExcel(db, buf)
    },
    products: {
      list: () => productService.list(db),
      get: (id: number) => productService.get(db, id),
      create: (input: any) => productService.create(db, input),
      update: (id: number, input: any) => productService.update(db, id, input),
      delete: (id: number) => productService.remove(db, id),
      importSalesPricesFromExcel: (buf: ArrayBuffer) => productService.importSalesPricesFromExcel(db, buf),
      importPurchasePricesFromExcel: (buf: ArrayBuffer) => productService.importPurchasePricesFromExcel(db, buf)
    },
    bankAccounts: {
      list: () => bankAccountService.list(db),
      get: (id: number) => bankAccountService.get(db, id),
      create: (input: any) => bankAccountService.create(db, input),
      update: (id: number, input: any) => bankAccountService.update(db, id, input),
      delete: (id: number) => bankAccountService.remove(db, id)
    },
    deliveries: {
      list: () => deliveryService.list(db),
      get: (id: number) => deliveryService.get(db, id),
      create: (input: any) => deliveryService.create(db, input),
      update: (id: number, input: any) => deliveryService.update(db, id, input),
      delete: (id: number) => deliveryService.remove(db, id),
      aggregateToInvoice: (ids: number[], opts: any) => deliveryService.aggregateToInvoice(db, ids, opts)
    },
    salesInvoices: {
      list: () => salesInvoiceService.list(db),
      get: (id: number) => salesInvoiceService.get(db, id),
      create: (input: any) => salesInvoiceService.create(db, input),
      update: (id: number, input: any) => salesInvoiceService.update(db, id, input),
      delete: (id: number) => salesInvoiceService.remove(db, id),
      generatePdf: async (id: number) => {
        const company = {
          name: (await settingsSvc.get(db, 'company_name')) ?? '',
          address: (await settingsSvc.get(db, 'company_address')) ?? '',
          phone: (await settingsSvc.get(db, 'company_phone')) ?? '',
          registered_invoice_no: (await settingsSvc.get(db, 'registered_invoice_no')) ?? ''
        };
        const buf = await salesInvoiceService.generatePdf(db, id, company);
        const outPath = path.join(pdfDir, `sales-invoice-${id}.pdf`);
        fs.writeFileSync(outPath, buf);
        shell.openPath(outPath);
        return outPath;
      }
    },
    purchaseInvoices: {
      list: () => purchaseInvoiceService.list(db),
      get: (id: number) => purchaseInvoiceService.get(db, id),
      create: (input: any) => purchaseInvoiceService.create(db, input),
      update: (id: number, input: any) => purchaseInvoiceService.update(db, id, input),
      delete: (id: number) => purchaseInvoiceService.remove(db, id),
      parsePdf: async (pdfBytes: ArrayBuffer) => {
        const apiKey = (await settingsSvc.get(db, 'gemini_api_key')) ?? '';
        return purchaseInvoiceService.parsePdfWithGemini(db, Buffer.from(pdfBytes), apiKey);
      },
      savePdfFile: async (pdfBytes: ArrayBuffer, invoiceId: number) => {
        const out = path.join(pdfDir, `purchase-invoice-${invoiceId}.pdf`);
        fs.writeFileSync(out, Buffer.from(pdfBytes));
        return out;
      }
    },
    payments: {
      list: () => paymentService.list(db),
      get: (id: number) => paymentService.get(db, id),
      create: (input: any) => paymentService.create(db, input),
      delete: (id: number) => paymentService.remove(db, id)
    },
    cashflow: {
      list: (filter: any) => cashflowService.list(db, filter ?? {}),
      create: (input: any) => cashflowService.create(db, input),
      update: (id: number, input: any) => cashflowService.update(db, id, input),
      delete: (id: number) => cashflowService.remove(db, id),
      getProjection: (from: string, to: string, bankId?: number | null) => cashflowService.getProjection(db, from, to, bankId)
    },
    arAging: {
      getReceivablesAsOf: (date: string) => arAgingService.getReceivablesAsOf(db, date)
    },
    apAging: {
      getPayablesAsOf: (date: string) => apAgingService.getPayablesAsOf(db, date)
    },
    inventory: {
      generateStocktakeExcel: async () => {
        const buf = await inventoryService.generateStocktakeExcel(db);
        const res = await dialog.showSaveDialog({
          title: '棚卸表を保存',
          defaultPath: `stocktake-${new Date().toISOString().slice(0, 10)}.xlsx`,
          filters: [{ name: 'Excel', extensions: ['xlsx'] }]
        });
        if (res.canceled || !res.filePath) return null;
        fs.writeFileSync(res.filePath, buf);
        return res.filePath;
      }
    },
    backup: {
      exportAll: async () => {
        const res = await dialog.showSaveDialog({
          title: 'バックアップを保存',
          defaultPath: `backup-${new Date().toISOString().slice(0, 10)}.zip`,
          filters: [{ name: 'Zip', extensions: ['zip'] }]
        });
        if (res.canceled || !res.filePath) return null;
        return backupService.exportAll(db, { dbPath, pdfDir }, res.filePath);
      },
      restoreFromZip: async () => {
        const res = await dialog.showOpenDialog({
          title: 'バックアップを選択',
          properties: ['openFile'],
          filters: [{ name: 'Zip', extensions: ['zip'] }]
        });
        if (res.canceled || !res.filePaths[0]) return null;
        await backupService.restoreFromZip(db, { dbPath, pdfDir }, res.filePaths[0]);
        return '復元が完了しました。アプリを再起動してください。';
      }
    },
    settings: {
      get: (key: string) => settingsSvc.get(db, key),
      set: (key: string, value: string) => settingsSvc.set(db, key, value),
      getAll: () => settingsSvc.getAll(db)
    },
    dashboard: {
      summary: async () => {
        const today = new Date();
        const start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
        const end = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
        const monthSales = db.$sqlite.prepare(`SELECT COALESCE(SUM(total_inc_tax),0) AS s FROM sales_invoices WHERE issue_date BETWEEN ? AND ? AND status != 'void'`).get(start, end) as { s: number };
        const asOf = today.toISOString().slice(0, 10);
        const ar = await arAgingService.getReceivablesAsOf(db, asOf);
        const ap = await apAgingService.getPayablesAsOf(db, asOf);
        const monthIn = db.$sqlite.prepare(`SELECT COALESCE(SUM(amount),0) AS s FROM cashflow_entries WHERE type='in' AND scheduled_date BETWEEN ? AND ?`).get(start, end) as { s: number };
        const monthOut = db.$sqlite.prepare(`SELECT COALESCE(SUM(amount),0) AS s FROM cashflow_entries WHERE type='out' AND scheduled_date BETWEEN ? AND ?`).get(start, end) as { s: number };
        return {
          monthSales: monthSales.s,
          arTotal: ar.rows.reduce((s, r) => s + r.outstanding, 0),
          apTotal: ap.rows.reduce((s, r) => s + r.outstanding, 0),
          monthIn: monthIn.s,
          monthOut: monthOut.s
        };
      }
    },
    pdf: {
      // exposed indirectly; salesInvoices.generatePdf is the main entry
    }
  };

  // Suppress unused import warnings
  void sales_invoices; void purchase_invoices; void sql;

  ipcMain.handle('rpc', async (_e, payload: { module: string; method: string; args: any[] }) => {
    const m = modules[payload.module];
    if (!m) throw new Error(`unknown module: ${payload.module}`);
    const fn = m[payload.method];
    if (!fn) throw new Error(`unknown method: ${payload.module}.${payload.method}`);
    try {
      return await fn(...(payload.args ?? []));
    } catch (e: any) {
      // re-throw as serializable
      const out: any = new Error(e?.message ?? String(e));
      out.code = e?.code;
      out.name = e?.name;
      throw out;
    }
  });
}
