import { useMemo } from "react";
import { formatDateJa, dateDigits } from "../lib/date";
import { mergeTransactions } from "../lib/merge";
import type { BankInfo, TransactionRow } from "../types";
import type { ImportSession } from "../lib/db";

interface Props {
  bankInfo: BankInfo;
  existing: ImportSession;
  incomingRawRows: string[][];
  incomingRows: TransactionRow[];
  incomingFileName: string;
  onMerge: () => void;
  onNewSession: () => void;
  onCancel: () => void;
}

function dateRange(rows: TransactionRow[]): string {
  const ds = rows
    .map((r) => dateDigits(r.date))
    .filter((d) => d.length === 8)
    .sort();
  if (ds.length === 0) return "-";
  return `${formatDateJa(ds[0])} 〜 ${formatDateJa(ds[ds.length - 1])}`;
}

export function MergeDialog({
  bankInfo,
  existing,
  incomingRawRows,
  incomingRows,
  incomingFileName,
  onMerge,
  onNewSession,
  onCancel,
}: Props) {
  const preview = useMemo(
    () =>
      mergeTransactions({
        existingRawRows: existing.imported.rawRows,
        existingRows: existing.rows,
        incomingRawRows,
        incomingRows,
      }),
    [existing, incomingRawRows, incomingRows],
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-bold text-gray-900">
            同じ銀行・口座の作業データが見つかりました
          </h2>
          <p className="mt-1 text-xs text-gray-600">
            銀行名「{bankInfo.bankName}」 / 口座番号「
            {bankInfo.accountName || "(未設定)"}」の途中保存セッションがあります。合算するか、新しい作業として始めるかを選んでください。
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 px-6 py-4 md:grid-cols-2">
          <section className="rounded-md border border-gray-200 bg-gray-50 p-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              既存の作業データ
            </h3>
            <div className="mt-2 space-y-1 text-xs text-gray-700">
              <div>ファイル: {existing.imported.fileName}</div>
              <div>件数: {existing.rows.length} 行</div>
              <div>期間: {dateRange(existing.rows)}</div>
            </div>
          </section>
          <section className="rounded-md border border-gray-200 bg-gray-50 p-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              今回アップロードしたCSV
            </h3>
            <div className="mt-2 space-y-1 text-xs text-gray-700">
              <div>ファイル: {incomingFileName}</div>
              <div>件数: {incomingRows.length} 行</div>
              <div>期間: {dateRange(incomingRows)}</div>
            </div>
          </section>
        </div>

        <div className="border-t border-b border-emerald-200 bg-emerald-50 px-6 py-3">
          <h3 className="text-xs font-semibold text-emerald-900">
            「合算する」を選んだ場合の結果
          </h3>
          <div className="mt-2 grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-lg font-bold text-emerald-700">
                {preview.addedCount}
              </div>
              <div className="text-[10px] text-emerald-700">追加される行</div>
            </div>
            <div>
              <div className="text-lg font-bold text-gray-500">
                {preview.duplicateCount}
              </div>
              <div className="text-[10px] text-gray-500">
                重複として除外される行
              </div>
            </div>
            <div>
              <div className="text-lg font-bold text-emerald-700">
                {preview.totalAfter}
              </div>
              <div className="text-[10px] text-emerald-700">合算後の合計行数</div>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-emerald-800">
            重複判定は「日付＋金額＋残高」が一致する行で行います。既存の作業データの摘要入力は保持されます。
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            キャンセル
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onNewSession}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              合算せず新規セッションで始める
            </button>
            <button
              type="button"
              onClick={onMerge}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
            >
              合算する
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
