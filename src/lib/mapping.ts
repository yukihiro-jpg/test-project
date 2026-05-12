import type { ColumnMapping, ImportedCsv, TransactionRow } from "../types";

function parseAmountValue(raw: string): number {
  if (!raw) return 0;
  const cleaned = raw
    .replace(/[\s,¥￥円]/g, "")
    .replace(/[△▲−ー]/g, "-")
    .trim();
  if (cleaned === "" || cleaned === "-") return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function needsReview(summary: string): boolean {
  return summary.trim() === "";
}

function joinSummary(row: string[], indices: number[]): string {
  const parts = indices
    .map((idx) => (row[idx] ?? "").toString().trim())
    .filter((s) => s !== "");
  return parts.join(" ");
}

export function applyMapping(
  imported: ImportedCsv,
  mapping: ColumnMapping,
): TransactionRow[] {
  return imported.rawRows.map((row, idx) => {
    const date = (row[mapping.date] ?? "").toString().trim();
    const original = joinSummary(row, mapping.summary);
    const balance =
      mapping.balance !== null ? (row[mapping.balance] ?? "").toString() : "";

    let amount = 0;
    if (mapping.amountStyle === "single" && mapping.amount !== null) {
      amount = parseAmountValue(row[mapping.amount] ?? "");
    } else if (mapping.amountStyle === "split") {
      const inc =
        mapping.incoming !== null
          ? parseAmountValue(row[mapping.incoming] ?? "")
          : 0;
      const out =
        mapping.outgoing !== null
          ? parseAmountValue(row[mapping.outgoing] ?? "")
          : 0;
      amount = inc - out;
    }

    return {
      id: idx,
      date,
      originalSummary: original,
      editedSummary: original,
      amount,
      balance,
      needsReview: needsReview(original),
    };
  });
}

export function countUnreviewed(rows: TransactionRow[]): number {
  let count = 0;
  for (const row of rows) {
    if (row.needsReview && needsReview(row.editedSummary)) count++;
  }
  return count;
}
