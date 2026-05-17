import type { AppDb } from '../db/client';
import { cashflow_entries, bank_accounts } from '../db/schema';
import { and, eq, gte, lte } from 'drizzle-orm';
import type { CashflowEntry, BankAccount } from '../types';

export interface CashflowFilter {
  from?: string;
  to?: string;
  bank_account_id?: number | null;
}

export async function list(db: AppDb, f: CashflowFilter = {}): Promise<CashflowEntry[]> {
  const conds: any[] = [];
  if (f.from) conds.push(gte(cashflow_entries.scheduled_date, f.from));
  if (f.to) conds.push(lte(cashflow_entries.scheduled_date, f.to));
  if (f.bank_account_id != null) conds.push(eq(cashflow_entries.bank_account_id, f.bank_account_id));
  const q = conds.length ? db.select().from(cashflow_entries).where(and(...conds)) : db.select().from(cashflow_entries);
  return q.all() as CashflowEntry[];
}

export async function create(db: AppDb, input: Partial<CashflowEntry>): Promise<CashflowEntry> {
  const r = db.insert(cashflow_entries).values({
    type: input.type!,
    scheduled_date: input.scheduled_date!,
    actual_date: input.actual_date ?? null,
    amount: input.amount ?? 0,
    bank_account_id: input.bank_account_id ?? null,
    category: input.category ?? null,
    source_type: 'manual',
    source_id: null,
    memo: input.memo ?? null,
    status: input.status ?? 'scheduled'
  }).returning().get();
  return r as CashflowEntry;
}

export async function update(db: AppDb, id: number, input: Partial<CashflowEntry>): Promise<CashflowEntry> {
  const cur = db.select().from(cashflow_entries).where(eq(cashflow_entries.id, id)).get() as CashflowEntry;
  if (cur.source_type !== 'manual') throw new Error('自動生成エントリは編集できません');
  const patch: any = { ...input };
  delete patch.id;
  patch.updated_at = new Date().toISOString();
  db.update(cashflow_entries).set(patch).where(eq(cashflow_entries.id, id)).run();
  return db.select().from(cashflow_entries).where(eq(cashflow_entries.id, id)).get() as CashflowEntry;
}

export async function remove(db: AppDb, id: number): Promise<void> {
  const cur = db.select().from(cashflow_entries).where(eq(cashflow_entries.id, id)).get() as CashflowEntry;
  if (!cur) return;
  if (cur.source_type !== 'manual') throw new Error('自動生成エントリは削除できません');
  db.delete(cashflow_entries).where(eq(cashflow_entries.id, id)).run();
}

export async function getProjection(db: AppDb, fromDate: string, toDate: string, bankAccountId?: number | null) {
  const accounts = db.select().from(bank_accounts).all() as BankAccount[];
  const accFilter = bankAccountId != null ? accounts.filter(a => a.id === bankAccountId) : accounts;
  const openingBalance = accFilter.reduce((s, a) => s + (a.opening_balance || 0), 0);

  const entries = await list(db, { from: fromDate, to: toDate, bank_account_id: bankAccountId ?? undefined });
  const byDate = new Map<string, { in: number; out: number }>();
  for (const e of entries) {
    const d = e.scheduled_date;
    const cur = byDate.get(d) ?? { in: 0, out: 0 };
    if (e.type === 'in') cur.in += e.amount; else cur.out += e.amount;
    byDate.set(d, cur);
  }
  const dates = Array.from(byDate.keys()).sort();
  let balance = openingBalance;
  return dates.map(d => {
    const v = byDate.get(d)!;
    balance += v.in - v.out;
    return { date: d, in: v.in, out: v.out, balance };
  });
}
