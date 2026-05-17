// Node.js 22+ 内蔵 node:sqlite を better-sqlite3 互換 API でラップする薄いシム。
// Drizzle の drizzle-orm/better-sqlite3 ドライバはこの API をダックタイピングで使うため、
// このシムを通して透過的に動作する。ネイティブビルド不要。
import { DatabaseSync, type StatementSync } from 'node:sqlite';

type Params = readonly any[];

function flattenParams(params: any[]): any[] {
  // better-sqlite3 は stmt.all(p1, p2) でも stmt.all([p1, p2]) でも受け付ける
  if (params.length === 1 && Array.isArray(params[0])) return params[0];
  if (params.length === 1 && params[0] !== null && typeof params[0] === 'object' && !Array.isArray(params[0])) {
    // 名前付きパラメータ {name: value}
    return [params[0]];
  }
  return params;
}

class StatementWrapper {
  private rawMode = false;
  constructor(private stmt: StatementSync) {}

  all(...params: any[]): any[] {
    const p = flattenParams(params);
    const rows = this.stmt.all(...(p as Params)) as any[];
    if (this.rawMode) return rows.map((r) => Object.values(r));
    return rows;
  }

  get(...params: any[]): any {
    const p = flattenParams(params);
    const r = this.stmt.get(...(p as Params));
    if (this.rawMode && r) return Object.values(r as object);
    return r;
  }

  run(...params: any[]): { changes: number; lastInsertRowid: number | bigint } {
    const p = flattenParams(params);
    const r = this.stmt.run(...(p as Params));
    return { changes: Number(r.changes), lastInsertRowid: r.lastInsertRowid };
  }

  values(...params: any[]): any[][] {
    const rows = this.all(...params);
    return rows.map((r: any) => (Array.isArray(r) ? r : Object.values(r)));
  }

  raw(flag: boolean = true): this {
    this.rawMode = flag;
    return this;
  }

  iterate(...params: any[]): IterableIterator<any> {
    const p = flattenParams(params);
    return this.stmt.iterate(...(p as Params)) as any;
  }

  pluck(_flag: boolean = true): this {
    // 未使用だが互換のためメソッド存在のみ
    return this;
  }
}

export class Database {
  private inner: DatabaseSync;
  open: boolean = true;

  constructor(path: string, _options?: any) {
    this.inner = new DatabaseSync(path);
  }

  prepare(sql: string): StatementWrapper {
    return new StatementWrapper(this.inner.prepare(sql));
  }

  exec(sql: string): this {
    this.inner.exec(sql);
    return this;
  }

  pragma(stmt: string, _opts?: { simple?: boolean }): any {
    try {
      const s = this.inner.prepare(`PRAGMA ${stmt}`);
      return s.all();
    } catch {
      this.inner.exec(`PRAGMA ${stmt}`);
      return undefined;
    }
  }

  transaction<T extends (...args: any[]) => any>(fn: T): T & {
    default: T;
    deferred: T;
    immediate: T;
    exclusive: T;
  } {
    const inner = this.inner;
    const wrapped: any = (...args: any[]) => {
      inner.exec('BEGIN');
      try {
        const r = fn(...args);
        inner.exec('COMMIT');
        return r;
      } catch (e) {
        try {
          inner.exec('ROLLBACK');
        } catch {}
        throw e;
      }
    };
    wrapped.default = wrapped;
    wrapped.deferred = wrapped;
    wrapped.immediate = wrapped;
    wrapped.exclusive = wrapped;
    return wrapped;
  }

  close(): void {
    this.inner.close();
    this.open = false;
  }
}

export default Database;
