import { forwardRef } from "react";
import { needsReview } from "../lib/mapping";
import type { TransactionRow } from "../types";
import { SummaryEditCell } from "./SummaryEditCell";

interface Props {
  rows: TransactionRow[];
  selectedRow: number;
  onSelectRow: (idx: number) => void;
  onEditSummary: (idx: number, value: string) => void;
  onCommitSummary: (idx: number, value: string) => void;
  onScroll: (scrollTop: number) => void;
  rowHeight: number;
}

function formatAmount(n: number): string {
  if (n === 0) return "";
  const abs = Math.abs(n).toLocaleString("ja-JP");
  return n < 0 ? `-${abs}` : abs;
}

function formatBalance(s: string): string {
  if (!s) return "";
  const cleaned = s.replace(/[\s,¥￥円]/g, "").trim();
  if (cleaned === "") return "";
  const num = Number(cleaned);
  return Number.isFinite(num) ? num.toLocaleString("ja-JP") : s;
}

export const ParsedDataPane = forwardRef<HTMLDivElement, Props>(
  function ParsedDataPane(
    {
      rows,
      selectedRow,
      onSelectRow,
      onEditSummary,
      onCommitSummary,
      onScroll,
      rowHeight,
    },
    ref,
  ) {
    const unprocessed = rows.filter(
      (r) => r.needsReview && needsReview(r.editedSummary),
    ).length;
    return (
      <div className="flex h-full min-h-0 flex-col bg-white">
        <div className="flex items-center justify-between border-b border-emerald-300 bg-emerald-100 px-4 py-2.5">
          <div>
            <div className="text-sm font-bold text-emerald-900">
              修正データ（あなたが編集する欄）
            </div>
            <div className="text-[10px] text-emerald-700">
              摘要列のみ編集可能 · {rows.length}行 · 未処理 {unprocessed}件
            </div>
          </div>
          <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-semibold text-white">
            編集可
          </span>
        </div>
        <div
          ref={ref}
          onScroll={(e) => onScroll((e.target as HTMLDivElement).scrollTop)}
          className="flex-1 overflow-auto bg-white"
        >
          <table className="min-w-full border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-emerald-50 text-emerald-900">
              <tr style={{ height: rowHeight }}>
                <th className="w-12 border-b border-r border-emerald-200 px-2 text-center text-[10px] font-medium text-emerald-500">
                  #
                </th>
                <th className="w-28 border-b border-r border-emerald-200 px-2 text-center font-medium">
                  日付
                </th>
                <th className="border-b-2 border-r border-b-emerald-500 border-r-emerald-200 bg-emerald-100 px-2 text-center font-bold text-emerald-900">
                  摘要 ✎ <span className="text-[10px] font-normal">(入力欄)</span>
                </th>
                <th className="w-32 border-b border-r border-emerald-200 px-2 text-center font-medium">
                  金額
                </th>
                <th className="w-32 border-b border-emerald-200 px-2 text-center font-medium">
                  残高
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const stillEmpty =
                  row.needsReview && needsReview(row.editedSummary);
                const isSelected = selectedRow === idx;
                const baseBg = stillEmpty ? "bg-amber-50" : "bg-white";
                const hoverBg = stillEmpty
                  ? "hover:bg-amber-100"
                  : "hover:bg-emerald-50";
                const rowBg = isSelected ? "bg-blue-100" : `${baseBg} ${hoverBg}`;
                return (
                  <tr
                    key={row.id}
                    data-row-index={idx}
                    style={{ height: rowHeight }}
                    onClick={() => onSelectRow(idx)}
                    className={`cursor-pointer ${rowBg}`}
                  >
                    <td className="border-b border-r border-gray-100 px-2 text-right text-[10px] text-gray-400">
                      {idx + 1}
                    </td>
                    <td className="whitespace-nowrap border-b border-r border-gray-100 px-2 font-mono text-[13px] tabular-nums text-gray-700">
                      {row.date}
                    </td>
                    <td className="border-b border-r-2 border-r-emerald-200 border-b-gray-100 bg-white/60 p-0">
                      <SummaryEditCell
                        amount={row.amount}
                        date={row.date}
                        value={row.editedSummary}
                        rowHeight={rowHeight}
                        stillEmpty={stillEmpty}
                        onChange={(v) => onEditSummary(idx, v)}
                        onCommit={(v) => onCommitSummary(idx, v)}
                        onFocus={() => onSelectRow(idx)}
                      />
                    </td>
                    <td
                      className={`whitespace-nowrap border-b border-r border-gray-100 px-2 text-right font-mono text-[13px] tabular-nums font-semibold ${
                        row.amount < 0 ? "text-red-600" : "text-gray-800"
                      }`}
                    >
                      {formatAmount(row.amount)}
                    </td>
                    <td className="whitespace-nowrap border-b border-gray-100 px-2 text-right font-mono text-[13px] tabular-nums text-gray-700">
                      {formatBalance(row.balance)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  },
);
