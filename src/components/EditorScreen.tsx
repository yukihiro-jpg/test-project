import { useEffect, useMemo, useRef, useState } from "react";
import { applyMapping, countUnreviewed, needsReview } from "../lib/mapping";
import {
  buildOutputCsv,
  buildOutputFilename,
  downloadCsv,
} from "../lib/export";
import {
  markSessionCompleted,
  recordCounterparty,
  saveSession,
} from "../lib/db";
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
  initialRows?: TransactionRow[] | null;
  initialSelectedRow?: number;
  sessionId?: string | null;
  onBack: () => void;
  onCompleted: () => void;
}

const ROW_HEIGHT = 36;
const AUTOSAVE_DEBOUNCE_MS = 800;

export function EditorScreen({
  imported,
  mapping,
  bankInfo,
  initialRows,
  initialSelectedRow = 0,
  sessionId: initialSessionId = null,
  onBack,
  onCompleted,
}: Props) {
  const computedRows = useMemo(
    () => applyMapping(imported, mapping),
    [imported, mapping],
  );

  const [rows, setRows] = useState<TransactionRow[]>(
    initialRows && initialRows.length === computedRows.length
      ? initialRows
      : computedRows,
  );
  const [selectedRow, setSelectedRow] = useState<number>(initialSelectedRow);
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [showSource, setShowSource] = useState(false);

  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const syncingRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const lastSavedHashRef = useRef<string>("");

  function rowsHash(): string {
    return JSON.stringify(rows.map((r) => r.editedSummary)) + `|${selectedRow}`;
  }

  async function doSave(): Promise<string> {
    const session = await saveSession(sessionId, {
      bankInfo,
      mapping,
      imported,
      rows,
      selectedRow,
      originalBytes: imported.originalBytes,
    });
    setSessionId(session.id);
    setSavedAt(session.updatedAt);
    lastSavedHashRef.current = rowsHash();
    return session.id;
  }

  useEffect(() => {
    const hash = rowsHash();
    if (hash === lastSavedHashRef.current) return;
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      void doSave();
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, selectedRow]);

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

  function commitSummary(idx: number, value: string) {
    const row = rows[idx];
    if (!row) return;
    const trimmed = value.trim();
    if (trimmed === "" || trimmed === row.originalSummary.trim()) return;
    void recordCounterparty(row.amount, row.date, trimmed);
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

  async function handleManualSave() {
    await doSave();
  }

  async function handleExport() {
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

    const id = await doSave();
    await markSessionCompleted(id);
    onCompleted();
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
            ホームへ
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
              {savedAt && (
                <span className="ml-2 text-emerald-600">
                  保存済 {new Date(savedAt).toLocaleTimeString("ja-JP")}
                </span>
              )}
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
            onClick={handleManualSave}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            途中保存
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="rounded-md bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            修正済みCSVファイルをダウンロード
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
                ? "bg-red-100 text-red-800"
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

      {unprocessedCount > 0 && (
        <div className="border-b-2 border-red-400 bg-red-50 px-4 py-2 text-center text-sm font-bold text-red-700">
          未処理の取引が {unprocessedCount} 件残っています。「→」ボタンで未処理行へ移動し、摘要欄を入力してすべて処理してから書き出してください。
        </div>
      )}

      <div className="grid grid-cols-2 border-b border-gray-200 bg-gray-50 px-4 py-1.5 text-[11px]">
        <div className="text-rose-700">
          左画面:アップロードしたCSVをそのまま表示（編集不可）
        </div>
        <div className="text-emerald-700">
          右画面:ここで「摘要」を入力・修正します
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
          onCommitSummary={commitSummary}
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
