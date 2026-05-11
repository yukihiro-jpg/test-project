import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type {
  AmountStyle,
  BankInfo,
  ColumnMapping,
  ImportedCsv,
  TransactionRow,
} from "../types";

const DB_NAME = "csv-tool";
const DB_VERSION = 1;

export interface BankTemplate {
  id: string;
  name: string;
  headerSignature: string;
  columnMap: ColumnMapping;
  amountStyle: AmountStyle;
  createdAt: number;
  lastUsedAt: number;
}

export interface StoredImported {
  fileName: string;
  encoding: string;
  headers: string[];
  rawRows: string[][];
  originalBytes: ArrayBuffer | null;
}

export interface ImportSession {
  id: string;
  bankInfo: BankInfo;
  mapping: ColumnMapping;
  imported: StoredImported;
  rows: TransactionRow[];
  selectedRow: number;
  status: "in_progress" | "completed";
  createdAt: number;
  updatedAt: number;
}

export interface CounterpartyRecord {
  id: string;
  amount: number;
  dayOfMonth: number;
  summary: string;
  hitCount: number;
  lastUsedAt: number;
}

interface CsvToolDB extends DBSchema {
  templates: {
    key: string;
    value: BankTemplate;
    indexes: { "by-signature": string };
  };
  sessions: {
    key: string;
    value: ImportSession;
    indexes: { "by-updated": number };
  };
  counterparties: {
    key: string;
    value: CounterpartyRecord;
    indexes: { "by-amount-day": [number, number] };
  };
}

let dbPromise: Promise<IDBPDatabase<CsvToolDB>> | null = null;

function getDb(): Promise<IDBPDatabase<CsvToolDB>> {
  if (!dbPromise) {
    dbPromise = openDB<CsvToolDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("templates")) {
          const store = db.createObjectStore("templates", { keyPath: "id" });
          store.createIndex("by-signature", "headerSignature", {
            unique: false,
          });
        }
        if (!db.objectStoreNames.contains("sessions")) {
          const store = db.createObjectStore("sessions", { keyPath: "id" });
          store.createIndex("by-updated", "updatedAt");
        }
        if (!db.objectStoreNames.contains("counterparties")) {
          const store = db.createObjectStore("counterparties", {
            keyPath: "id",
          });
          store.createIndex("by-amount-day", ["amount", "dayOfMonth"]);
        }
      },
    });
  }
  return dbPromise;
}

export function headerSignature(headers: string[]): string {
  return headers.map((h) => h.trim()).join("|");
}

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export async function findTemplateBySignature(
  headers: string[],
): Promise<BankTemplate | undefined> {
  const db = await getDb();
  const sig = headerSignature(headers);
  return db.getFromIndex("templates", "by-signature", sig);
}

export async function upsertTemplate(
  bankName: string,
  headers: string[],
  mapping: ColumnMapping,
): Promise<BankTemplate> {
  const db = await getDb();
  const sig = headerSignature(headers);
  const now = Date.now();
  const existing = await db.getFromIndex("templates", "by-signature", sig);
  const tpl: BankTemplate = existing
    ? {
        ...existing,
        name: bankName || existing.name,
        columnMap: mapping,
        amountStyle: mapping.amountStyle,
        lastUsedAt: now,
      }
    : {
        id: uid("tpl"),
        name: bankName,
        headerSignature: sig,
        columnMap: mapping,
        amountStyle: mapping.amountStyle,
        createdAt: now,
        lastUsedAt: now,
      };
  await db.put("templates", tpl);
  return tpl;
}

export async function listTemplates(): Promise<BankTemplate[]> {
  const db = await getDb();
  return db.getAll("templates");
}

export async function deleteTemplate(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("templates", id);
}

export interface SessionParams {
  bankInfo: BankInfo;
  mapping: ColumnMapping;
  imported: ImportedCsv;
  rows: TransactionRow[];
  selectedRow: number;
  originalBytes?: ArrayBuffer | null;
}

