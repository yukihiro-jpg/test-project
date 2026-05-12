import Papa from "papaparse";
import { formatDateIso, formatDateJa, dateDigits } from "./date";
import type { BankInfo, TransactionRow } from "../types";

function cleanNumberString(s: string): string {
  if (!s) return "";
  const cleaned = s.replace(/[\s,¥￥円]/g, "").trim();
  return cleaned;
}

export function buildOutputCsv(rows: TransactionRow[]): string {
  const outputHeaders = ["日付", "摘要", "入金", "出金", "残高"];
  const outputRows = rows.map((r) => {
    const date = formatDateIso(r.date);
    const summary = r.editedSummary;
    const incoming = r.amount > 0 ? r.amount.toString() : "";
    const outgoing = r.amount < 0 ? Math.abs(r.amount).toString() : "";
    const balance = cleanNumberString(r.balance);
    return [date, summary, incoming, outgoing, balance];
  });
  return Papa.unparse([outputHeaders, ...outputRows]);
}

function sanitizeForFilename(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, "_").trim();
}

export function buildOutputFilename(
  info: BankInfo,
  rows: TransactionRow[],
): string {
  const dates = rows
    .map((r) => dateDigits(r.date))
    .filter((d) => d.length === 8)
    .sort();
  const from = dates[0] ?? "";
  const to = dates[dates.length - 1] ?? "";
  const bank = sanitizeForFilename(info.bankName || "bank");
  const range =
    from && to ? `_${formatDateJa(from)}-${formatDateJa(to)}` : "";
  return `${bank}${range}.csv`;
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
