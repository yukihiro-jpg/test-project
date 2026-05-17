import BetterSqlite3 from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { migrate } from './migrate';

export type AppDb = BetterSQLite3Database<typeof schema> & { $sqlite: BetterSqlite3.Database };

export function openDatabase(filePath: string): AppDb {
  const sqlite = new BetterSqlite3(filePath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  migrate(sqlite);
  const db = drizzle(sqlite, { schema }) as AppDb;
  db.$sqlite = sqlite;
  return db;
}

export { schema };
