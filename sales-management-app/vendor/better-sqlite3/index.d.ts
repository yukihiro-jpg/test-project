declare class Statement {
  all(...params: any[]): any[];
  get(...params: any[]): any;
  run(...params: any[]): { changes: number; lastInsertRowid: number | bigint };
  values(...params: any[]): any[][];
  raw(flag?: boolean): this;
  pluck(flag?: boolean): this;
  iterate(...params: any[]): IterableIterator<any>;
  columns(): any[];
  safeIntegers(flag?: boolean): this;
}

declare class Database {
  constructor(filename: string, options?: any);
  open: boolean;
  inTransaction: boolean;
  name: string;
  memory: boolean;
  readonly: boolean;
  prepare(sql: string): Statement;
  exec(sql: string): this;
  pragma(stmt: string, opts?: any): any;
  transaction<T extends (...args: any[]) => any>(fn: T): T & {
    default: T;
    deferred: T;
    immediate: T;
    exclusive: T;
  };
  close(): void;
  defaultSafeIntegers(flag?: boolean): this;
}

declare namespace Database {
  type Database = InstanceType<typeof Database>;
  type Statement = InstanceType<typeof Statement>;
}

export = Database;
