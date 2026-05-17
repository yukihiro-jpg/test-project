import Database from './sqlite-shim';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { migrate } from './migrate';

export type AppDb = BetterSQLite3Database<typeof schema> & { $sqlite: Database };

export function openDatabase(filePath: string): AppDb {
  const sqlite = new Database(filePath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  migrate(sqlite as any);
  const db = drizzle(sqlite as any, { schema }) as AppDb;
  db.$sqlite = sqlite;
  return db;
}

export { schema };
