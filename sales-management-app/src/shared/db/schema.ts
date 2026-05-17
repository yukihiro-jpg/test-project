import { sqliteTable, integer, text, real } from 'drizzle-orm/sqlite-core';
import { relations, sql } from 'drizzle-orm';

export const customers = sqliteTable('customers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  name_kana: text('name_kana'),
  postal_code: text('postal_code'),
  address: text('address'),
  phone: text('phone'),
  email: text('email'),
  registered_invoice_no: text('registered_invoice_no'),
  payment_terms_days: integer('payment_terms_days'),
  closing_day: integer('closing_day'),
  payment_day: integer('payment_day'),
  default_bank_account_id: integer('default_bank_account_id'),
  notes: text('notes'),
  created_at: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
  updated_at: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`)
});

export const suppliers = sqliteTable('suppliers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  name_kana: text('name_kana'),
  postal_code: text('postal_code'),
  address: text('address'),
  phone: text('phone'),
  email: text('email'),
  registered_invoice_no: text('registered_invoice_no'),
  payment_terms_days: integer('payment_terms_days'),
  closing_day: integer('closing_day'),
  payment_day: integer('payment_day'),
  default_bank_account_id: integer('default_bank_account_id'),
  notes: text('notes'),
  created_at: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
  updated_at: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`)
});

export const products = sqliteTable('products', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  unit: text('unit'),
  sales_unit_price: integer('sales_unit_price').notNull().default(0),
  purchase_unit_price: integer('purchase_unit_price').notNull().default(0),
  tax_rate: integer('tax_rate').notNull().default(10),
  category: text('category'),
  notes: text('notes'),
  created_at: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
  updated_at: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`)
});

export const bank_accounts = sqliteTable('bank_accounts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  bank_name: text('bank_name'),
  branch_name: text('branch_name'),
  account_type: text('account_type'),
  account_number: text('account_number'),
  opening_balance: integer('opening_balance').notNull().default(0),
  opening_balance_date: text('opening_balance_date'),
  is_default: integer('is_default').notNull().default(0)
});

export const deliveries = sqliteTable('deliveries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  customer_id: integer('customer_id').notNull(),
  delivery_date: text('delivery_date').notNull(),
  notes: text('notes'),
  status: text('status').notNull().default('pending'),
  invoice_id: integer('invoice_id'),
  created_at: text('created_at').default(sql`(CURRENT_TIMESTAMP)`)
});

export const delivery_lines = sqliteTable('delivery_lines', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  delivery_id: integer('delivery_id').notNull(),
  product_id: integer('product_id'),
  product_name_snapshot: text('product_name_snapshot').notNull(),
  quantity: real('quantity').notNull().default(0),
  unit_price: integer('unit_price').notNull().default(0),
  tax_rate: integer('tax_rate').notNull().default(10),
  amount_ex_tax: integer('amount_ex_tax').notNull().default(0)
});

export const sales_invoices = sqliteTable('sales_invoices', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  invoice_no: text('invoice_no').notNull().unique(),
  customer_id: integer('customer_id').notNull(),
  issue_date: text('issue_date').notNull(),
  due_date: text('due_date').notNull(),
  subtotal_ex_tax: integer('subtotal_ex_tax').notNull().default(0),
  tax_amount: integer('tax_amount').notNull().default(0),
  total_inc_tax: integer('total_inc_tax').notNull().default(0),
  status: text('status').notNull().default('draft'),
  notes: text('notes'),
  pdf_path: text('pdf_path'),
  registered_invoice_no_snapshot: text('registered_invoice_no_snapshot'),
  created_at: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
  updated_at: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`)
});

export const sales_invoice_lines = sqliteTable('sales_invoice_lines', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  invoice_id: integer('invoice_id').notNull(),
  delivery_line_id: integer('delivery_line_id'),
  product_id: integer('product_id'),
  description: text('description').notNull(),
  quantity: real('quantity').notNull().default(0),
  unit_price: integer('unit_price').notNull().default(0),
  tax_rate: integer('tax_rate').notNull().default(10),
  amount_ex_tax: integer('amount_ex_tax').notNull().default(0)
});

