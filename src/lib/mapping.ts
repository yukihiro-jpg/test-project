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

export function applyMapping(
  imported: ImportedCsv,
  mapping: ColumnMapping,
): TransactionRow[] {
  return imported.rawRows.map((row, idx) => {
    const date = (row[mapping.date] ?? "").toString().trim();
    const original = (row[mapping.summary] ?? "").toString();
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

    const summaryStr = original.toString();

    return {
      id: idx,
      date,
      originalSummary: summaryStr,
      editedSummary: summaryStr,
      amount,
      balance,
      needsReview: needsReview(summaryStr),
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
