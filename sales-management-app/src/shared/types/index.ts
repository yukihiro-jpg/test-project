export type ID = number;

export interface Customer {
  id: ID;
  code: string;
  name: string;
  name_kana?: string | null;
  postal_code?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  registered_invoice_no?: string | null;
  payment_terms_days?: number | null;
  closing_day?: number | null;
  payment_day?: number | null;
  default_bank_account_id?: number | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export type Supplier = Customer;

export interface Product {
  id: ID;
  code: string;
  name: string;
  unit?: string | null;
  sales_unit_price: number;
  purchase_unit_price: number;
  tax_rate: number;
  category?: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface BankAccount {
  id: ID;
  name: string;
  bank_name?: string | null;
  branch_name?: string | null;
  account_type?: string | null;
  account_number?: string | null;
  opening_balance: number;
  opening_balance_date?: string | null;
  is_default: number;
}

export interface DeliveryLine {
  id?: ID;
  delivery_id?: ID;
  product_id?: number | null;
  product_name_snapshot: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  amount_ex_tax: number;
}

export interface Delivery {
  id: ID;
  customer_id: ID;
  delivery_date: string;
  notes?: string | null;
  status: 'pending' | 'invoiced';
  invoice_id?: number | null;
  lines?: DeliveryLine[];
  created_at?: string | null;
}

export type InvoiceStatus = 'draft' | 'issued' | 'partially_paid' | 'paid' | 'void';

export interface SalesInvoiceLine {
  id?: ID;
  invoice_id?: ID;
  delivery_line_id?: number | null;
  product_id?: number | null;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  amount_ex_tax: number;
}

export interface SalesInvoice {
  id: ID;
  invoice_no: string;
  customer_id: ID;
  issue_date: string;
  due_date: string;
  subtotal_ex_tax: number;
  tax_amount: number;
  total_inc_tax: number;
  status: InvoiceStatus;
  notes?: string | null;
  pdf_path?: string | null;
  registered_invoice_no_snapshot?: string | null;
  lines?: SalesInvoiceLine[];
  created_at?: string | null;
  updated_at?: string | null;
}

export interface PurchaseInvoiceLine {
  id?: ID;
  invoice_id?: ID;
  product_id?: number | null;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  amount_ex_tax: number;
  purchase_date?: string | null;
}

export interface PurchaseInvoice {
  id: ID;
  invoice_no: string;
  supplier_id: ID;
  issue_date: string;
  due_date: string;
  subtotal_ex_tax: number;
  tax_amount: number;
  total_inc_tax: number;
  status: InvoiceStatus;
  notes?: string | null;
  source_pdf_path?: string | null;
  lines?: PurchaseInvoiceLine[];
  created_at?: string | null;
  updated_at?: string | null;
}

export interface PaymentAllocation {
  id?: ID;
  payment_id?: ID;
  invoice_type: 'sales' | 'purchase';
  invoice_id: ID;
  allocated_amount: number;
  adjustment_amount?: number;
  adjustment_reason?: string | null;
}

export interface InvoiceOffset {
  id?: ID;
  date: string;
  sales_invoice_id: ID;
  purchase_invoice_id: ID;
  amount: number;
  memo?: string | null;
  created_at?: string | null;
}

export interface Payment {
  id: ID;
  type: 'receipt' | 'payment';
  date: string;
  amount: number;
  bank_account_id?: number | null;
  counterparty_type?: 'customer' | 'supplier' | 'other' | null;
  counterparty_id?: number | null;
  memo?: string | null;
  allocations?: PaymentAllocation[];
  created_at?: string | null;
}

export interface CashflowEntry {
  id: ID;
  type: 'in' | 'out';
  scheduled_date: string;
  actual_date?: string | null;
  amount: number;
  bank_account_id?: number | null;
  category?: string | null;
  source_type: 'sales_invoice' | 'purchase_invoice' | 'manual';
  source_id?: number | null;
  memo?: string | null;
  status: 'scheduled' | 'completed' | 'cancelled';
}

export interface ParsedPurchaseInvoice {
  supplier_name: string;
  invoice_no: string;
  issue_date: string;
  due_date?: string;
  lines: Array<{
    product_name: string;
    quantity: number;
    unit_price: number;
    purchase_date?: string;
    tax_rate: number;
  }>;
}

export class UserActionableError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'UserActionableError';
    this.code = code;
  }
}
