import type { AppDb } from '../db/client';
import { settings } from '../db/schema';
import { eq } from 'drizzle-orm';

const ENCRYPTED_KEYS = new Set(['gemini_api_key']);

export interface SafeStorageLike {
  isEncryptionAvailable(): boolean;
  encryptString(s: string): Buffer;
  decryptString(b: Buffer): string;
}

export function makeSettingsService(safeStorage?: SafeStorageLike) {
  function encode(key: string, value: string): string {
    if (ENCRYPTED_KEYS.has(key) && safeStorage?.isEncryptionAvailable()) {
      return 'enc:' + safeStorage.encryptString(value).toString('base64');
    }
    return value;
  }
  function decode(key: string, stored: string | null): string | null {
    if (stored == null) return null;
    if (ENCRYPTED_KEYS.has(key) && stored.startsWith('enc:') && safeStorage) {
      try {
        return safeStorage.decryptString(Buffer.from(stored.slice(4), 'base64'));
      } catch {
        return null;
      }
    }
    return stored;
  }

  return {
    async get(db: AppDb, key: string): Promise<string | null> {
      const row = db.select().from(settings).where(eq(settings.key, key)).get() as { key: string; value: string | null } | undefined;
      return row ? decode(key, row.value) : null;
    },
    async set(db: AppDb, key: string, value: string): Promise<void> {
      const stored = encode(key, value);
      const existing = db.select().from(settings).where(eq(settings.key, key)).get();
      if (existing) {
        db.update(settings).set({ value: stored }).where(eq(settings.key, key)).run();
      } else {
        db.insert(settings).values({ key, value: stored }).run();
      }
    },
    async getAll(db: AppDb): Promise<Record<string, string | null>> {
      const rows = db.select().from(settings).all() as Array<{ key: string; value: string | null }>;
      const out: Record<string, string | null> = {};
      for (const r of rows) {
        // Don't expose encrypted secret in plaintext to UI by default; mark as set
        if (ENCRYPTED_KEYS.has(r.key)) {
          out[r.key] = r.value ? '***SET***' : null;
        } else {
          out[r.key] = decode(r.key, r.value);
        }
      }
      return out;
    }
  };
}