export async function saveSession(
  existingId: string | null,
  params: SessionParams,
): Promise<ImportSession> {
  const db = await getDb();
  const now = Date.now();
  const id = existingId ?? uid("ses");
  const previous = existingId ? await db.get("sessions", existingId) : null;

  const session: ImportSession = {
    id,
    bankInfo: params.bankInfo,
    mapping: params.mapping,
    imported: {
      fileName: params.imported.fileName,
      encoding: params.imported.encoding,
      headers: params.imported.headers,
      rawRows: params.imported.rawRows,
      originalBytes:
        params.originalBytes ?? previous?.imported.originalBytes ?? null,
    },
    rows: params.rows,
    selectedRow: params.selectedRow,
    status: "in_progress",
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
  };
  await db.put("sessions", session);
  return session;
}

export async function markSessionCompleted(id: string): Promise<void> {
  const db = await getDb();
  const session = await db.get("sessions", id);
  if (!session) return;
  session.status = "completed";
  session.updatedAt = Date.now();
  await db.put("sessions", session);
}

export async function listSessions(): Promise<ImportSession[]> {
  const db = await getDb();
  const all = await db.getAll("sessions");
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getSession(
  id: string,
): Promise<ImportSession | undefined> {
  const db = await getDb();
  return db.get("sessions", id);
}

export async function findInProgressByBankAccount(
  bankName: string,
  accountName: string,
): Promise<ImportSession | undefined> {
  const bk = bankName.trim();
  const ac = accountName.trim();
  if (!bk) return undefined;
  const db = await getDb();
  const all = await db.getAll("sessions");
  return all.find(
    (s) =>
      s.status === "in_progress" &&
      s.bankInfo.bankName.trim() === bk &&
      s.bankInfo.accountName.trim() === ac,
  );
}

export async function deleteSession(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("sessions", id);
}

function counterpartyKey(amount: number, dayOfMonth: number): string {
  return `${amount}__${dayOfMonth}`;
}

function dayOfMonthFromDate(date: string): number {
  const digits = date.replace(/\D/g, "");
  if (digits.length >= 8) {
    return Number(digits.slice(6, 8));
  }
  const m = date.match(/(\d{1,2})\s*$/);
  return m ? Number(m[1]) : 0;
}

export async function recordCounterparty(
  amount: number,
  date: string,
  summary: string,
): Promise<void> {
  const trimmed = summary.trim();
  if (!trimmed) return;
  const day = dayOfMonthFromDate(date);
  if (!day) return;
  const db = await getDb();
  const id = `${counterpartyKey(amount, day)}__${trimmed}`;
  const existing = await db.get("counterparties", id);
  const now = Date.now();
  if (existing) {
    existing.hitCount += 1;
    existing.lastUsedAt = now;
    await db.put("counterparties", existing);
  } else {
    await db.put("counterparties", {
      id,
      amount,
      dayOfMonth: day,
      summary: trimmed,
      hitCount: 1,
      lastUsedAt: now,
    });
  }
}

export async function suggestCounterparties(
  amount: number,
  date: string,
  limit = 5,
): Promise<CounterpartyRecord[]> {
  const day = dayOfMonthFromDate(date);
  if (!day) return [];
  const db = await getDb();
  const results = await db.getAllFromIndex(
    "counterparties",
    "by-amount-day",
    IDBKeyRange.only([amount, day]),
  );
  return results
    .sort((a, b) => b.hitCount - a.hitCount || b.lastUsedAt - a.lastUsedAt)
    .slice(0, limit);
}

export async function listCounterparties(): Promise<CounterpartyRecord[]> {
  const db = await getDb();
  const all = await db.getAll("counterparties");
  return all.sort(
    (a, b) => b.hitCount - a.hitCount || b.lastUsedAt - a.lastUsedAt,
  );
}

export async function deleteCounterparty(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("counterparties", id);
}

export async function clearAllData(): Promise<void> {
  const db = await getDb();
  await Promise.all([
    db.clear("templates"),
    db.clear("sessions"),
    db.clear("counterparties"),
  ]);
}