export const purchase_invoices = sqliteTable('purchase_invoices', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  invoice_no: text('invoice_no').notNull(),
  supplier_id: integer('supplier_id').notNull(),
  issue_date: text('issue_date').notNull(),
  due_date: text('due_date').notNull(),
  subtotal_ex_tax: integer('subtotal_ex_tax').notNull().default(0),
  tax_amount: integer('tax_amount').notNull().default(0),
  total_inc_tax: integer('total_inc_tax').notNull().default(0),
  status: text('status').notNull().default('draft'),
  notes: text('notes'),
  source_pdf_path: text('source_pdf_path'),
  created_at: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
  updated_at: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`)
});

export const purchase_invoice_lines = sqliteTable('purchase_invoice_lines', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  invoice_id: integer('invoice_id').notNull(),
  product_id: integer('product_id'),
  description: text('description').notNull(),
  quantity: real('quantity').notNull().default(0),
  unit_price: integer('unit_price').notNull().default(0),
  tax_rate: integer('tax_rate').notNull().default(10),
  amount_ex_tax: integer('amount_ex_tax').notNull().default(0),
  purchase_date: text('purchase_date')
});

export const payments = sqliteTable('payments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  type: text('type').notNull(),
  date: text('date').notNull(),
  amount: integer('amount').notNull().default(0),
  bank_account_id: integer('bank_account_id'),
  counterparty_type: text('counterparty_type'),
  counterparty_id: integer('counterparty_id'),
  memo: text('memo'),
  created_at: text('created_at').default(sql`(CURRENT_TIMESTAMP)`)
});

export const payment_allocations = sqliteTable('payment_allocations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  payment_id: integer('payment_id').notNull(),
  invoice_type: text('invoice_type').notNull(),
  invoice_id: integer('invoice_id').notNull(),
  allocated_amount: integer('allocated_amount').notNull().default(0)
});

export const cashflow_entries = sqliteTable('cashflow_entries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  type: text('type').notNull(),
  scheduled_date: text('scheduled_date').notNull(),
  actual_date: text('actual_date'),
  amount: integer('amount').notNull().default(0),
  bank_account_id: integer('bank_account_id'),
  category: text('category'),
  source_type: text('source_type').notNull().default('manual'),
  source_id: integer('source_id'),
  memo: text('memo'),
  status: text('status').notNull().default('scheduled'),
  created_at: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
  updated_at: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`)
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value')
});

export const audit_log = sqliteTable('audit_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  timestamp: text('timestamp').default(sql`(CURRENT_TIMESTAMP)`),
  entity_type: text('entity_type').notNull(),
  entity_id: integer('entity_id'),
  action: text('action').notNull(),
  before_json: text('before_json'),
  after_json: text('after_json')
});

export const customersRelations = relations(customers, ({ many }) => ({
  deliveries: many(deliveries),
  invoices: many(sales_invoices)
}));

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  invoices: many(purchase_invoices)
}));

export const deliveriesRelations = relations(deliveries, ({ many, one }) => ({
  lines: many(delivery_lines),
  customer: one(customers, { fields: [deliveries.customer_id], references: [customers.id] })
}));

export const deliveryLinesRelations = relations(delivery_lines, ({ one }) => ({
  delivery: one(deliveries, { fields: [delivery_lines.delivery_id], references: [deliveries.id] })
}));

export const salesInvoicesRelations = relations(sales_invoices, ({ many, one }) => ({
  lines: many(sales_invoice_lines),
  customer: one(customers, { fields: [sales_invoices.customer_id], references: [customers.id] })
}));

export const salesInvoiceLinesRelations = relations(sales_invoice_lines, ({ one }) => ({
  invoice: one(sales_invoices, { fields: [sales_invoice_lines.invoice_id], references: [sales_invoices.id] })
}));

export const purchaseInvoicesRelations = relations(purchase_invoices, ({ many, one }) => ({
  lines: many(purchase_invoice_lines),
  supplier: one(suppliers, { fields: [purchase_invoices.supplier_id], references: [suppliers.id] })
}));

export const purchaseInvoiceLinesRelations = relations(purchase_invoice_lines, ({ one }) => ({
  invoice: one(purchase_invoices, { fields: [purchase_invoice_lines.invoice_id], references: [purchase_invoices.id] })
}));

export const paymentsRelations = relations(payments, ({ many }) => ({
  allocations: many(payment_allocations)
}));

export const paymentAllocationsRelations = relations(payment_allocations, ({ one }) => ({
  payment: one(payments, { fields: [payment_allocations.payment_id], references: [payments.id] })
}));
