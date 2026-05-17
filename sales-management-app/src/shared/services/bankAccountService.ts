import type { AppDb } from '../db/client';
import { bank_accounts } from '../db/schema';
import { eq } from 'drizzle-orm';
import type { BankAccount } from '../types';

export async function list(db: AppDb): Promise<BankAccount[]> {
  return db.select().from(bank_accounts).all() as BankAccount[];
}

export async function get(db: AppDb, id: number): Promise<BankAccount | undefined> {
  return db.select().from(bank_accounts).where(eq(bank_accounts.id, id)).get() as BankAccount | undefined;
}

export async function create(db: AppDb, input: Partial<BankAccount>): Promise<BankAccount> {
  if (input.is_default) {
    db.update(bank_accounts).set({ is_default: 0 }).run();
  }
  const r = db.insert(bank_accounts).values({
    name: input.name!,
    bank_name: input.bank_name ?? null,
    branch_name: input.branch_name ?? null,
    account_type: input.account_type ?? null,
    account_number: input.account_number ?? null,
    opening_balance: input.opening_balance ?? 0,
    opening_balance_date: input.opening_balance_date ?? null,
    is_default: input.is_default ?? 0
  }).returning().get();
  return r as BankAccount;
}

export async function update(db: AppDb, id: number, input: Partial<BankAccount>): Promise<BankAccount> {
  if (input.is_default) {
    db.update(bank_accounts).set({ is_default: 0 }).run();
  }
  const patch: any = { ...input };
  delete patch.id;
  db.update(bank_accounts).set(patch).where(eq(bank_accounts.id, id)).run();
  return (await get(db, id))!;
}

export async function remove(db: AppDb, id: number): Promise<void> {
  db.delete(bank_accounts).where(eq(bank_accounts.id, id)).run();
}
