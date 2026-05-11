import { forwardRef } from "react";
import { needsReview } from "../lib/mapping";
import type { TransactionRow } from "../types";

interface Props {
  rows: TransactionRow[];
  selectedRow: number;
  onSelectRow: (idx: number) => void;
  onEditSummary: (idx: number, value: string) => void;
  onScroll: (scrollTop: number) => void;
  rowHeight: number;
}

function formatAmount(n: number): string {
  if (n === 0) return "";
  const abs = Math.abs(n).toLocaleString("ja-JP");
  return n < 0 ? `-${abs}` : abs;
}

export const ParsedDataPane = forwardRef<HTMLDivElement, Props>(
  function ParsedDataPane(
    { rows, selectedRow, onSelectRow, onEditSummary, onScroll, rowHeight },
    ref,
  ) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-100 px-3 py-2">
          <span className="text-xs font-semibold text-gray-700">
            解析データ（摘要編集可）
          </span>
          <span className="text-[10px] text-gray-500">{rows.length} 行</span>
        </div>
        <div
          ref={ref}
          onScroll={(e) => onScroll((e.target as HTMLDivElement).scrollTop)}
          className="flex-1 overflow-auto"
        >
          <table className="min-w-full border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-gray-100 text-gray-700">
              <tr style={{ height: rowHeight }}>
                <th className="w-12 border-b border-r border-gray-200 px-2 text-right text-[10px] font-medium text-gray-500">
                  #
                </th>
                <th className="w-28 border-b border-r border-gray-200 px-2 text-left font-medium">
                  日付
                </th>
                <th className="border-b border-r border-gray-200 px-2 text-left font-medium">
                  摘要
                </th>
                <th className="w-32 border-b border-r border-gray-200 px-2 text-right font-medium">
                  金額
                </th>
                <th className="w-32 border-b border-gray-200 px-2 text-right font-medium">
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
                  : "hover:bg-gray-50";
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
                    <td className="whitespace-nowrap border-b border-r border-gray-100 px-2 font-mono text-[11px]">
                      {row.date}
                    </td>
                    <td className="border-b border-r border-gray-100 p-0">
                      <input
                        type="text"
                        value={row.editedSummary}
                        onChange={(e) => onEditSummary(idx, e.target.value)}
                        onFocus={() => onSelectRow(idx)}
                        placeholder={stillEmpty ? "未入力" : ""}
                        className={`block h-full w-full bg-transparent px-2 py-0 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                          stillEmpty ? "placeholder:text-amber-600" : ""
                        }`}
                        style={{ height: rowHeight }}
                      />
                    </td>
                    <td
                      className={`whitespace-nowrap border-b border-r border-gray-100 px-2 text-right font-mono text-[11px] ${
                        row.amount < 0 ? "text-red-600" : "text-gray-800"
                      }`}
                    >
                      {formatAmount(row.amount)}
                    </td>
                    <td className="whitespace-nowrap border-b border-gray-100 px-2 text-right font-mono text-[11px] text-gray-600">
                      {row.balance}
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
