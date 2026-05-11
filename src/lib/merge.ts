import { dateDigits } from "./date";
import type { TransactionRow } from "../types";

export interface MergeInputs {
  existingRawRows: string[][];
  existingRows: TransactionRow[];
  incomingRawRows: string[][];
  incomingRows: TransactionRow[];
}

export interface MergeResult {
  rawRows: string[][];
  rows: TransactionRow[];
  addedCount: number;
  duplicateCount: number;
  totalAfter: number;
}

function dedupKey(row: TransactionRow): string {
  const d = dateDigits(row.date);
  const balance = (row.balance ?? "").replace(/[\s,¥￥円]/g, "").trim();
  return `${d}__${row.amount}__${balance}`;
}

export function mergeTransactions({
  existingRawRows,
  existingRows,
  incomingRawRows,
  incomingRows,
}: MergeInputs): MergeResult {
  const seen = new Set(existingRows.map(dedupKey));

  const merged: { raw: string[]; row: TransactionRow }[] = existingRows.map(
    (row, idx) => ({
      raw: existingRawRows[idx] ?? [],
      row,
    }),
  );

  let duplicateCount = 0;
  let addedCount = 0;
  for (let i = 0; i < incomingRows.length; i++) {
    const key = dedupKey(incomingRows[i]);
    if (seen.has(key)) {
      duplicateCount++;
      continue;
    }
    seen.add(key);
    addedCount++;
    merged.push({
      raw: incomingRawRows[i] ?? [],
      row: incomingRows[i],
    });
  }

  merged.sort((a, b) => {
    const da = dateDigits(a.row.date);
    const db = dateDigits(b.row.date);
    if (da === db) return 0;
    return da < db ? -1 : 1;
  });

  return {
    rawRows: merged.map((m) => m.raw),
    rows: merged.map((m, idx) => ({ ...m.row, id: idx })),
    addedCount,
    duplicateCount,
    totalAfter: merged.length,
  };
}
