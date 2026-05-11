import { useEffect, useMemo, useRef, useState } from "react";
import { applyMapping, countUnreviewed, needsReview } from "../lib/mapping";
import {
  buildOutputCsv,
  buildOutputFilename,
  downloadCsv,
} from "../lib/export";
import type {
  BankInfo,
  ColumnMapping,
  ImportedCsv,
  TransactionRow,
} from "../types";
import { RawCsvPane } from "./RawCsvPane";
import { ParsedDataPane } from "./ParsedDataPane";
import { SourceCsvModal } from "./SourceCsvModal";

interface Props {
  imported: ImportedCsv;
  mapping: ColumnMapping;
  bankInfo: BankInfo;
  onBack: () => void;
}

const ROW_HEIGHT = 32;

export function EditorScreen({ imported, mapping, bankInfo, onBack }: Props) {
  const initialRows = useMemo(
    () => applyMapping(imported, mapping),
    [imported, mapping],
  );
  const [rows, setRows] = useState<TransactionRow[]>(initialRows);
  const [selectedRow, setSelectedRow] = useState<number>(0);
  const [showSource, setShowSource] = useState(false);

  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const syncingRef = useRef(false);

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  function handleScroll(source: "left" | "right", scrollTop: number) {
    if (syncingRef.current) return;
    syncingRef.current = true;
    const target = source === "left" ? rightRef.current : leftRef.current;
    if (target && target.scrollTop !== scrollTop) {
      target.scrollTop = scrollTop;
    }
    requestAnimationFrame(() => {
      syncingRef.current = false;
    });
  }

  function scrollBothTo(idx: number) {
    const offset =
      idx * ROW_HEIGHT - (leftRef.current?.clientHeight ?? 300) / 2 + ROW_HEIGHT;
    syncingRef.current = true;
    if (leftRef.current) leftRef.current.scrollTop = Math.max(0, offset);
    if (rightRef.current) rightRef.current.scrollTop = Math.max(0, offset);
    requestAnimationFrame(() => {
      syncingRef.current = false;
    });
  }

  function selectRow(idx: number) {
    setSelectedRow(idx);
  }

  function editSummary(idx: number, value: string) {
    setRows((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, editedSummary: value } : row)),
    );
  }

  const unprocessedCount = useMemo(() => countUnreviewed(rows), [rows]);

  function jumpToNextUnprocessed() {
    const start = selectedRow + 1;
    const total = rows.length;
    for (let offset = 0; offset < total; offset++) {
      const idx = (start + offset) % total;
      const row = rows[idx];
      if (row.needsReview && needsReview(row.editedSummary)) {
        setSelectedRow(idx);
        scrollBothTo(idx);
        return;
      }
    }
  }

  function jumpToPrevUnprocessed() {
    const total = rows.length;
    const start = selectedRow - 1;
    for (let offset = 0; offset < total; offset++) {
      const idx = ((start - offset) % total + total) % total;
      const row = rows[idx];
      if (row.needsReview && needsReview(row.editedSummary)) {
        setSelectedRow(idx);
        scrollBothTo(idx);
        return;
      }
    }
  }

  function handleExport() {
    if (unprocessedCount > 0) {
      const ok = window.confirm(
        `未処理の行が ${unprocessedCount} 件残っています。\n` +
          `このまま修正済CSVを書き出しますか？`,
      );
      if (!ok) return;
    }
    const csv = buildOutputCsv(imported, mapping, rows);
    const filename = buildOutputFilename(bankInfo, rows);
    downloadCsv(csv, filename);
  }

  return (
    <div className="flex h-full flex-col bg-gray-50">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            戻る
          </button>
          <div>
            <div className="text-sm font-semibold text-gray-900">
              {bankInfo.bankName}
              {bankInfo.accountName && (
                <span className="ml-1 text-gray-500">
                  / {bankInfo.accountName}
                </span>
              )}
            </div>
            <div className="text-[11px] text-gray-500">
              {imported.fileName} · {rows.length}行
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSource(true)}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            元CSVを開く
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="rounded-md bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            修正済CSVを書き出し
          </button>
        </div>
      </header>

      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={jumpToPrevUnprocessed}
            disabled={unprocessedCount === 0}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            title="前の未処理へジャンプ"
          >
            ←
          </button>
          <button
            type="button"
            onClick={jumpToNextUnprocessed}
            disabled={unprocessedCount === 0}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            title="次の未処理へジャンプ"
          >
            →
          </button>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              unprocessedCount > 0
                ? "bg-amber-100 text-amber-800"
                : "bg-emerald-100 text-emerald-800"
            }`}
          >
            未処理 {unprocessedCount} 件
          </span>
        </div>
        <div className="text-[11px] text-gray-500">
          選択中: {selectedRow + 1} / {rows.length} 行
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-2">
        <RawCsvPane
          ref={leftRef}
          imported={imported}
          selectedRow={selectedRow}
          onSelectRow={selectRow}
          onScroll={(top) => handleScroll("left", top)}
          rowHeight={ROW_HEIGHT}
        />
        <ParsedDataPane
          ref={rightRef}
          rows={rows}
          selectedRow={selectedRow}
          onSelectRow={selectRow}
          onEditSummary={editSummary}
          onScroll={(top) => handleScroll("right", top)}
          rowHeight={ROW_HEIGHT}
        />
      </div>

      {showSource && (
        <SourceCsvModal
          imported={imported}
          onClose={() => setShowSource(false)}
        />
      )}
    </div>
  );
}
