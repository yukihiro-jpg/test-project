import Papa from "papaparse";
import type {
  BankInfo,
  ColumnMapping,
  ImportedCsv,
  TransactionRow,
} from "../types";

export function buildOutputCsv(
  imported: ImportedCsv,
  mapping: ColumnMapping,
  rows: TransactionRow[],
): string {
  const outputRows = imported.rawRows.map((rawRow, idx) => {
    const edited = rows[idx];
    const cloned = [...rawRow];
    if (edited) {
      cloned[mapping.summary] = edited.editedSummary;
    }
    return cloned;
  });
  return Papa.unparse([imported.headers, ...outputRows]);
}

function formatDateForFilename(date: string): string {
  if (!date) return "";
  const digits = date.replace(/\D/g, "");
  if (digits.length >= 8) return digits.slice(0, 8);
  return digits;
}

function sanitizeForFilename(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, "_").trim();
}

export function buildOutputFilename(
  info: BankInfo,
  rows: TransactionRow[],
): string {
  const dates = rows
    .map((r) => formatDateForFilename(r.date))
    .filter((d) => d.length === 8)
    .sort();
  const from = dates[0] ?? "";
  const to = dates[dates.length - 1] ?? "";
  const bank = sanitizeForFilename(info.bankName || "bank");
  const account = sanitizeForFilename(info.accountName || "account");
  const range = from && to ? `_${from}_${to}` : "";
  return `${bank}_${account}${range}.csv`;
}

export function downloadCsv(content: string, filename: string): void {
  const bom = "﻿";
  const blob = new Blob([bom + content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
