// better-sqlite3 互換スタブ。実体は Node.js 22+ 標準の node:sqlite を使用。
// drizzle-orm/better-sqlite3 から require されても通り、ネイティブビルドは不要。
const { DatabaseSync } = require('node:sqlite');

function flattenParams(params) {
  if (params.length === 1 && Array.isArray(params[0])) return params[0];
  return params;
}

class Statement {
  constructor(stmt) {
    this._stmt = stmt;
    this._raw = false;
  }
  all(...params) {
    const p = flattenParams(params);
    const rows = this._stmt.all(...p);
    return this._raw ? rows.map((r) => Object.values(r)) : rows;
  }
  get(...params) {
    const p = flattenParams(params);
    const r = this._stmt.get(...p);
    return this._raw && r ? Object.values(r) : r;
  }
  run(...params) {
    const p = flattenParams(params);
    const r = this._stmt.run(...p);
    return { changes: Number(r.changes), lastInsertRowid: r.lastInsertRowid };
  }
  values(...params) {
    return this.all(...params).map((r) => (Array.isArray(r) ? r : Object.values(r)));
  }
  raw(flag = true) {
    this._raw = flag;
    return this;
  }
  pluck() {
    return this;
  }
  expand() {
    return this;
  }
  bind() {
    return this;
  }
  safeIntegers() {
    return this;
  }
  iterate(...params) {
    const p = flattenParams(params);
    return this._stmt.iterate(...p);
  }
  columns() {
    return [];
  }
}

class Database {
  constructor(filename, _options) {
    this._db = new DatabaseSync(filename);
    this.open = true;
    this.inTransaction = false;
    this.name = filename;
    this.memory = filename === ':memory:';
    this.readonly = false;
  }
  prepare(sql) {
    return new Statement(this._db.prepare(sql));
  }
  exec(sql) {
    this._db.exec(sql);
    return this;
  }
  pragma(stmt, _opts) {
    try {
      return this._db.prepare(`PRAGMA ${stmt}`).all();
    } catch {
      try {
        this._db.exec(`PRAGMA ${stmt}`);
      } catch {}
      return undefined;
    }
  }
  transaction(fn) {
    const db = this._db;
    const self = this;
    const wrap = (...args) => {
      db.exec('BEGIN');
      self.inTransaction = true;
      try {
        const r = fn(...args);
        db.exec('COMMIT');
        return r;
      } catch (e) {
        try {
          db.exec('ROLLBACK');
        } catch {}
        throw e;
      } finally {
        self.inTransaction = false;
      }
    };
    wrap.default = wrap;
    wrap.deferred = wrap;
    wrap.immediate = wrap;
    wrap.exclusive = wrap;
    return wrap;
  }
  function() {
    return this;
  }
  aggregate() {
    return this;
  }
  loadExtension() {
    throw new Error('loadExtension is not supported by the node:sqlite stub');
  }
  close() {
    this._db.close();
    this.open = false;
  }
  defaultSafeIntegers() {
    return this;
  }
  unsafeMode() {
    return this;
  }
  serialize() {
    throw new Error('serialize is not supported by the node:sqlite stub');
  }
}

module.exports = Database;
module.exports.default = Database;
module.exports.Database = Database;
